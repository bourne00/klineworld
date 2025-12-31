"use client";

import {
  FormEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import type {
  ISeriesApi,
  SingleValueData,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import html2canvas from "html2canvas";

type TrendEvent = {
  time: string;
  description: string;
  impact: string;
};

type Phase = {
  start_year: number | string;
  end_year: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  label: string;
  key_events?: TrendEvent[];
  relation_note?: string;
  zone?: "现实区间" | "推演区间";
};

type AxisMeta = {
  label: string;
  unit?: string;
  kind?: "subjective" | "objective";
  description?: string;
  range_hint?: string;
};

type TrendSeries = {
  subject: string;
  metric: string;
  phases: Phase[];
  axis?: AxisMeta;
};

type ReferenceEntryMeta = {
  type: string;
  source: string;
  preview?: string;
};

type TrendResponse = {
  subject: string;
  metric: string;
  timeframe: string;
  phases: Phase[];
  secondary?: TrendSeries;
  relation_summary?: string;
  events?: TrendEvent[];
  analysis?: string;
  overall_analysis?: string;
  data_cutoff?: string;
  source_digest?: string;
  prediction_commentary?: string;
  chart_notes?: {
    mode?: "single_axis" | "dual_axis";
    rationale?: string;
    primary_axis?: AxisMeta;
    secondary_axis?: AxisMeta;
  };
  analysis_modules?: {
    chart_explanation?: string;
    trend_observation?: string;
    relationship_judgment?: string;
  };
  reference_status?: "empty" | "success" | "partial" | "failed";
  reference_entries?: ReferenceEntryMeta[];
  reference_errors?: string[];
};

const placeholderSamples = [
  "Blackpink 的名气走势",
  "泰勒斯威夫特的人气变化",
  "二战各国的表现走势",
  "比尔盖茨的财富积累变化",
  "AI 创业热度的叙事起伏",
  "巴黎奥运关注度的高潮与回落",
];

const sampleResponse: TrendResponse = {
  subject: "Blackpink",
  metric: "全球关注度",
  timeframe: "2016-2025",
  data_cutoff: "现实数据截至：2025年02月",
  source_digest:
    "用户提供的巡演纪要聚焦 2022-2024 的合约讨论与粉丝舆论，外部链接补充了环球巡演节点；据此判定 2024 之后进入“合约博弈+个人发展”阶段。",
  phases: [
    {
      start_year: 2016,
      end_year: 2017,
      open: 12,
      high: 42,
      low: 10,
      close: 35,
      label: "出道惊艳期：首支单曲引爆东亚话题",
      relation_note: "组合起势，YG 的资源逐渐集中",
      zone: "现实区间",
      key_events: [
        {
          time: "2016-08",
          description: "首支单曲上线即冲上韩国榜单高位",
          impact: "推动",
        },
        {
          time: "2016-11",
          description: "舞台表现连续刷屏社交媒体",
          impact: "推动",
        },
      ],
    },
    {
      start_year: 2018,
      end_year: 2019,
      open: 36,
      high: 65,
      low: 30,
      close: 62,
      label: "国际舞台扩张：Coachella 与巡演打开全球",
      relation_note: "组合国际曝光激增，经纪公司估值同步抬升",
      zone: "现实区间",
      key_events: [
        {
          time: "2018-06",
          description: "《DDU-DU DDU-DU》MV 刷新韩团记录",
          impact: "推动",
        },
        {
          time: "2019-04",
          description: "Coachella 演出点燃欧美受众",
          impact: "推动",
        },
      ],
    },
    {
      start_year: 2020,
      end_year: 2021,
      open: 64,
      high: 88,
      low: 55,
      close: 82,
      label: "爆款期：全员单曲 + 线上内容持续刷屏",
      relation_note: "粉丝资本投入拉动 YG 股价的高波动",
      zone: "现实区间",
      key_events: [
        {
          time: "2020-06",
          description: "《How You Like That》带来爆炸式流量",
          impact: "推动",
        },
        {
          time: "2021-10",
          description: "纪录片与真人秀保持曝光",
          impact: "推动",
        },
      ],
    },
    {
      start_year: 2022,
      end_year: 2023,
      open: 80,
      high: 96,
      low: 70,
      close: 88,
      label: "巅峰巡演：Born Pink 世界巡演场场爆满",
      relation_note: "巡演带动娱乐产业链收益",
      zone: "现实区间",
      key_events: [
        {
          time: "2022-09",
          description: "新专辑与巡演双线推进",
          impact: "推动",
        },
        {
          time: "2023-07",
          description: "巡演口碑小幅松动，出现疲劳声",
          impact: "波动",
        },
      ],
    },
    {
      start_year: 2024,
      end_year: 2025,
      open: 82,
      high: 94,
      low: 58,
      close: 72,
      label: "合约节点：个人走向与团体未来博弈",
      relation_note: "合约谈判让经纪公司及粉丝市场进入观望",
      zone: "推演区间",
      key_events: [
        {
          time: "2024-01",
          description: "续约传闻不断，引发粉丝情绪波动",
          impact: "波动",
        },
        {
          time: "2025-02",
          description: "个人发展动向引发全球讨论，整体关注高位震荡",
          impact: "波动",
        },
      ],
    },
  ],
  secondary: {
    subject: "YG 娱乐",
    metric: "商业动能",
    phases: [
      {
        start_year: 2016,
        end_year: 2017,
        open: 15,
        high: 40,
        low: 12,
        close: 30,
        label: "投入新女团，资本端审慎乐观",
        key_events: [
          {
            time: "2016",
            description: "资源集中到新团，财务投入上升",
            impact: "推动",
          },
        ],
        relation_note: "组合初期表现决定公司调度策略",
        zone: "现实区间",
      },
      {
        start_year: 2018,
        end_year: 2019,
        open: 32,
        high: 70,
        low: 28,
        close: 65,
        label: "国际曝光带动估值提升",
        relation_note: "组合爆红直接推高股价",
        zone: "现实区间",
        key_events: [
          {
            time: "2018-11",
            description: "Blackpink 在欧美爆红，资本预期升温",
            impact: "推动",
          },
        ],
      },
      {
        start_year: 2020,
        end_year: 2021,
        open: 60,
        high: 85,
        low: 55,
        close: 70,
        label: "疫情冲击下的内容自救",
        relation_note: "线上内容抵消实体演出损失",
        zone: "现实区间",
        key_events: [
          {
            time: "2020-04",
            description: "疫情冲击演出，但线上内容维持曝光",
            impact: "波动",
          },
        ],
      },
      {
        start_year: 2022,
        end_year: 2023,
        open: 68,
        high: 90,
        low: 60,
        close: 80,
        label: "世界巡演刺激营收与股价",
        relation_note: "巡演现金流让公司基本面改善",
        zone: "现实区间",
        key_events: [
          {
            time: "2022-10",
            description: "Born Pink 巡演票房带动财报预期",
            impact: "推动",
          },
        ],
      },
      {
        start_year: 2024,
        end_year: 2025,
        open: 78,
        high: 84,
        low: 48,
        close: 60,
        label: "合约不确定期的观望与再配置",
        relation_note: "续约压力让市场下调预期",
        key_events: [
          {
            time: "2024-06",
            description: "续约谈判反复，投资者保持谨慎",
            impact: "回撤",
          },
          {
            time: "2025-02",
            description: "等待新计划公布，资金流入其他资产",
            impact: "回撤",
          },
        ],
        zone: "推演区间",
      },
    ],
  },
  relation_summary: "组合与经纪公司此消彼长：黑粉爆红时，YG 股价被推高；合约不确定时，双方同步承压。",
  overall_analysis:
    "这条曲线像极了潜力股的爆炸式行情：从训练室默默积累，到凭借全球化策略破圈，再在合约期前后出现情绪高位震荡。真正改变斜率的是 2018-2020 年那波内容与巡演组合拳，而 2024 年的续约迷雾则带来一次必要的修正。",
  prediction_commentary:
    "以下内容为基于当前信息的推演判断，不构成事实描述：若 Born Pink 后的新阶段成功兼顾团体与个人，红线仍有向 90 分靠拢的机会；若续约谈判持续拖延，预计叙事势能将在 70 分上下拉锯，直到明确信号出现。",
  chart_notes: {
    mode: "dual_axis",
    rationale: "主线聚焦情绪评分，副线着眼于商业指标，不宜强行共轴。",
    primary_axis: {
      label: "全球关注度评分",
      unit: "0-100 叙事强度",
      kind: "subjective",
      description: "越接近 100 代表叙事高光。",
    },
    secondary_axis: {
      label: "商业动能",
      unit: "指数（相对值）",
      kind: "objective",
      description: "概念化的营收/估值指数，用于对照组合热度。",
    },
  },
  analysis_modules: {
    chart_explanation:
      "红线使用 0-100 的情绪评分来呈现 Blackpink 的全球热度；绿线采用概念化的商业动能指数，因两者量纲不同，所以启用双纵轴以保持解释力。",
    trend_observation:
      "2018-2020 红线陡升并带动绿线同步抬升；2022-2023 双线共同冲顶，但 2024 之后红线回落速度快于绿线，呈现轻微背离。合约谈判阶段，红线仍高于绿线，但波动幅度更大。",
    relationship_judgment:
      "若只看节奏，情绪高点往往领先商业数据半个阶段，但 2024 之后这种牵引关系开始减弱；目前只能说“商业端仍跟随但力度放缓”，并不能断言必然因果。",
  },
  reference_status: "success",
  reference_entries: [
    {
      type: "text",
      source: "user_input",
      preview: "用户补充的巡演纪要强调 2022-2024 年的合约讨论与粉丝情绪波动。",
    },
    {
      type: "url",
      source: "https://example.com/report",
      preview: "示例链接内容摘要，证明外部资料也会被读取并注入分析。",
    },
  ],
  reference_errors: [],
};

const yearToTimestamp = (label: number | string, index = 0): UTCTimestamp => {
  if (typeof label === "number") {
    return (Date.UTC(label, 0, 1) / 1000) as UTCTimestamp;
  }
  const raw = String(label).trim();
  const quarterMatch = raw.match(/((?:19|20)\d{2})\s*[Qq]([1-4])/);
  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]) - 1;
    return (Date.UTC(year, quarter * 3, 1) / 1000) as UTCTimestamp;
  }
  const yearMatch = raw.match(/((?:19|20)\d{2})/);
  if (yearMatch) {
    return (Date.UTC(Number(yearMatch[0]), 0, 1) / 1000) as UTCTimestamp;
  }
  const cnOrdinal = raw.match(/第?\s*(\d+)\s*(?:季|赛季|期|集|回|话|章|幕|阶段|局|场|篇)/);
  if (cnOrdinal) {
    const value = Number(cnOrdinal[1]);
    return (Date.UTC(2000 + value, 0, 1) / 1000) as UTCTimestamp;
  }
  const enOrdinal = raw.match(
    /(?:season|episode|ep|stage|phase|round|match|chapter|part)\s*0*(\d+)/i,
  );
  if (enOrdinal) {
    const value = Number(enOrdinal[1]);
    return (Date.UTC(2100 + value, 0, 1) / 1000) as UTCTimestamp;
  }
  const numeric = raw.match(/(\d+)/);
  if (numeric) {
    const value = Number(numeric[1]);
    return (Date.UTC(2200 + value, 0, 1) / 1000) as UTCTimestamp;
  }
  return (Date.UTC(1970, 0, 1) / 1000 + index * 24 * 60 * 60) as UTCTimestamp;
};

const defaultTimeLabel = (time: Time): string => {
  if (typeof time === "string") {
    return time;
  }
  const date = new Date((time as number) * 1000);
  const year = date.getUTCFullYear();
  if (year >= 2000 && year <= 2100) {
    return `${year - 1999}季`;
  }
  if (year === 1970 || isNaN(year)) {
    return "";
  }
  return `${year}年`;
};

const clampScore = (value: number) => Math.min(Math.max(value, 0), 100);

const normalizePhases = (
  phases: Phase[] | undefined,
  clampToHundred: boolean,
): Phase[] => {
  if (!phases?.length) {
    return phases ?? [];
  }
  if (!clampToHundred) {
    return phases.map((phase) => ({ ...phase }));
  }
  return phases.map((phase) => ({
    ...phase,
    open: clampScore(phase.open),
    high: clampScore(phase.high),
    low: clampScore(phase.low),
    close: clampScore(phase.close),
  }));
};

type AxisRange = {
  min: number;
  max: number;
};

const computePhaseRange = (
  phases: Phase[],
  axis?: AxisMeta,
): AxisRange | null => {
  if (!phases.length) {
    return null;
  }
  if (axis?.kind === "subjective") {
    return { min: 0, max: 100 };
  }
  const values = phases.flatMap((phase) => [
    phase.open,
    phase.close,
    phase.low,
    phase.high,
  ]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  if (min === max) {
    const padding = Math.abs(min) * 0.05 || 1;
    return { min: min - padding, max: max + padding };
  }
  const gap = (max - min) * 0.08 || 1;
  return { min: min - gap, max: max + gap };
};

const describeAxis = (axis?: AxisMeta) => {
  if (!axis) {
    return "";
  }
  const unit = axis.unit ? `（${axis.unit}）` : "";
  return `${axis.label}${unit}`;
};

type ChartPoint = SingleValueData & {
  phase?: Phase;
};

type ClientDocument = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
};

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ACCEPTED_FILE_TYPES =
  ".txt,.md,.markdown,.pdf,.doc,.docx,.rtf,.html,.htm";

const formatFileSize = (bytes: number) => {
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes > 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

const buildAreaData = (
  phases: Phase[],
  labelMap?: Map<number, string>,
): ChartPoint[] => {
  if (!phases.length) {
    return [];
  }
  const points: ChartPoint[] = [];
  let lastTime = 0;

  const pushPoint = (
    time: number,
    value: number,
    phase: Phase,
    label?: string,
  ) => {
    if (time <= lastTime) {
      time = lastTime + 24 * 60 * 60;
    }
    lastTime = time;
    points.push({
      time: time as UTCTimestamp,
      value,
      phase,
    });
    if (labelMap) {
      labelMap.set(time, label ?? "");
    }
  };

  phases.forEach((phase, index) => {
    const startTime = yearToTimestamp(phase.start_year, index);
    const endTime = yearToTimestamp(phase.end_year, index + 1);
    const boundedOpen = clampScore(phase.open);
    const boundedClose = clampScore(phase.close);
    const startLabel =
      typeof phase.start_year === "number"
        ? `${phase.start_year}年`
        : String(phase.start_year);
    const endLabel =
      typeof phase.end_year === "number"
        ? `${phase.end_year}年`
        : String(phase.end_year);

    if (index === 0) {
      pushPoint(startTime, boundedOpen, phase, startLabel);
    } else {
      const prev = phases[index - 1];
      const shouldBridge =
        prev.end_year !== phase.start_year || prev.close !== phase.open;
      if (shouldBridge) {
        pushPoint(startTime, boundedOpen, phase, startLabel);
      }
    }

    pushPoint(endTime, boundedClose, phase, endLabel);
  });

  return points;
};

const formatPhaseRange = (phase?: Phase) => {
  if (!phase) {
    return "";
  }
  return `${phase.start_year} - ${phase.end_year}`;
};

const summarizePhaseEvent = (phase: Phase) => {
  const event = phase.key_events?.[0];
  if (event) {
    return `${event.time} · ${event.description}`;
  }
  return phase.label;
};

const resolveZoneLabel = (phase?: Phase) => phase?.zone ?? "现实区间";

const isProjectionPhase = (phase?: Phase) => resolveZoneLabel(phase) === "推演区间";

type AxisConfig = {
  meta?: AxisMeta;
  range?: AxisRange | null;
};

type ChartPanelHandle = {
  captureImage: () => Promise<string | null>;
};

const ChartPanel = forwardRef<
  ChartPanelHandle,
  {
    phases: Phase[];
    secondaryPhases?: Phase[];
    axes?: {
      primary?: AxisConfig;
      secondary?: AxisConfig;
    };
    onHoverPhase: (
      primary: Phase | null,
      secondary: Phase | null,
      position?: { x: number; y: number },
    ) => void;
    meta: {
      title: string;
      timeframe: string;
      tag: string;
      legends: { label: string; color: string }[];
    };
  }
>(({ phases, secondaryPhases, axes, onHoverPhase, meta }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const boundsSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const secondarySeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const labelMapRef = useRef<Map<number, string>>(new Map());

  useImperativeHandle(
    ref,
    () => ({
        captureImage: async () => {
          if (!containerRef.current) {
            return null;
          }
          const clone = containerRef.current.cloneNode(true) as HTMLElement;
          const wrapper = document.createElement("div");
          wrapper.className = "export-frame";
          const legendHtml = meta.legends
            .map(
              (legend) =>
                `<span style="--legend-color:${legend.color}"><i style="background:${legend.color}"></i>${legend.label}</span>`,
            )
            .join("");
          wrapper.innerHTML = `
            <div class="export-header">
              <div>
                <div class="export-title">${meta.title}</div>
                <div class="export-meta">${meta.timeframe} · ${meta.tag}</div>
                <div class="export-legends">${legendHtml}</div>
              </div>
              <div class="export-brand">K线世界 K-Line World</div>
            </div>
          `;
          wrapper.appendChild(clone);
          document.body.appendChild(wrapper);
          const canvas = await html2canvas(wrapper, {
            backgroundColor: "#ffffff",
            scale: 2,
          });
          document.body.removeChild(wrapper);
          return canvas.toDataURL("image/png");
        },
      }),
    [meta.tag, meta.timeframe, meta.title, meta.legends],
  );

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 360,
      layout: {
        textColor: "#0f172a",
        background: {
          color: "#ffffff",
          type: ColorType.Solid,
        },
      },
      grid: {
        vertLines: { color: "rgba(15,23,42,0.08)", style: LineStyle.Dotted },
        horzLines: { color: "rgba(15,23,42,0.05)", style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      rightPriceScale: {
        borderColor: "rgba(15,23,42,0.08)",
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      leftPriceScale: {
        visible: false,
        borderColor: "rgba(15,23,42,0.12)",
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(15,23,42,0.08)",
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: true,
        tickMarkFormatter: (time: Time) => {
          if (typeof time === "number") {
            const custom = labelMapRef.current.get(time);
            if (custom) {
              return custom;
            }
          }
          return defaultTimeLabel(time);
        },
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#ef4444",
      lineWidth: 3,
      topColor: "rgba(239,68,68,0.25)",
      bottomColor: "rgba(239,68,68,0.05)",
      priceLineVisible: false,
      lastValueVisible: false,
      priceScaleId: "right",
    });
    series.applyOptions({
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    });

    const boundsSeries = chart.addSeries(AreaSeries, {
      lineWidth: 1,
      lineColor: "rgba(0,0,0,0)",
      topColor: "rgba(0,0,0,0)",
      bottomColor: "rgba(0,0,0,0)",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const secondarySeries = chart.addSeries(AreaSeries, {
      lineColor: "#16a34a",
      lineWidth: 3,
      topColor: "rgba(34,197,94,0.2)",
      bottomColor: "rgba(34,197,94,0.04)",
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
      priceScaleId: "left",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    boundsSeriesRef.current = boundsSeries;
    secondarySeriesRef.current = secondarySeries;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
        boundsSeriesRef.current = null;
        secondarySeriesRef.current = null;
      };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) {
      return;
    }
    const labelMap = new Map<number, string>();
    const data = buildAreaData(phases, labelMap);
    labelMapRef.current = labelMap;
    seriesRef.current.setData(data);
    if (secondaryPhases?.length && secondarySeriesRef.current) {
      const secondaryData = buildAreaData(secondaryPhases, labelMap);
      secondarySeriesRef.current.setData(secondaryData);
      secondarySeriesRef.current.applyOptions({ visible: true });
    } else {
      secondarySeriesRef.current?.setData([]);
      secondarySeriesRef.current?.applyOptions({ visible: false });
    }
    if (boundsSeriesRef.current && data.length) {
      const firstTime = data[0]?.time;
      const lastTime = data[data.length - 1]?.time ?? firstTime;
      if (firstTime) {
        boundsSeriesRef.current.setData([
          { time: firstTime, value: 0 },
          { time: lastTime ?? firstTime, value: 100 },
        ]);
      }
    }
    chartRef.current.applyOptions({
      localization: {
        priceFormatter: (value: number) => {
          if (axes?.primary?.meta?.kind === "subjective") {
            return `${value.toFixed(0)}`;
          }
          return Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2);
        },
      },
    });
    chartRef.current.timeScale().fitContent();
    const applyPriceScale = (
      scaleId: "right" | "left",
      info?: AxisConfig,
      visible = true,
      fallback: Phase[] = [],
    ) => {
      const scale = chartRef.current?.priceScale(scaleId) as
        | ReturnType<ReturnType<typeof createChart>["priceScale"]>
        | undefined;
      if (!scale) {
        return;
      }
      scale.applyOptions({
        autoScale: false,
        visible,
        borderColor:
          scaleId === "right"
            ? "rgba(15,23,42,0.08)"
            : "rgba(30,64,175,0.3)",
        scaleMargins: { top: 0.12, bottom: 0.08 },
      });
      if (!visible) {
        return;
      }
      const range =
        info?.range ?? computePhaseRange(fallback, info?.meta) ?? undefined;
      const targetScale = scale as unknown as {
        setPriceRange?: (range: { minValue: number; maxValue: number }) => void;
      };
      targetScale.setPriceRange?.({
        minValue: range?.min ?? 0,
        maxValue: range?.max ?? 100,
      });
    };
    applyPriceScale("right", axes?.primary, true, phases);
    const hasSecondary = Boolean(secondaryPhases?.length);
    applyPriceScale("left", axes?.secondary, hasSecondary, secondaryPhases ?? []);
  }, [axes, phases, secondaryPhases]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) {
      return;
    }
    type CrosshairHandler = Parameters<
      NonNullable<ReturnType<typeof createChart>>["subscribeCrosshairMove"]
    >[0];
    const handleCrosshair: CrosshairHandler = (param) => {
      if (!param.time || !param.point) {
        onHoverPhase(null, null);
        return;
      }
      const pointData = seriesRef.current
        ? (param.seriesData?.get(
            seriesRef.current as NonNullable<typeof seriesRef.current>,
          ) as ChartPoint | undefined)
        : undefined;
      const secondaryPoint =
        secondarySeriesRef.current && secondaryPhases && secondaryPhases.length > 0
          ? (param.seriesData?.get(
              secondarySeriesRef.current as NonNullable<typeof secondarySeriesRef.current>,
            ) as ChartPoint | undefined)
          : undefined;
      if (!pointData?.phase && !secondaryPoint?.phase) {
        onHoverPhase(null, null);
        return;
      }
      onHoverPhase(pointData?.phase ?? null, secondaryPoint?.phase ?? null, {
        x: param.point.x,
        y: param.point.y,
      });
    };

    chartRef.current.subscribeCrosshairMove(handleCrosshair);
    return () => {
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshair);
    };
  }, [onHoverPhase, secondaryPhases]);

  return (
    <div className="trend-chart">
      <div ref={containerRef} style={{ width: "100%", minHeight: 360 }} />
    </div>
  );
});

ChartPanel.displayName = "ChartPanel";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<TrendResponse>(sampleResponse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartHandleRef = useRef<ChartPanelHandle | null>(null);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState(placeholderSamples[0]);
  const [supplementText, setSupplementText] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<string[]>([""]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [hoverState, setHoverState] = useState<{
    primary?: Phase;
    secondary?: Phase;
    position?: { x: number; y: number };
  } | null>(null);
  const primaryAxisMeta = result.chart_notes?.primary_axis;
  const secondaryAxisMeta = result.chart_notes?.secondary_axis;
  const shouldClampPrimary = primaryAxisMeta?.kind === "objective" ? false : true;
  const shouldClampSecondary =
    secondaryAxisMeta?.kind === "objective" ? false : true;
  const displayPhases = useMemo(
    () => normalizePhases(result.phases, shouldClampPrimary),
    [result.phases, shouldClampPrimary],
  );
  const displaySecondary = useMemo(() => {
    if (!result.secondary) {
      return undefined;
    }
    return {
      ...result.secondary,
      phases: normalizePhases(result.secondary.phases, shouldClampSecondary),
    };
  }, [result.secondary, shouldClampSecondary]);
  const eventHighlights = useMemo<(TrendEvent & { phaseLabel?: string })[]>(() => {
    const byPhases = displayPhases.flatMap((phase) =>
      (phase.key_events ?? []).map((event) => ({
        ...event,
        phaseLabel: `${result.subject} · ${phase.label}`,
      })),
    );
    const secondaryEvents =
      displaySecondary?.phases.flatMap((phase) =>
        (phase.key_events ?? []).map((event) => ({
          ...event,
          phaseLabel: `${displaySecondary?.subject ?? "对照"} · ${phase.label}`,
        })),
      ) ?? [];
    const combined = [...byPhases, ...secondaryEvents];
    if (combined.length) {
      return combined;
    }
    return (result.events ?? []).map((event) => ({ ...event }));
  }, [displayPhases, displaySecondary, result.events, result.subject]);
  const analysisText = result.overall_analysis ?? result.analysis ?? null;
  const referenceStatus = result.reference_status ?? "empty";
  const referenceSources = result.reference_entries ?? [];
  const referenceErrors = result.reference_errors ?? [];
  const referenceNote = useMemo(() => {
    if (referenceStatus === "success") {
      return "✅ 已参考你提供的资料，AI 将其作为事实锚点。";
    }
    if (referenceStatus === "partial") {
      return "⚠️ 仅部分资料读取成功，下方列出的内容已纳入分析，其余已忽略。";
    }
    if (referenceStatus === "failed") {
      return "❌ 未能成功读取你提供的资料，已回退为公开信息。";
    }
    return "系统基于公开信息与 AI 搜索生成走势。";
  }, [referenceStatus]);
  const showReferenceSources =
    (referenceStatus === "success" || referenceStatus === "partial") &&
    referenceSources.length > 0;
  const primaryRange = useMemo(
    () => computePhaseRange(displayPhases, primaryAxisMeta),
    [displayPhases, primaryAxisMeta],
  );
  const secondaryRange = useMemo(
    () =>
      displaySecondary?.phases
        ? computePhaseRange(displaySecondary.phases, secondaryAxisMeta)
        : null,
    [displaySecondary?.phases, secondaryAxisMeta],
  );
  const chartLegends = useMemo(
    () =>
      displaySecondary
        ? [
            { label: `${result.subject}（主动）`, color: "#ef4444" },
            { label: `${displaySecondary.subject}（对照）`, color: "#16a34a" },
          ]
        : [{ label: `${result.subject}`, color: "#ef4444" }],
    [displaySecondary, result.subject],
  );
  const chartMeta = useMemo(
    () => ({
      title: `${result.subject} · ${result.metric}`,
      timeframe: result.timeframe,
      tag: displaySecondary
        ? `双线对照 · ${result.phases.length} 段`
        : `阶段数：${result.phases.length} 段`,
      legends: chartLegends,
    }),
    [chartLegends, displaySecondary, result.metric, result.phases.length, result.subject, result.timeframe],
  );

  useEffect(() => {
    const randomPlaceholder =
      placeholderSamples[Math.floor(Math.random() * placeholderSamples.length)];
    setPlaceholder(randomPlaceholder);
  }, []);

  useEffect(() => {
    if (!actionHint) {
      return;
    }
    const timer = window.setTimeout(() => setActionHint(null), 2400);
    return () => window.clearTimeout(timer);
  }, [actionHint]);

  const showHint = useCallback((message: string) => {
    setActionHint(message);
  }, []);

  const generateDocumentId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const convertFileToDocument = useCallback((file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("单个文件需小于 2MB，请压缩后再上传。");
    }
    return new Promise<ClientDocument>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const content = result.includes(",")
          ? result.split(",").pop() ?? ""
          : result;
        resolve({
          id: generateDocumentId(),
          name: file.name,
          type: file.type,
          size: file.size,
          content,
        });
      };
      reader.onerror = () => reject(new Error("无法读取文件，请重试。"));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFilesSelected = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) {
        return;
      }
      const remainingSlots = Math.max(0, 5 - documents.length);
      if (remainingSlots === 0) {
        showHint("最多上传 5 份资料。");
        return;
      }
      const files = Array.from(fileList).slice(0, remainingSlots);
      try {
        const parsed = await Promise.all(files.map(convertFileToDocument));
        setDocuments((prev) => [...prev, ...parsed]);
        showHint("资料已添加为分析依据。");
      } catch (err) {
        showHint(err instanceof Error ? err.message : "文件读取失败，请重试。");
      }
    },
    [convertFileToDocument, documents.length, showHint],
  );

  const handleRemoveDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const handleLinkChange = useCallback((index: number, value: string) => {
    setReferenceLinks((prev) => {
      const cloned = [...prev];
      cloned[index] = value;
      return cloned;
    });
  }, []);

  const handleAddLink = useCallback(() => {
    setReferenceLinks((prev) => [...prev, ""]);
  }, []);

  const handleRemoveLink = useCallback((index: number) => {
    setReferenceLinks((prev) => {
      if (prev.length === 1) {
        return [""];
      }
      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  const runGeneration = useCallback(async (input: string) => {
    const cleanQuery = input.trim();
    if (!cleanQuery) {
      setError("请输入一句想要解析的走势描述。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const activeLinks = referenceLinks
        .map((link) => link.trim())
        .filter((link) => Boolean(link));
      const requestPayload = {
        prompt: cleanQuery,
        supplementalText: supplementText.trim() || undefined,
        links: activeLinks,
        documents: documents.map((doc) => ({
          name: doc.name,
          type: doc.type,
          content: doc.content,
        })),
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        const responseBody = await res.json().catch(() => null);
        const detail =
          Array.isArray(responseBody?.details) && responseBody.details.length
            ? `（${responseBody.details.join("；")}）`
            : "";
        throw new Error(
          (responseBody?.error ?? "生成失败，请稍后再试。") + detail,
        );
      }

      const responsePayload = (await res.json()) as TrendResponse;
      if (!responsePayload?.phases?.length) {
        throw new Error("AI 未返回有效走势，请稍后重试。");
      }
      setResult(responsePayload);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "生成失败，请稍后再试。";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [documents, referenceLinks, supplementText]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      runGeneration(query);
    },
    [query, runGeneration],
  );

  const handleDownloadImage = useCallback(async () => {
    const dataUrl = await chartHandleRef.current?.captureImage();
    if (!dataUrl) {
      showHint("暂时无法导出，请稍后再试。");
      return;
    }
    const safeSubject = (result.subject || "trend").trim().replace(/\s+/g, "");
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${safeSubject || "trend"}-kline.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showHint("PNG 已导出");
  }, [result.subject, showHint]);

  const handleCopyJSON = useCallback(async () => {
    const formatted = JSON.stringify(result, null, 2);
    if (!navigator?.clipboard) {
      showHint("浏览器不支持自动复制，请手动复制。");
      return;
    }
    try {
      await navigator.clipboard.writeText(formatted);
      showHint("JSON 已复制");
    } catch {
      showHint("复制失败，请手动复制。");
    }
  }, [result, showHint]);

  const insights = useMemo(() => {
    const phases = displayPhases ?? [];
    if (!phases.length) {
      return null;
    }
    const peakPhase = phases.reduce((prev, curr) =>
      curr.high > prev.high ? curr : prev,
    );
    const basePhase = phases.reduce((prev, curr) =>
      curr.low < prev.low ? curr : prev,
    );
    const first = phases[0];
    const last = phases[phases.length - 1];
    const netChange = last.close - first.open;
    const direction = netChange >= 0 ? "上行趋势" : "回落趋势";
    const volatility =
      phases.reduce((sum, phase) => sum + (phase.high - phase.low), 0) /
      phases.length;

    return {
      peakPhase,
      basePhase,
      netChange: Math.round(netChange),
      volatility: Math.round(volatility),
      direction,
    };
  }, [displayPhases]);

  return (
    <div className="min-h-screen w-full px-4 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="glass-panel hero-panel">
          <div className="flex flex-col gap-8">
            <div className="hero-heading">
              <h1>K线世界</h1>
              <p className="hero-subtitle">一目了然 · Clear at a glance</p>
            </div>

            <form className="input-shell" onSubmit={handleSubmit}>
              <textarea
                rows={2}
                placeholder={`“${placeholder}”`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading ? "生成中..." : "生成走势"}
              </button>
            </form>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="evidence-panel">
              <div className="evidence-header">
                <strong>上传 / 添加资料（可选）</strong>
                <span>AI 会优先阅读这些内容，并将其作为走势锚点</span>
              </div>
              <textarea
                className="support-textarea"
                placeholder="可粘贴采访、剧情梳理、论坛帖子、研报摘要……"
                value={supplementText}
                onChange={(event) => setSupplementText(event.target.value)}
              />
              <div className="link-list">
                {referenceLinks.map((link, index) => (
                  <div key={`link-${index}`} className="link-item">
                    <input
                      type="url"
                      value={link}
                      placeholder="https://example.com/article"
                      onChange={(event) => handleLinkChange(index, event.target.value)}
                    />
                    <button
                      type="button"
                      className="link-remove"
                      onClick={() => handleRemoveLink(index)}
                      disabled={referenceLinks.length === 1 && !referenceLinks[0]}
                    >
                      移除
                    </button>
                    {link.trim() && (
                      <span className="link-status">已作为分析依据</span>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="text-button"
                  onClick={handleAddLink}
                >
                  + 添加链接
                </button>
              </div>
              <label className="upload-tile">
                <input
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  multiple
                  onChange={async (event) => {
                    await handleFilesSelected(event.target.files);
                    event.target.value = "";
                  }}
                />
                <div>
                  <strong>上传文件 / 拖拽到此</strong>
                  <p>支持 PDF / DOCX / TXT / Markdown · 单个文件 ≤ 2MB</p>
                </div>
                <span>已作为分析依据</span>
              </label>
              {documents.length > 0 && (
                <div className="file-list">
                  {documents.map((doc) => (
                    <div key={doc.id} className="file-pill">
                      <div>
                        <strong>{doc.name}</strong>
                        <small>
                          {formatFileSize(doc.size)} · 已作为分析依据
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(doc.id)}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="glass-panel">
          <div className="result-shell">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {result.subject} · {result.metric}
              </h2>
              <div className="result-meta">
                <span className="meta-pill">时间跨度：{result.timeframe}</span>
                <span className="meta-pill">
                  阶段数：{result.phases.length} 段
                </span>
                {result.data_cutoff && (
                  <span className="meta-pill muted">{result.data_cutoff}</span>
                )}
              </div>
            </div>

            <ChartPanel
              ref={chartHandleRef}
              phases={displayPhases}
              secondaryPhases={displaySecondary?.phases}
              axes={{
                primary: { meta: primaryAxisMeta, range: primaryRange },
                secondary: displaySecondary
                  ? { meta: secondaryAxisMeta, range: secondaryRange }
                  : undefined,
              }}
              onHoverPhase={(primary, secondary, position) => {
                if (!primary && !secondary) {
                  setHoverState(null);
                  return;
                }
                setHoverState({
                  primary: primary ?? undefined,
                  secondary: secondary ?? undefined,
                  position,
                });
              }}
              meta={chartMeta}
            />

            <div className="legend-summary">
              {chartLegends.map((legend) => (
                <div key={legend.label} className="legend-pill">
                  <span style={{ background: legend.color }} />
                  {legend.label}
                </div>
              ))}
            </div>

            <div className={`analysis-basis-note reference-${referenceStatus}`}>
              <p>{referenceNote}</p>
              {showReferenceSources && (
                <ul className="reference-sources">
                  {referenceSources.map((entry, index) => (
                    <li key={`${entry.source}-${index}`}>
                      <strong>
                        {entry.type === "text"
                          ? "用户补充文本"
                          : entry.type === "file"
                            ? `文件 · ${entry.source}`
                            : entry.source}
                      </strong>
                      {entry.preview && <span>{entry.preview}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {referenceErrors.length > 0 && (
                <div className="reference-errors">
                  <p>以下资料读取失败，已忽略：</p>
                  <ul>
                    {referenceErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {result.chart_notes && (
              <div className="axis-summary">
                <div className="axis-summary-header">
                  <span className="axis-tag">
                    {result.chart_notes.mode === "dual_axis"
                      ? "双纵轴"
                      : "单纵轴"}
                  </span>
                  {result.chart_notes.rationale && (
                    <p>{result.chart_notes.rationale}</p>
                  )}
                </div>
                <div className="axis-summary-body">
                  <div>
                    <strong>Y1（右）：</strong>
                    <span>{describeAxis(primaryAxisMeta) || result.metric}</span>
                  </div>
                  {secondaryAxisMeta && (
                    <div>
                      <strong>Y2（左）：</strong>
                      <span>{describeAxis(secondaryAxisMeta)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {displaySecondary && (
              <p className="relationship-note">
                {result.relation_summary ??
                  "双线对照模式呈现双方在同一时间线上的牵引关系。"}
              </p>
            )}

            {result.source_digest && (
              <div className="analysis-block source-digest">
                <strong>资料摘要</strong>
                <p>{result.source_digest}</p>
              </div>
            )}

            {result.analysis_modules?.chart_explanation && (
              <div className="analysis-block">
                <strong>图表说明</strong>
                <p>{result.analysis_modules.chart_explanation}</p>
              </div>
            )}

            <div className="action-bar" aria-label="导出工具">
              <button
                type="button"
                className="pill-button"
                onClick={handleDownloadImage}
                disabled={loading}
              >
                导出 PNG
              </button>
              <button
                type="button"
                className="pill-button"
                onClick={handleCopyJSON}
                disabled={loading}
              >
                复制 JSON
              </button>
            </div>

            {insights && (
              <div className="insights-grid" aria-live="polite">
                <article className="insight-card">
                  <span className="insight-label">叙事峰值</span>
                  <strong>{insights.peakPhase.label}</strong>
                  <p>
                    {insights.peakPhase.start_year}-{insights.peakPhase.end_year}
                    · 最高 {insights.peakPhase.high}
                  </p>
                </article>
                <article className="insight-card">
                  <span className="insight-label">情绪谷底</span>
                  <strong>{insights.basePhase.label}</strong>
                  <p>
                    {insights.basePhase.start_year}-{insights.basePhase.end_year}
                    · 最低 {insights.basePhase.low}
                  </p>
                </article>
                <article className="insight-card">
                  <span className="insight-label">整体势能</span>
                  <strong>
                    {insights.direction} ·{" "}
                    {insights.netChange >= 0 ? "+" : ""}
                    {insights.netChange}
                  </strong>
                  <p>平均波动幅度约 {insights.volatility} 点</p>
                </article>
              </div>
            )}

            {eventHighlights.length ? (
              <div className="events-grid">
                {eventHighlights.map((event) => (
                  <article key={event.time + event.description} className="event-card">
                    <span className="event-time">{event.time}</span>
                    <p>{event.description}</p>
                    <small>
                      影响：{event.impact}
                      {event.phaseLabel ? ` · ${event.phaseLabel}` : ""}
                    </small>
                  </article>
                ))}
              </div>
            ) : null}

            {result.analysis_modules?.trend_observation && (
              <div className="analysis-block">
                <strong>走势观察</strong>
                <p>{result.analysis_modules.trend_observation}</p>
              </div>
            )}
            {result.analysis_modules?.relationship_judgment && (
              <div className="analysis-block">
                <strong>关系判断</strong>
                <p>{result.analysis_modules.relationship_judgment}</p>
              </div>
            )}

            <div className="phase-grid">
              {displayPhases.map((phase) => (
                <article
                  key={phase.label}
                  className={`phase-card ${
                    isProjectionPhase(phase) ? "phase-card--projection" : ""
                  }`}
                >
                  <div className="phase-head">
                    <h4>
                      {phase.start_year} - {phase.end_year}
                    </h4>
                    <span className="zone-pill">{resolveZoneLabel(phase)}</span>
                  </div>
                  <p>{phase.label}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    强度范围：{phase.low} - {phase.high} · 收盘 {phase.close}
                  </p>
                </article>
              ))}
            </div>
            {displaySecondary && (
              <>
                <p className="series-label">
                  {displaySecondary.subject} · {displaySecondary.metric}
                </p>
                <div className="phase-grid">
                  {displaySecondary.phases.map((phase) => (
                    <article
                      key={`${displaySecondary.subject}-${phase.label}`}
                      className={`phase-card ${
                        isProjectionPhase(phase) ? "phase-card--projection" : ""
                      }`}
                    >
                      <div className="phase-head">
                        <h4>
                          {phase.start_year} - {phase.end_year}
                        </h4>
                        <span className="zone-pill">{resolveZoneLabel(phase)}</span>
                      </div>
                      <p>{phase.label}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        强度范围：{phase.low} - {phase.high} · 收盘 {phase.close}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}

            <p className="disclaimer">
              本网站展示的是对走势的理解，而非精确数据或事实测量。
            </p>

            {analysisText && (
              <div className="analysis-block">
                <strong>走势解读</strong>
                <p>{analysisText}</p>
              </div>
            )}

            {result.prediction_commentary && (
              <div className="analysis-block prediction">
                <strong>推演判断（非事实）</strong>
                <p>{result.prediction_commentary}</p>
                <small>以下为基于当前信息的推演判断，不构成事实描述。</small>
              </div>
            )}
          </div>
        </section>

        <footer className="footer">
          <strong>另眼观世界 · To see the world from a different perspective</strong>
          <small>Developed by Twitter @linghuchong</small>
        </footer>
      </div>
      <div className="corner-note">
        本网站展示的是对走势的理解，而非精确数据或事实测量。
      </div>
      {actionHint && <div className="action-toast">{actionHint}</div>}
      {hoverState && (
        <div
          className="chart-tooltip"
          style={{
            left: hoverState.position ? hoverState.position.x + 24 : 0,
            top: hoverState.position ? hoverState.position.y + 120 : 0,
          }}
        >
          <strong>{formatPhaseRange(hoverState.primary ?? hoverState.secondary)}</strong>
          {hoverState.primary && (
            <div className="tooltip-line tooltip-primary">
              <div className="tooltip-line-title">🔴 {result.subject}</div>
              <p>{summarizePhaseEvent(hoverState.primary)}</p>
              <span>
                强度：{hoverState.primary.low} - {hoverState.primary.high} · 收盘{" "}
                {hoverState.primary.close}
              </span>
              <span className="tooltip-zone">
                区间标记：{resolveZoneLabel(hoverState.primary)}
              </span>
            </div>
          )}
          {displaySecondary && hoverState.secondary && (
            <div className="tooltip-line tooltip-secondary">
              <div className="tooltip-line-title">
                🟢 {displaySecondary.subject}
              </div>
              <p>{summarizePhaseEvent(hoverState.secondary)}</p>
              <span>
                强度：{hoverState.secondary.low} - {hoverState.secondary.high} · 收盘{" "}
                {hoverState.secondary.close}
              </span>
              <span className="tooltip-zone">
                区间标记：{resolveZoneLabel(hoverState.secondary)}
              </span>
            </div>
          )}
          {(hoverState.primary?.relation_note ||
            hoverState.secondary?.relation_note ||
            result.relation_summary) && (
            <div className="tooltip-relation">
              🧠 关系解读：
              {hoverState.primary?.relation_note ||
                hoverState.secondary?.relation_note ||
                result.relation_summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
