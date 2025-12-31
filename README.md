# K线世界 · Trend Narrator

一句自然语言即可自动生成叙事走势可视化。AI 会解析主体、推断合理的年份跨度、拆解 4-8 个关键阶段，并以 K 线风格输出趋势强度，方便大众“一目了然 / Clear at a glance”。

> 本网站展示的是对走势的理解，而非精确数据或事实测量。

## Features

- 极简输入：一个大输入框 + 示例标签，鼓励用户用自然语言描述人物/事件/抽象概念的走势
- AI 解读：后端调用 DeepSeek Chat，使用严格的 JSON Schema 来约束走势结构
- 可视化：TradingView Lightweight Charts 渲染白底多彩叙事曲线 + 阶段卡片 + 洞察摘要
- 品牌一致：Apple 风格蓝白配色、口号与 Footer 文案统一呈现
- 双线模式：当问题涉及关系/对照时，自动输出红绿双曲线，支持双方 hover 联动与关系解读
- 关键节点浮窗：曲线 hover 时实时显示该阶段的事件说明
- 一键导出：可直接下载 PNG 走势图或复制完整 JSON 数据

## Tech Stack

- Next.js 16（App Router）+ TypeScript
- TradingView Lightweight Charts
- DeepSeek Chat Completions API
- Geist 字体 + 自定义全局样式

## Development

```bash
npm install
cp .env.example .env.local   # 若已存在可直接编辑
npm run dev
```

浏览器访问 http://localhost:3000 ，即可体验示例（页面默认展示 Blackpink 的名气走势）。在输入框输入自己的描述并点击“生成走势”，几秒内即可看到结果。

### Environment Variables

| Key               | Description                                      |
| ----------------- | ------------------------------------------------ |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（形如 `sk-...`，请勿提交到仓库） |

Next.js 默认会从 `.env.local` 读取该变量，部署到线上时请在对应平台的环境配置中设置。

## Scripts

- `npm run dev`：本地开发
- `npm run lint`：ESLint 检查
- `npm run build`：生产构建
- `npm run start`：运行生产构建（需先 build）

> 构建过程中若提示 `Found lockfile missing swc dependencies, patching...`，按照提示再执行一次 `npm install` 即可。

## Usage Flow

1. 输入一句自然语言（示例：`Blackpink 的名气走势`）
2. 点击「生成走势」或选择下方示例标签快速生成
3. AI 返回的阶段立即渲染成单线或双线曲线（根据问题结构），并展示峰值、谷底、整体势能
4. 光标停留在曲线上可查看对应阶段事件；如是双线，Tooltip 会同步展示双主体的拉扯关系
5. 下方列出阶段卡片、关键节点事件和人性化走势解读
6. 如需复用结果，可直接导出带品牌抬头的 PNG 或复制 JSON
7. 页脚与角落小字持续强调：这是叙事理解，不是金融或精确数据

## Next Ideas

- 扩展更多主题模板（情绪指数、品牌声量、城市热度等）
- 支持导出图片 / 分享链接
- 增加多语言 UI 与旁白解读
