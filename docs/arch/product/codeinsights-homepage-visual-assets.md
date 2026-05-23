# CodeInsights 产品主页视觉与素材规范

> 用途：指导产品主页 UI、插画、图形和交互资产制作。
> 设计方向：工程化、可信、现代、开源协作，不做营销感过强的装饰页。

## 1. 视觉关键词

- 工程工作台
- 开源贡献流水线
- 完整 coding agent 运行时
- 人工 gate
- 本地优先
- 可审计、可回退、可验证

## 2. 页面气质

CodeInsights 的主页应像一个面向工程师的产品入口，而不是泛 AI 工具的概念页。

推荐风格：

- 安静、密度适中、以流程和真实界面为中心。
- 使用真实产品 UI、终端、文件树、Pipeline stage rail、review diff 等元素做主视觉。
- 阴影和卡片用于承载信息，不使用过度装饰的渐变球、抽象光斑或纯氛围图。
- 色彩要服务状态表达：探索、规划、开发、审核、测试分别使用不同语义色，不让页面变成单一蓝紫色。

不推荐：

- 只用抽象机器人或大脑图。
- 把首页讲成通用 AI 聊天工具。
- 使用无法说明产品机制的 stock photo。
- 使用过度科技感的深蓝紫渐变作为唯一视觉语言。

## 3. 信息架构布局

### 首屏

首屏应为全幅产品场景，不建议左右分栏把文案和图片割裂开。推荐做法：

- 背景是一张可读的产品工作台合成图：左侧是项目文件树，中间是 Pipeline 阶段轨道，右侧是 agent runtime selector 和 review gate。
- H1 覆盖在场景上方或左上区域，但不能遮挡关键 UI。
- 首屏底部露出下一段 Problem section 的标题或顶部，提示页面可继续向下阅读。

### 中段

中段使用三类模块交替：

1. 观点模块：解释为什么不做通用 Agent 内核。
2. 机制模块：展示 Agent Mode 和 Pipeline Mode。
3. 证据模块：本地优先、artifacts、checkpoint、权限和 gate。

### 末段

末段回到开源贡献结果：从“一个任务”收束为“可复用的贡献工作流”。

## 4. 色彩建议

| Token | 建议色 | 用途 |
|------|--------|------|
| `surface` | `#F8FAFC` | 页面背景 |
| `surface-strong` | `#FFFFFF` | 信息卡片、表格 |
| `ink` | `#0F172A` | 主文本 |
| `muted` | `#475569` | 次级文本 |
| `agent` | `#2563EB` | Agent runtime / 执行能力 |
| `pipeline` | `#059669` | Pipeline / 流程成功 |
| `review` | `#D97706` | Review / gate / 风险提示 |
| `artifact` | `#7C3AED` | 产物、checkpoint、持久化 |
| `danger` | `#DC2626` | 阻塞、失败、权限风险 |

说明：

- 主色不要只依赖单一蓝紫。页面应由中性色承载，功能色用于状态和流程。
- 深色模式可将 `surface` 调整为 `#0B1220`，但正文对比度必须满足可读性。
- 所有状态色必须配合文字或图标，不只依赖颜色区分。

## 5. 字体与密度

推荐：

- 中文：系统字体优先，避免额外字体加载成本。
- 英文产品词：使用同一系统 sans 字体。
- 代码、运行时、路径：使用 mono 字体。

字号建议：

| 场景 | 桌面 | 移动 |
|------|------|------|
| Hero H1 | 56-72px | 40-48px |
| Section title | 36-44px | 28-34px |
| Card title | 18-22px | 17-20px |
| Body | 16-18px | 16px |
| Label | 13-14px | 13-14px |

不要使用随 viewport 线性缩放的字体。长文案容器限制行宽，桌面正文控制在 60-75 个英文字符等效宽度。

## 6. 关键图形资产

### Asset A: Hero 产品工作台合成图

用途：首屏主视觉。

构图：

- 背景：真实工程项目工作台。
- 中心：Pipeline stage rail，显示 Explorer、Planner、Developer、Reviewer、Tester。
- 左侧：文件树和任务上下文。
- 右侧：运行时状态区，当前态显示 Claude Agent SDK / Anthropic 兼容渠道；Codex 标注为 Pipeline Developer / Reviewer 运行时。
- 前景：一个 review gate 浮层，提供 Approve、Rerun、Send feedback 三种动作。

图片生成 prompt：

```text
Create a premium product hero image for a desktop developer tool named CodeInsights. Show a realistic software engineering workspace, not a chatbot. The scene contains a readable five-stage pipeline rail with Explorer, Planner, Developer, Reviewer, Tester, a code diff panel, a local file tree, a runtime status panel showing Claude Agent SDK / Anthropic-compatible Agent mode and Codex for Pipeline Developer / Reviewer, and a human review gate. Style: modern open-source engineering product, clean light surface, sharp typography, subtle shadows, no robots, no abstract glowing orbs, no dark blurry background. The image should feel like a real app screenshot composed for a landing page hero.
```

### Asset B: Runtime 接入图

用途：解释“不做通用 Agent 内核”。

图形结构：

```text
CodeInsights
  -> Agent Mode
    -> Claude Agent SDK / Anthropic-compatible channels
    -> Future: Codex / Custom Agent Runtime
  -> Pipeline Mode
    -> Human Workflow
    -> Claude nodes + Codex Developer / Reviewer
```

视觉建议：

- CodeInsights 位于中间，作为 workspace / orchestration layer。
- 外部 coding agent 运行时位于底部或右侧，强调“接入”而不是“重写”。
- 使用连接线和运行时徽章，不画成传统层级金字塔。

### Asset C: Pipeline 贡献流

用途：中段主图或可交互 section。

阶段：

1. Explorer
2. Planner
3. Developer
4. Reviewer
5. Tester

Outcome：

- 提交材料汇总：patch / PR notes / artifacts。

交互：

- Hover 某个阶段显示输入、AI 工作、产物和人工 gate。
- Developer / Reviewer 之间使用循环箭头表达返工闭环。
- Tester 后显示 artifacts / patch / PR notes，作为上游提交前的材料汇总；它不属于 stage rail，也不表现为自动 PR 提交。

### Asset D: Trust Layer

用途：展示“AI 多做事，但工程师保留控制权”。

元素：

- Permission Queue
- Human Gate
- JSONL Records
- Checkpoint
- Artifacts
- Local Workspace

视觉建议：

- 做成水平能力带，不做成卡片堆。
- 每个元素配 lucide 图标，按钮和图标需要 hover tooltip。

## 7. 首屏 UI 组件建议

| 组件 | 建议 |
|------|------|
| Agent runtime selector | 使用 segmented control 或 command menu，不使用普通文本列表 |
| Pipeline stage rail | 固定高度，阶段点位稳定，不因文字长度改变布局 |
| Gate actions | 三个明确按钮：Approve、Rerun、Feedback |
| 状态徽章 | 使用小号 pill，但避免过多颜色 |
| 代码 diff | 使用真实等宽字体和语义色，不做伪装饰代码 |

## 8. 响应式建议

桌面：

- Hero 使用 12 列网格，文案覆盖在主视觉左上或中心区域。
- Pipeline 流程图可横向展示。

平板：

- Hero 合成图减少右侧细节，保留 stage rail 和 runtime selector。
- Agent Mode 与 Pipeline Mode 可上下堆叠。

移动：

- H1 在首屏上方，产品场景图在下方，但仍属于同一首屏。
- Pipeline 阶段改为纵向 timeline。
- 表格转成 definition list，避免横向滚动。

## 9. 可访问性与性能

- Hero 图片需要真实 `alt`：`CodeInsights 工作台展示 Agent 运行时选择、Pipeline 阶段和人工审核 gate`。
- 所有图形中的关键信息必须在正文中重复出现。
- 图片使用 WebP / AVIF，并提供固定 aspect-ratio，避免 CLS。
- 动画只用于阶段切换、gate 状态变化和运行时选择，不做纯装饰动效。
- 尊重 `prefers-reduced-motion`。
