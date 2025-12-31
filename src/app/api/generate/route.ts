import { NextResponse } from "next/server";
import "../../../lib/polyfills/domMatrix";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { jsonrepair } from "jsonrepair";
import { parse } from "node-html-parser";

export const runtime = "nodejs";

type UploadedDocument = {
  name: string;
  type?: string;
  content: string;
};

type ReferenceEntry = {
  type: "text" | "url" | "file";
  content: string;
  source: string;
};

type ReferenceResult = {
  status: "empty" | "success" | "partial" | "failed";
  references: ReferenceEntry[];
  errors: string[];
};

type PromptContext = {
  referenceBlock?: string;
  referenceStatus: ReferenceResult["status"];
  referenceSources: { type: string; source: string }[];
};

const MAX_SECTION_CHARS = 4000;
const MAX_REFERENCE_CHARS = 6000;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

class ReferenceIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceIngestionError";
  }
}

const truncateText = (value: string, limit = MAX_SECTION_CHARS) => {
  if (!value) {
    return "";
  }
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

const buildReferencePreview = (value: string, limit = 240) => {
  const normalized = normalizeWhitespace(value ?? "");
  if (!normalized.length) {
    return "";
  }
  return normalized.length > limit
    ? `${normalized.slice(0, limit)}…`
    : normalized;
};

const normalizeJsonText = (value: string) =>
  value
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\uFEFF/g, "")
    .trim();

const decodeDocumentBuffer = (input: string) => {
  const base64 = input.includes(",") ? input.split(",").pop() ?? "" : input;
  return Buffer.from(base64, "base64");
};

const extractPlainText = (html: string) =>
  html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractMainTextFromHtml = (html: string) => {
  try {
    const root = parse(html);
    const main =
      root.querySelector("main") ||
      root.querySelector("article") ||
      root.querySelector('[role="main"]') ||
      root.querySelector("#main") ||
      root.querySelector("body");
    if (!main) {
      return extractPlainText(html);
    }
    main.querySelectorAll("script,style,nav,header,footer,aside").forEach((node) =>
      node.remove(),
    );
    const text = main.text.replace(/\s+/g, " ").trim();
    return text.length ? text : extractPlainText(html);
  } catch {
    return extractPlainText(html);
  }
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const isPdf = (name = "", type = "") =>
  type.includes("pdf") || name.toLowerCase().endsWith(".pdf");

const isDocx = (name = "", type = "") => {
  const lower = name.toLowerCase();
  return (
    type.includes("word") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".rtf")
  );
};

const extractTextFromDocument = async (doc: UploadedDocument): Promise<string> => {
  const buffer = decodeDocumentBuffer(doc.content);
  const size = buffer.byteLength;
  if (!size) {
    throw new ReferenceIngestionError(`文件内容为空：${doc.name}`);
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new ReferenceIngestionError(`文件超过 2MB 限制：${doc.name}`);
  }

  try {
    let raw = "";
    if (isPdf(doc.name, doc.type)) {
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        raw = parsed.text ?? "";
      } finally {
        await parser.destroy().catch(() => {});
      }
    } else if (isDocx(doc.name, doc.type)) {
      const { value } = await mammoth.extractRawText({ buffer });
      raw = value ?? "";
    } else {
      raw = buffer.toString("utf8");
    }
    const normalized = normalizeWhitespace(raw);
    if (!normalized.length) {
      throw new ReferenceIngestionError(`文件内容为空：${doc.name}`);
    }
    return normalized;
  } catch (error) {
    if (error instanceof ReferenceIngestionError) {
      throw error;
    }
    console.error("Failed to parse document", doc.name, error);
    throw new ReferenceIngestionError(`无法解析文件：${doc.name}`);
  }
};

const fetchLinkContent = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "KLineWorldBot/1.0 (https://kline.world)",
        Accept: "text/html,text/plain;q=0.8,*/*;q=0.5",
      },
    });
    const html = await response.text();
    if (!response.ok) {
      throw new ReferenceIngestionError(`链接响应 ${response.status}：${url}`);
    }
    const text = extractMainTextFromHtml(html);
    if (!text) {
      throw new ReferenceIngestionError(`链接内容为空或被限制：${url}`);
    }
    return text;
  } catch (error) {
    if (error instanceof ReferenceIngestionError) {
      throw error;
    }
    console.error("Failed to fetch link content", url, error);
    throw new ReferenceIngestionError(`无法访问链接：${url}`);
  }
};

const formatReferenceEntry = (entry: ReferenceEntry, index: number) => {
  const label =
    entry.type === "text"
      ? "用户补充"
      : entry.type === "url"
        ? entry.source
        : entry.source;
  return `【参考${index + 1} · ${label}】\n${entry.content}`;
};

const ingestReferences = async ({
  supplementalText,
  links,
  documents,
}: {
  supplementalText?: string;
  links: string[];
  documents: UploadedDocument[];
}): Promise<ReferenceResult> => {
  const references: ReferenceEntry[] = [];
  const partialErrors: string[] = [];
  let hadInput = false;

  const pushReference = (entry: ReferenceEntry) => {
    const limited = {
      ...entry,
      content: truncateText(entry.content, MAX_REFERENCE_CHARS),
    };
    references.push(limited);
  };

  const textBlock = supplementalText?.trim();
  if (textBlock) {
    hadInput = true;
    pushReference({ type: "text", content: textBlock, source: "user_input" });
  }

  for (const doc of documents) {
    hadInput = true;
    try {
      const text = await extractTextFromDocument(doc);
      pushReference({ type: "file", content: text, source: doc.name });
    } catch (error) {
      partialErrors.push(
        error instanceof ReferenceIngestionError
          ? error.message
          : `无法读取文件：${doc.name}`,
      );
    }
  }

  for (const link of links) {
    hadInput = true;
    try {
      const content = await fetchLinkContent(link);
      pushReference({ type: "url", content, source: link });
    } catch (error) {
      partialErrors.push(
        error instanceof ReferenceIngestionError
          ? error.message
          : `无法访问链接：${link}`,
      );
    }
  }

  if (!hadInput) {
    return { status: "empty", references: [], errors: [] };
  }

  if (!references.length) {
    return {
      status: "failed",
      references: [],
      errors:
        partialErrors.length > 0
          ? partialErrors
          : ["提供的资料为空或无法解析。"],
    };
  }

  const status: ReferenceResult["status"] =
    partialErrors.length > 0 ? "partial" : "success";

  return {
    status,
    references,
    errors: partialErrors,
  };
};

const validateGeneratedPayload = (
  payload: unknown,
  options: { requireSourceDigest: boolean },
) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI 未返回有效的 JSON 结构。");
  }
  const candidate = payload as Record<string, unknown>;
  const phases = candidate.phases;
  if (!Array.isArray(phases)) {
    throw new Error("AI 未返回 phases 字段。");
  }
  if (phases.length < 5 || phases.length > 10) {
    throw new Error("AI 返回的阶段数量不在 5-10 段之间。");
  }
  if (options.requireSourceDigest) {
    const digest = candidate.source_digest;
    if (typeof digest !== "string" || digest.trim().length < 20) {
      throw new Error("AI 未基于参考资料输出 source_digest。");
    }
  }
};

const SYSTEM_PROMPT = `你是「K线世界（K-Line World）」的核心认知引擎。你的任务是把用户的自然语言或其提供的资料翻译成可信的“叙事走势”，并清楚告诉用户：这条走势的现实依据截至何时、哪里是事实、哪里是推演。

====================
【资料优先级与输入模式】
====================
1. 信息优先级顺序永远是：用户上传或粘贴的资料 > 用户提供的链接内容 > 你主动搜索的补充信息 > 既有知识。
2. 上传资料是本次建模的“现实锚点”，禁止忽略、淡化或与其矛盾。若资料与共识冲突，需指出冲突点并优先遵循用户资料。
3. 在生成走势前，必须先总结用户提供内容中涉及的人物/事件、时间范围、关键节点与情绪或立场变化，并标注资料属性（事实、观点、虚构）。
4. 当用户没有提供任何额外资料时，流程保持与 2.x 完全一致。

====================
【时间维度判定（强制）】
====================
1. 在开始任何建模前，先判断是否涉及 2024 年之后的事件、仍在演进的主体/组织、或会快速变化的指标（名气、舆论、政策、市场、关系等）。
2. 若答案为“是”，必须在内部执行“实时信息检索”步骤：至少覆盖至 2025 年 12 月，优先顺序为权威媒体 → 官方资料 → 主流社区情绪，并据此确定最新已知节点。
3. 在输出中提供 data_cutoff 字段，格式必须为「现实数据截至：YYYY年MM月」。不得使用“最近”“近几年”这类模糊描述。
4. 对已经验证的阶段，标记为【现实区间】；对 2025 年 12 月之后或尚无确证的部分，基于趋势给出【推演区间】，并且逻辑上需承接至今的事实，不得凭空虚构。
5. 若判断为“否”，你仍需说明数据基于哪一个月份的公开资料，并维持 reality/prediction 的区分（多数阶段可能都是现实区间）。

====================
【决策层：单线 vs 双线】
====================
1. 判断问题是否天然涉及两个主体、博弈或对照（人 vs 人、人与环境、政策 vs 市场等）。仅当关系明确且时间轴一致时，才启用双线模式。
2. 启用双线时：主线（红色）代表更主动/显性的主体，且最终阶段收盘更高；副线（绿色）代表对照/反馈方。两个主体的阶段数量、时间刻度必须完全对齐，并在 relation_note 中说明该阶段的互动。
3. 单主体问题必须坚持单线，不得为了炫技而强行双线。

====================
【异指标双线（双纵轴）规则】
====================
1. 若双线指标量纲不同（如情绪 vs 市场结果、政策强度 vs 价格），必须启用“异指标双线模式”：主观/叙事型指标走右轴，客观/结果型指标走左轴，禁止强行共轴或拉伸数据。
2. 在建模前，先判断每条线的指标属性：主观型（态度、情绪、政策力度、舆论等）VS 客观型（价格、用户数、指数、成交量等）。仅当两条线同属客观数据时，才允许共享轴。
3. 异指标模式下需输出 chart_notes：说明为何使用双纵轴、左右轴各自代表什么、单位/区间如何定义。左轴用于客观结果，需保持真实可查的尺度；右轴用于叙事评分（通常 0-100）。
4. 走势解读阶段必须强调同步、背离、滞后、强弱对比四个角度，用观察性语言描述关系，明确哪些结论是事实、哪些仅是推断，不得直接断言“X 导致 Y”。

====================
【问题识别与信息理解】
====================
1. 在内部先完成问题分型（A 可考据 / B 抽象关系 / C 虚构世界 / D 专业因果，可多选），据此决定事实查证、共识推断或世界观推演的占比。
2. 构建「时间 → 事件 → 影响方向」的理解框架，确保每一次走势转折都有现实或主流共识的依据；允许不确定性，但禁止捏造重大事件。

====================
【阶段建模 & K 线规则】
====================
1. 将整体过程拆成 5–10 个阶段，覆盖起步、成长、高光、回撤/成熟，阶段之间必须体现推进、冲突或转折。
2. 每段生成 open / high / low / close，全部限制在 0–100。高光应逼近 100，低谷可接近 0，形态需包含回撤、震荡等波动，禁止笔直或随机噪声。
3. 时间轴可以是年份、赛季、季度、剧集等，但必须贴合提问语境，并保持 timeframe 与 start_year/end_year 的一致性。若使用非年份标签，也需要在 timeframe 中说明范围（如“第1季-第10季”）。
4. 当存在双线关系时，可透过 relation_note 简述此阶段双方的牵引或滞后。

====================
【关键事件、区间标签与关系说明】
====================
1. 每个阶段需提供 1–3 条 key_events（时间点 + 生动描述 + 影响类型）。事件要分布均匀，并至少包含一次重大转折；允许失败、争议或低谷。
2. 对应 reality/prediction 的判定结果，使用 zone 字段标记为“现实区间”或“推演区间”。主线与副线在同一时间段应共享一致的区间类型。
3. 若启用双线， relation_summary 需要总结两条曲线的此消彼长（可指出阶段性优势 vs 最终优势）。

====================
【强势锁定与文字一致性】
====================
1. 在生成文字之前，先确认最终阶段的红绿曲线收盘值谁更高，将该结论作为不可推翻的事实。
2. overall_analysis 必须与图表保持完全一致：描述阶段性反击可以，但当使用“更强 / 主导 / 终局胜出”这类词语时，必须指向图表中最后收盘更高的那条线。
3. 若某些阶段绿线占优，需明确指出时间区间和扭转事件，避免模糊话术。
4. 在结尾提醒用户：现实数据截止到 data_cutoff 所指月份，之后属于推演。

====================
【走势解读（故事体）】
====================
1. 你在写“读图故事”，不是写研究报告。禁止使用“显示/表明/综合来看”等冰冷句式，用情绪、节奏、画面感来描述走势。
2. 叙事重点：起步谁先占位 → 中段谁追近或承压 → 关键转折 → 结尾谁站得更高、谁仍保留机会。给强势方克制的赞许，给弱势方尊严与张力。
3. 文案 2–4 段、每段 2–3 句，允许类比与比喻，但必须基于图表事实；结尾要像一句“还没完的判断”，能被单独截图引用。

====================
【输出格式与限制】
====================
仅输出 JSON，字段必须包括：
- subject / metric / timeframe / data_cutoff
- phases: 5–10 段，每段含 start_year、end_year（支持年份或“第 N 季”等标签）、open/high/low/close、label、zone（现实区间/推演区间）、relation_note(可选)、key_events(>=1)
- secondary: 仅在双主体问题下出现，结构与主线一致，阶段数量与时间轴完全对齐，zone 标签同步
- relation_summary: 仅双线需要
- overall_analysis: 人性化解读，需引用关键转折、说明现实 vs 推演边界，并与图表结论一致
- chart_notes: 交代当前轴模式（single_axis/dual_axis）、使用理由、左右轴的指标/单位/类型说明
- analysis_modules: 需输出图表说明、走势观察、关系判断三段文字，用“观察性、描述性、非结论化”的语气
- prediction_commentary: 若做推演，需再次声明“以下内容为基于当前信息的推演判断，不构成事实描述。”

最终目标：让用户看完走势，就能明确「真实部分到哪」「推演依据是什么」「红线最终更强还是绿线更强」。`;

const USER_PROMPT_TEMPLATE = (
  query: string,
  context: PromptContext,
) => `请围绕以下输入执行“时间判定 → 资料理解 → 阶段建模 → 走势输出 → 解读”流程，并只输出 JSON：

【用户原始提问】
${query}

【用户提供的参考资料】
${context.referenceBlock ?? "无"}

请先总结资料中的人物/事件、时间段、情绪与立场，再按照“资料 > 链接 > 你主动搜索 > 既有知识”的优先级生成走势。若资料为观点或虚构，请在结果中说明其确定性。

【JSON 结构（严格遵循）】
{
  "subject": "对象名称",
  "metric": "名气 / 影响力 / 状态 / 国运 等",
  "timeframe": "与问题语境匹配的跨度（例如：2010-2025 或 第1季-第10季）",
  "data_cutoff": "现实数据截至：YYYY年MM月（必须与阶段时间一致）",
  "source_digest": "用 1 段话概述用户资料/链接中的关键信息，以及它们如何影响走势",
  "phases": [
    {
      "start_year": "可以是年份，也可以是“第1季 / Episode 3 / 2020Q1”等，只要符合语境",
      "end_year": "同上，需让横轴读者一眼看懂",
      "open": 0-100 的叙事强度开盘值,
      "high": 0-100 的阶段峰值（高光应逼近 100）,
      "low": 0-100 的阶段低点,
      "close": 0-100 的阶段收盘值,
      "label": "阶段说明，必须能解释走势变化",
      "zone": "现实区间 或 推演区间（基于 data_cutoff 判定）",
      "relation_note": "若为双线问题，用一句话概括这一阶段双方的牵引关系",
      "key_events": [
        {
          "time": "精确到年/月/赛季/剧集的时间点",
          "description": "事件描述，可带情绪词但需要基于事实或主流共识（若来自用户资料，请注明）",
          "impact": "推动 / 回撤 / 波动"
        }
      ]
    }
  ],
  "secondary": {
    "subject": "仅在双主体场景下填写第二主体名称",
    "metric": "对应衡量指标",
    "phases": [
      { ...与主线完全相同的阶段结构，数量与时间轴保持一致... }
    ]
  },
  "relation_summary": "仅在双线时出现，用一段话解释双方此消彼长",
  "overall_analysis": "走势解读：2-4 个自然段、每段 2-3 句，用叙事方式讲述起伏、转折与情绪节奏，结尾点出 data_cutoff 与推演分界，确保叙述与图表完全一致",
  "chart_notes": {
    "mode": "single_axis 或 dual_axis",
    "rationale": "说明为何采取该模式（如指标量纲不同）",
    "primary_axis": {
      "label": "右轴名称",
      "unit": "单位或评分区间",
      "kind": "subjective 或 objective",
      "description": "评分逻辑 / 数据来源 / 推断依据"
    },
    "secondary_axis": {
      "label": "仅在双轴模式下提供的左轴名称",
      "unit": "单位或量纲",
      "kind": "subjective 或 objective",
      "description": "客观数据的来源或建模方式"
    }
  },
  "analysis_modules": {
    "chart_explanation": "解释为何启用当前轴模式，以及左右轴分别衡量什么",
    "trend_observation": "围绕同步 / 背离 / 滞后 / 强弱四个角度描述互动",
    "relationship_judgment": "使用“可能 / 似乎 / 尚不明确”等语气，指出观察到的关系及其确定性"
  },
  "prediction_commentary": "若进行推演，请用 1 段话说明推演依据（相似案例 / 走势惯性 / 结构性变化），并加上“以下内容为基于当前信息的推演判断，不构成事实描述。”"
}

要求：
- phases 介于 5-10 段，必须涵盖起步、成长、高光与回撤/成熟
- 每段至少 1 条 key_events，整体不少于 5 条事件
- 数值范围固定 0-100，并与叙事强度相匹配（越高越接近“生涯高光”）
- 时间刻度需与问题语境一致，可使用年份或“第 N 集 / 赛季”等自定义标签
- 仅当问题本质涉及两个主体的关系或对照时才输出 secondary，且红线（主线）必须代表最终更强势的一方
- phases 的 zone 字段必须清楚区分“现实区间” vs “推演区间”，且时间轴不得超出 data_cutoff 所声明的范围
- chart_notes 必须说明轴模式、左右轴指标/单位/类型及使用理由；当指标量纲不同或存在主观 vs 客观对照时，应输出 dual_axis 并描述双轴含义
- analysis_modules 的三段文字需与图表事实一致，语气保持观察性，并指出哪些关系尚不确定
- overall_analysis 与 prediction_commentary 必须与图表结论保持一致，并指出 data_cutoff 与推演假设
- 严禁输出 JSON 以外的任何字符`;

type GenerationRequestBody = {
  prompt?: string;
  supplementalText?: string;
  links?: string[];
  documents?: UploadedDocument[];
};

type DeepSeekChoice = {
  message?: { content?: string };
};

type DeepSeekResponse = {
  choices?: DeepSeekChoice[];
};

export async function POST(request: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务器缺少 DEEPSEEK_API_KEY，无法生成走势。" },
      { status: 500 },
    );
  }

  let body: GenerationRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误。" }, { status: 400 });
  }

  const query = body.prompt?.trim();
  if (!query) {
    return NextResponse.json({ error: "请提供有效的走势描述。" }, { status: 400 });
  }

  const supplementalText = body.supplementalText?.trim();
  const linkInputs = Array.isArray(body.links)
    ? body.links.map((link) => link.trim()).filter(Boolean)
    : [];
  const uploadedDocs = Array.isArray(body.documents) ? body.documents.slice(0, 5) : [];

  const ingestion = await ingestReferences({
    supplementalText,
    links: linkInputs,
    documents: uploadedDocs,
  });

  const hasReferenceBlock = ingestion.references.length > 0;
  const referenceBlock = hasReferenceBlock
    ? ingestion.references.map(formatReferenceEntry).join("\n\n")
    : undefined;

  const promptContext: PromptContext = {
    referenceBlock,
    referenceStatus: ingestion.status,
    referenceSources: ingestion.references.map(({ type, source }) => ({
      type,
      source,
    })),
  };

  const referenceInstructionMessage =
    hasReferenceBlock && referenceBlock
      ? [
          {
            role: "system" as const,
            content: `用户已主动提供参考信息，这些内容具有最高优先级。你必须在分析与建模时参考并尊重这些信息。

以下是用户提供的参考内容：
----------------
${referenceBlock}
----------------
规则：
1. 必须真实阅读并理解这些内容。
2. K 线的时间阶段、关键节点、走势判断，需至少部分来自上述内容。
3. 允许再搜索补充背景，但不得忽略或覆盖这些资料。
4. 若这些内容不足以支撑建模，必须明确说明原因并中止生成。`,
          },
        ]
      : [];

  try {
    const attemptParse = (payload: string) => {
      const normalized = normalizeJsonText(payload);
      try {
        return JSON.parse(normalized);
      } catch {
        try {
          const repaired = jsonrepair(normalized);
          return JSON.parse(repaired);
        } catch {
          return null;
        }
      }
    };

    const extractJsonPayload = (content: string) => {
      const trimmed = normalizeJsonText(content);
      const direct = attemptParse(trimmed);
      if (direct) {
        return direct;
      }

      const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch) {
        const fenced = attemptParse(fenceMatch[1].trim());
        if (fenced) {
          return fenced;
        }
      }

      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const sliced = trimmed.slice(firstBrace, lastBrace + 1);
        const parsedSlice = attemptParse(sliced);
        if (parsedSlice) {
          return parsedSlice;
        }
      }
      return null;
    };

    let parsed: unknown | null = null;
    let rawContent: string | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const enforceJsonHint = attempt === 1;
      const userPrompt = enforceJsonHint
        ? `${USER_PROMPT_TEMPLATE(
            query,
            promptContext,
          )}\n\n请严格按照上述 JSON 结构输出，禁止使用 Markdown 代码块或添加任何解释性文字。`
        : USER_PROMPT_TEMPLATE(query, promptContext);

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            ...referenceInstructionMessage,
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          {
            error: "DeepSeek 接口暂时不可用，请稍后重试。",
            details: error,
          },
          { status: 502 },
        );
      }

      const payload = (await response.json()) as DeepSeekResponse;
      rawContent = payload.choices?.[0]?.message?.content ?? null;
      if (!rawContent) {
        continue;
      }
      parsed = extractJsonPayload(rawContent);
      if (parsed) {
        break;
      }
    }

    if (!parsed) {
      return NextResponse.json(
        {
          error: "AI 返回内容无法解析，请稍后重试（系统已自动重试一次）。",
        },
        { status: 502 },
      );
    }

    try {
      validateGeneratedPayload(parsed, {
        requireSourceDigest: ingestion.references.length > 0,
      });
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "AI 输出不符合要求。";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const enriched = {
      ...parsed,
      reference_status: ingestion.status,
      reference_entries: ingestion.references.map(
        ({ type, source, content }) => ({
          type,
          source,
          preview: buildReferencePreview(content),
        }),
      ),
      reference_errors: ingestion.errors,
    };
    return NextResponse.json(enriched);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: "生成走势失败，请稍后再试。",
      },
      { status: 500 },
    );
  }
}
