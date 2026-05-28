# 2026-05-16 全客户端 UI 视觉规范稿

## 1. 背景与目标

本文基于当前 Electron 客户端实现与 `ui-ux-pro-max` 审计维度，整理 CodeInsights 全客户端 UI 的视觉优化规范。目标不是立即改代码，而是在后续实现前先统一设计判断，避免 Pipeline、Agent、Settings、侧边栏和历史 Chat 回退界面继续各自演化。

当前公开主入口是 `Pipeline | Agent`，旧 `chat` 仍作为隐藏回退保留。因此视觉规范需要优先服务长时间工作的桌面生产力场景，而不是营销页面或展示型页面。

本次范围：

- `Pipeline`：任务编排、阶段轨、审核面板、记录流、失败与停止反馈。
- `Agent`：消息阅读、工具活动、输入区、权限请求、AskUser、PlanMode。
- `AppShell / Sidebar / Tab`：三栏容器、多标签、左侧会话导航、右侧文件面板。
- `Settings`：设置弹窗、导航、表单、渠道、Agent 配置、外观与快捷键。
- `Onboarding / Welcome`：首次启动、空状态和引导入口。
- `Chat 回退 / File Browser`：保持一致性，不把旧界面做成另一套视觉语言。

非目标：

- 不新增 public API、IPC、shared type 或 Jotai state。
- 不修改 README / AGENTS。
- 不引入新的状态管理方案。
- 不把本规范写成实现清单；后续开发可从本文拆分任务。

目标视觉方向：现代桌面生产力工具。关键词是中性工作台、清晰层级、克制阴影、语义状态色、可扫描信息密度、稳定的交互反馈。

### 1.1 使用对象与阅读方式

本文面向三类后续使用者：

- 设计与产品判断：用于确认 CodeInsights 不走营销页、炫技面板或一次性 demo 风格。
- 前端实现：用于统一 renderer 组件、Tailwind class、主题 token 和交互状态。
- 评审与验收：用于截图对比、可访问性检查和回归测试前的视觉 checklist。

阅读方式建议：

- 做全局样式时，先看第 3、4、6、7、8 章。
- 做页面改造时，先看第 5 章对应页面，再回到第 4、6 章取 token 与组件规则。
- 做验收时，直接使用第 8、9 章，并补充页面截图矩阵。

### 1.2 成功标准

本方案后续实现成功不以“更花哨”为标准，而以工作效率和一致性为标准：

- 用户打开应用后，3 秒内能辨认当前处于 `Pipeline` 还是 `Agent`。
- 用户进入 Pipeline 后，5 秒内能判断当前阶段、是否等待人工处理、下一步可做什么。
- 用户进入 Agent 后，能区分普通回复、工具活动、权限请求、AskUser 和 PlanMode 状态。
- 用户进入 Settings 后，能快速定位渠道、Agent、外观、更新等设置项，不被卡片层级干扰。
- 浅色、深色和特殊主题之间只改变氛围，不改变控件层级、状态语义和操作可见性。
- 旧 Chat 回退、File Browser 和 Welcome 不再像不同版本残留，而像同一产品的低频入口。

### 1.3 决策边界

后续落地时如果出现冲突，按以下优先级决策：

1. 可读性和状态清晰度优先于装饰性。
2. 键盘可操作和可访问性优先于视觉极简。
3. 现有 Radix / shadcn 风格组件优先于重新造控件。
4. 现有主题 token 优先于组件内新增裸色值。
5. 桌面工作台密度优先于移动端营销页留白。
6. 简单一致的组件规则优先于每个页面单独定制。

## 2. 当前 UI 基线

### 2.1 已具备的优势

- 已使用 React、Tailwind、Radix UI、Lucide、Jotai，基础栈适合做统一设计系统。
- `styles/globals.css` 已有主题 token，包括 `background`、`content-area`、`card`、`popover`、`dialog`、`tooltip`、`primary`、`destructive`。
- `Pipeline` 已从早期日志页演进为阶段轨 + 记录流 + 右侧审核面板的工作台结构。
- `Agent` 已具备全局监听、消息流、工具活动、权限/问答横幅和富文本输入区。
- `Settings` 已沉淀 `SettingsCard`、`SettingsRow`、`SettingsSection` 等可复用 primitive。
- 多主题能力已经存在，浅色、深色、ocean、forest、slate 等主题可作为统一 token 的承载层。

### 2.1.1 基线统一口径

后续审计时不要只看单个页面“是否好看”，需要统一观察这些口径：

- Shell 级别：窗口背景、主面板、侧边栏、右侧面板是否有稳定边界。
- 任务级别：会话、Pipeline record、Agent message、Settings row 是否有统一的信息骨架。
- 状态级别：运行、等待、失败、完成、禁用、空态是否跨页面同义。
- 操作级别：主按钮、次按钮、危险按钮、icon-only 按钮是否能一眼区分。
- 主题级别：浅色、深色、特殊主题下同一组件是否保持相同层级，而不是只在默认主题成立。

### 2.2 主要体验问题

- 圆角、阴影和边框层级不统一。Shell、普通卡片、按钮、输入框、弹窗都在使用不同半径和 shadow，部分区域显得过重。
- 状态色有语义基础，但在不同页面表达不完全一致。Pipeline 使用 sky / amber / rose / emerald，Agent 和 Settings 中仍有局部自定义颜色。
- 信息密度不稳定。侧边栏与 TabBar 偏紧凑，Pipeline 卡片偏松，Settings 在长内容下容易出现“卡片堆叠”感。
- Icon-only 按钮大量存在，部分已有 tooltip，但仍需要统一 `aria-label`、可点击区域和 focus ring。
- 动效节奏不完全统一。Dialog、Popover、ModeSwitcher、输入区状态变化各有 duration 和 easing。
- 特殊主题已经很完整，但 token 使用不够集中，部分组件仍直接写颜色，后续主题扩展会变难。
- 旧 Chat、File Browser、Welcome 与公开主入口的视觉权重不同，容易让产品感觉像多个时期拼在一起。

### 2.2.1 问题优先级

视觉问题按用户影响分为三级：

| 优先级 | 问题类型 | 影响 | 示例 |
| --- | --- | --- | --- |
| P0 | 状态不可判断 | 用户不知道是否在运行、失败、等待自己操作 | Pipeline gate、Agent permission、停止中 |
| P1 | 操作不可预期 | 用户找不到主动作或误点危险动作 | Settings 删除渠道、remote write 确认、文件删除 |
| P2 | 视觉不一致 | 不阻断使用，但削弱专业感和长期舒适度 | 圆角不同、shadow 过重、badge 风格漂移 |

后续实现时先处理 P0 / P1，再做 P2 视觉精修。

### 2.3 设计基线文件

后续实现时优先检查这些入口，而不是从零设计：

- AppShell：`apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- Sidebar：`apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`、`apps/electron/src/renderer/components/pipeline/PipelineSidebar.tsx`
- Main / Tabs：`apps/electron/src/renderer/components/tabs/MainArea.tsx`、`TabBar.tsx`、`TabBarItem.tsx`
- Pipeline：`apps/electron/src/renderer/components/pipeline/`
- Agent：`apps/electron/src/renderer/components/agent/`
- Settings：`apps/electron/src/renderer/components/settings/`
- Theme tokens：`apps/electron/src/renderer/styles/globals.css`
- UI primitives：`apps/electron/src/renderer/components/ui/`

### 2.4 审计维度映射

本文将 `ui-ux-pro-max` 的审计维度映射到 CodeInsights 的客户端场景：

| 审计维度 | 在本客户端中的重点 |
| --- | --- |
| Accessibility | icon-only 按钮、focus ring、状态文本、Dialog 焦点、文件树键盘操作 |
| Touch & Interaction | 虽然是桌面应用，仍需保证 32px 到 36px 高频点击区域和明确 press feedback |
| Layout & Responsive | Electron 窗口缩放、三栏宽度、Settings 长内容、右侧面板折叠 |
| Typography & Color | 长日志、代码、路径、模型名、状态 badge 的可读性 |
| Animation | 只表达状态变化，不做装饰；运行中状态不能靠闪烁制造噪音 |
| Forms & Feedback | 渠道配置、MCP、API Key、代理、Profile、危险操作确认 |
| Navigation | Pipeline / Agent 模式切换、多标签、会话列表、设置导航、文件树定位 |
| Performance | 长消息、长记录、文件树和 Settings 长列表需要稳定滚动与虚拟化预案 |

### 2.5 当前风格需要保留的资产

- 多主题能力：保留 ocean、forest、slate 等主题的差异，但让差异由 token 承载。
- 三栏工作台：保留 AppShell 的桌面感，减少页面级重新布局。
- Pipeline 阶段概念：阶段轨是核心产品识别，不应弱化成普通日志列表。
- Agent 透明度：工具活动、权限请求和 PlanMode 是可信度来源，不应为了简洁完全隐藏。
- 本地优先语气：文案应强调本地工作区、可恢复、可审计，而不是云服务式营销话术。

### 2.6 代码落地映射表

后续实现时建议先按组件层收敛，再进入页面层。下面的映射表用于把本规范落到具体代码入口，避免每个页面重复造样式。

| 规范对象 | 优先检查文件 / 目录 | 建议改造重点 | 顺序 |
| --- | --- | --- | --- |
| Theme tokens | `apps/electron/src/renderer/styles/globals.css` | surface、status、focus、motion、特殊主题 fallback | 1 |
| Button / Icon button | `apps/electron/src/renderer/components/ui/button.tsx`、相关调用点 | size、variant、focus ring、loading、icon-only aria | 1 |
| Card / Surface | `apps/electron/src/renderer/components/ui/`、页面局部 card class | radius、shadow、border、padding、嵌套卡片治理 | 1 |
| Dialog / Popover / Tooltip | `apps/electron/src/renderer/components/ui/` | z-index、motion、overlay、tooltip delay、a11y title | 1 |
| Settings primitives | `apps/electron/src/renderer/components/settings/primitives/` | SettingsSection、SettingsCard、SettingsRow、表单错误和 helper text | 2 |
| AppShell | `apps/electron/src/renderer/components/app-shell/` | 三栏宽度、sidebar density、mode switcher、右侧面板层级 | 2 |
| Tabs | `apps/electron/src/renderer/components/tabs/` | active / running / blocked / failed indicator、close button、focus | 2 |
| Pipeline | `apps/electron/src/renderer/components/pipeline/` | StageRail、Records、Gate、失败 / 停止 / blocked 状态 | 3 |
| Agent | `apps/electron/src/renderer/components/agent/` | Message、ToolActivity、Composer、Permission / AskUser / PlanMode banner | 3 |
| AI content | `apps/electron/src/renderer/components/ai-elements/`、`packages/ui` | Markdown、CodeBlock、Mermaid、reasoning、长文本阅读宽度 | 3 |
| File Browser | `apps/electron/src/renderer/components/file-browser/` | tree row、selected / hover / focus、path chip、delete confirm | 4 |
| Chat 回退 | `apps/electron/src/renderer/components/chat/` | 对齐 Agent composer、message、tool activity，不新增独立视觉语言 | 4 |
| Onboarding / Welcome | renderer 入口与 welcome 相关组件 | 空态动作、环境检查、设置入口、非 hero 化 | 4 |

落地原则：

- 先改 primitive，再改页面调用点；页面局部 class 只能作为过渡。
- 同一轮不要同时重构业务状态和视觉层，除非两者天然绑定。
- 任何新增视觉 token 都必须在 light、dark、特殊主题中有 fallback。
- 若发现某个页面需要例外，先确认是否是信息结构问题，而不是单独加样式。

## 3. 设计原则

### 3.1 工作台优先

CodeInsights 的主体验是反复查看、执行、审核和恢复任务。页面应该像一个安静可靠的控制台，而不是一个展示型产品首页。

规范：

- 首屏直接进入可操作内容，不做营销式 hero。
- 状态、任务、产物和下一步动作优先于装饰。
- 重要操作始终可见，次要信息折叠或降低权重。
- 每个主页面只保留一个最高优先级动作。

### 3.2 信息层级先于装饰

页面层级用尺寸、间距、透明度、阴影和语义色建立，不靠大面积渐变或饱和色块。

规范：

- 大面积背景使用 neutral surface。
- 状态色只表达状态，不作为装饰色。
- 对同一层级使用同一 radius、shadow 和 border 策略。
- 文本优先可读，避免过低对比度的 gray-on-gray。

### 3.3 长时间使用舒适

这是桌面应用，用户可能长时间看日志、审查文档和读 Agent 输出。

规范：

- 主内容文字保持 14px 到 15px，正文 line-height 1.6。
- 代码、日志、时间戳使用 tabular numbers 或 monospace，避免跳动。
- 滚动区域必须明确，避免多层嵌套滚动互相抢焦点。
- 运行中状态需要持续反馈，不能只显示空面板。

### 3.4 主题可扩展

现有特殊主题是产品资产，后续优化必须保留主题表达，但组件不应直接依赖某个主题色。

规范：

- 组件只使用 semantic token，避免新增裸 hex。
- 特殊主题只在 `globals.css` 中做 token 或少量 class 覆盖。
- 所有状态色都要同时验证浅色、深色和特殊主题。

### 3.5 可访问性默认合格

高质量 UI 不只看起来漂亮，也要能键盘操作、能被读屏理解、状态可被感知。

规范：

- 正文对比度目标 4.5:1 以上。
- Icon-only 按钮必须有 tooltip 和 `aria-label`。
- 所有可交互元素 focus visible 必须清晰。
- 运行、停止、失败、等待人工审核等状态要有 `aria-live` 或可感知文本。

### 3.6 设计不变量

后续实现可以调整具体组件，但这些不变量不能改变：

- `Pipeline | Agent` 是公开主入口，视觉优先级高于旧 Chat。
- 主工作区优先承载任务和输出，不放装饰性 hero、营销文案或大插画。
- 三栏布局是桌面心智：左侧导航、中间工作、右侧上下文/文件/审核。
- 状态色一旦定义，跨 Pipeline、Agent、Settings、File Browser 语义保持一致。
- 一个视图内只允许一个 primary action，其余动作必须降级。
- 高风险动作必须有明确二次确认和可读风险说明。

### 3.7 信息降噪规则

生产力 UI 的“高级感”主要来自减噪：

- Raw id、enum、session id 默认隐藏，必要时放在 tooltip、详情或复制入口中。
- 时间戳默认弱化，只有排序、审计或失败排查时提升权重。
- 工具调用输出默认摘要化，展开后再展示完整内容。
- 多个成功状态不连续刷屏；短暂 toast 或静态 badge 即可。
- 失败状态必须可读，不能只输出技术栈错误。
- 右侧面板只展示当前上下文相关操作，历史记录放回中间主区。

### 3.8 文案与命名

文案风格应短、确定、面向动作：

| 场景 | 推荐文案 | 避免 |
| --- | --- | --- |
| Pipeline 等待审核 | 等待你审核计划 | Pending gate |
| Agent 权限请求 | 需要允许读取文件 | Permission required |
| 停止中 | 正在停止... | Loading |
| 测试连接失败 | 连接失败，检查 API Key 或 Base URL | Error |
| 危险确认 | 确认删除此渠道 | Are you sure? |

规范：

- UI 主文案优先中文，必要英文专业词保留。
- 状态文案使用动词或结果，不只写抽象状态名。
- 错误文案包含原因和下一步，不把 stack trace 放在默认层。
- 按钮文案使用动词短语，例如“开始 Pipeline”“允许一次”“保存设置”。

## 4. 全局视觉系统

### 4.1 Surface 层级

建议把全客户端 surface 固定为 5 层：

| 层级 | 用途 | 建议 token |
| --- | --- | --- |
| App background | 窗口外层、三栏间隙 | `background` 或主题化 `.shell-bg` |
| Content area | 主内容容器、右侧面板 | `content-area` |
| Card | 单个任务、记录、设置分组 | `card` |
| Elevated | Popover、Select、Preview | `popover` |
| Modal | Settings、AlertDialog、ImageLightbox | `dialog` 或 `background` |

规范：

- Shell 面板可以保留 16px radius，作为应用大框架。
- 普通卡片建议统一到 8px radius；需要强调的审核面板最多 12px。
- 不在页面 section 外层再套装饰卡片，避免卡片套卡片。
- `border` 用于结构边界，`shadow` 用于浮层和可拖动/可叠放对象。

### 4.2 圆角系统

| 场景 | 半径 |
| --- | --- |
| 小图标按钮、badge、菜单项 | 6px |
| 普通按钮、输入框、卡片 | 8px |
| 输入 Composer、Popover、Select | 10px 到 12px |
| AppShell 主面板、Settings Dialog | 16px |
| 圆形按钮或头像 | 使用真实圆形或头像专属比例 |

规范：

- 不再新增 `rounded-2xl` 作为普通卡片默认值。
- 不再用大圆角掩盖层级问题。
- 卡片内容越密，圆角越小。

### 4.3 阴影系统

| 名称 | 用途 | 视觉目标 |
| --- | --- | --- |
| `shadow-minimal` | 普通卡片 | 轻微抬起，不抢内容 |
| `shadow-sm` | 输入框、按钮、浅浮起卡片 | 表达可交互 |
| `shadow-xl` | Shell 主面板、侧栏 | 区分应用框架 |
| `shadow-2xl` | Dialog、预览浮层 | 明确遮盖上下文 |

规范：

- 普通记录卡片优先用 border + subtle background，不默认 heavy shadow。
- Modal 可以强阴影，但 overlay 透明度保持轻，不把桌面应用压成网页弹窗。
- 深色主题阴影要配合边框或内描边，否则层级不可见。

### 4.4 色彩系统

基础 token：

- 主文本：`foreground`
- 次文本：`muted-foreground`
- 面板：`background`、`content-area`、`card`
- 分隔：`border`
- 交互主色：`primary`
- 危险操作：`destructive`
- Focus：`ring`

语义状态：

| 状态 | 色相 | 用途 |
| --- | --- | --- |
| Running | sky / blue | 节点运行、流式生成、活动中 |
| Waiting / Blocked | amber | 等待人工审核、权限请求、配置缺失 |
| Failed / Danger | rose / destructive | 失败、删除、回退、不可恢复动作 |
| Success | emerald | 完成、通过、保存成功 |
| Neutral / Idle | zinc / muted | 空闲、归档、未开始 |

规范：

- 状态必须同时有文本或图标，不只靠颜色。
- 大面积背景不使用 rose、amber、emerald；只在状态卡片和 badge 中使用。
- 禁止新增一整屏单色调主题。已有特殊主题应通过 token 表达，不在组件内硬写主题分支。

### 4.5 字体与排版

建议字号：

| 场景 | 字号 |
| --- | --- |
| 辅助标签、时间戳 | 11px 到 12px |
| Sidebar item、Tab title、badge | 12px 到 13px |
| 正文、表单、按钮 | 14px |
| 区块标题 | 15px 到 16px |
| 页面主标题 | 18px 到 20px |

规范：

- 不使用 viewport width 缩放字体。
- 字间距默认 0；仅 uppercase 小标签可轻微增加，但不超过 `0.12em`。
- 日志、token、时间和计数使用 `tabular-nums`。
- 长标题优先 truncate，并在 tooltip 或详情中提供完整文本。

### 4.6 间距与密度

基础使用 4px / 8px spacing scale：

- 小控件内部：4px 到 6px。
- 普通行：8px 到 12px。
- 卡片 padding：12px 到 16px。
- 页面区域 gap：16px。
- 大面板外边距：8px 到 12px，保持桌面应用紧凑感。

规范：

- Sidebar 与 TabBar 保持紧凑，但点击区域不能低于 32px，高频按钮目标 36px 以上。
- 主要操作按钮高度保持 36px 到 40px。
- 触控不是第一目标，但 icon-only 按钮仍建议 `36x36`，最小不低于 `32x32`。

### 4.7 图标系统

规范：

- 默认使用 Lucide，保持同一 stroke 风格。
- 普通按钮图标 16px，工具栏图标 18px 到 20px，状态圆点图标 12px 到 14px。
- 禁止用 emoji 作为功能图标。
- Icon-only 按钮必须提供 tooltip；关键按钮补 `aria-label`。

### 4.8 Layout Grid 与容器宽度

桌面端主布局建议采用“固定导航 + 弹性工作区 + 可折叠上下文”的结构：

| 区域 | 建议宽度 / 行为 |
| --- | --- |
| LeftSidebar | 64px 到 76px；只放模式、设置、全局入口 |
| Session / Pipeline Sidebar | 260px 到 320px；允许折叠或由 AppShell 控制隐藏 |
| MainArea | 弹性填满；最小可用宽度不低于 560px |
| RightSidePanel | 300px 到 420px；窄窗口下可收起为按钮入口 |
| Settings Dialog | 宽屏 880px 到 1040px；高度不超过视口 88% |

规范：

- Electron 窗口缩小时，优先收起右侧面板，再压缩 session sidebar，最后才压缩主内容。
- MainArea 不使用过宽行长；长文本内容内部最大阅读宽度控制在 760px 到 880px。
- 代码、日志、record 列表可占满宽度，但正文段落需要 line length control。
- 使用 `min-h-dvh` 或等价策略处理窗口高度，不依赖固定 `100vh` 导致底部遮挡。

### 4.9 Z-index 与浮层顺序

建议统一浮层顺序：

| 层级 | 用途 |
| --- | --- |
| 0 | 普通页面内容 |
| 10 | Sticky header、TabBar、Composer |
| 20 | Dropdown、Select、Tooltip trigger overlay |
| 30 | Popover、Command palette、context menu |
| 40 | Right panel overlay、drawer |
| 50 | Dialog、AlertDialog |
| 60 | Toast、全局错误提示 |

规范：

- Tooltip 不应覆盖 Dialog 关键按钮。
- Toast 不应遮挡 Pipeline gate 或 Agent permission 主按钮。
- Composer sticky 需要避开底部 safe area 和浮动 toast。
- 不在组件内随意使用超大 z-index。

### 4.10 状态配方

所有页面使用同一套状态配方：

| 状态 | 图标建议 | 背景 | 边框 / 强调 | 文案方式 |
| --- | --- | --- | --- | --- |
| Idle | Circle / Clock | neutral soft | muted border | “未开始”“空闲” |
| Running | Loader / Activity | sky soft | sky accent | “正在运行”“生成中” |
| Waiting | Hourglass / Hand | amber soft | amber accent | “等待你处理” |
| Blocked | AlertTriangle | amber / rose soft | amber or rose | “被阻塞，需配置...” |
| Success | CheckCircle | emerald soft | emerald accent | “已完成”“保存成功” |
| Failed | XCircle / CircleAlert | rose soft | destructive accent | “失败，原因...” |
| Stopped | Square | neutral soft | muted border | “已停止，可重新开始” |

规范：

- 状态卡片包含标题、简短说明、下一步动作；badge 只用于列表摘要。
- Running 可以动，Waiting 只做静态强调，Failed 不做闪烁。
- Blocked 和 Failed 需要分开：Blocked 表示用户或配置可恢复，Failed 表示执行已失败。
- Success 不需要大面积绿色，避免成功记录压过正在处理的信息。

### 4.11 Focus Ring 与交互态

统一交互态：

- Hover：背景轻微提高，文字不变色或只提高对比。
- Pressed：使用轻微 scale 或 background darken，时长 80ms 到 120ms。
- Focus-visible：2px ring，颜色来自 `ring`，外侧保留 2px offset。
- Disabled：opacity 0.45 到 0.55，同时禁用 cursor 和事件。
- Selected：使用 soft primary background + 左侧或底部 accent，不只改变文字颜色。

规范：

- focus ring 不应被 `overflow-hidden` 裁掉。
- 选中态和 hover 态必须同时可区分。
- 对 icon-only 按钮，hover tooltip 不替代 keyboard focus name。
- 对可排序列表和文件树，focus item 需要和 selected item 同时可见。

### 4.12 Loading / Empty / Error / Success

每个主要区域需要固定状态模板：

| 模板 | 内容结构 | 使用场景 |
| --- | --- | --- |
| Loading | skeleton / spinner + 正在做什么 | 加载会话、运行节点、测试连接 |
| Empty | 简短标题 + 一句话 + 一个主动作 | 无会话、无工作区、无文件、无渠道 |
| Error | 错误标题 + 原因 + 下一步 + 详情折叠 | SDK 失败、连接失败、文件读取失败 |
| Blocked | 阻塞原因 + 修复入口 | 未配置渠道、缺少工作区、权限等待 |
| Success | 结果摘要 + 后续动作 | 保存成功、测试通过、提交完成 |

规范：

- Empty state 不放长篇教学，最多 2 到 3 个动作。
- Error 默认展示用户可理解摘要，详情放进 collapsible。
- Loading 超过 1 秒使用 skeleton 或进度说明，不能只空白。
- Success 只在用户需要确认结果时出现，普通保存可使用 inline feedback。

### 4.13 主题一致性规则

主题实现应满足：

- 同一个 token 在所有主题里表达同一语义，例如 `primary` 永远是主交互色。
- 特殊主题可以改变 chroma 和氛围，但不能降低正文对比度。
- 状态色不跟随主题完全变色；Running / Waiting / Failed / Success 的语义色相保持稳定。
- 组件内不新增 `dark:` 分支来修补单个主题，除非这个差异不可由 token 表达。
- 新增 token 时同时定义 light、dark 和所有特殊主题 fallback。

建议主题检查矩阵：

| 主题 | 必看页面 |
| --- | --- |
| light | Pipeline、Agent、Settings |
| dark | Pipeline 失败态、Agent 工具活动、Settings 表单 |
| ocean | AppShell、TabBar、Permission banner |
| forest | File Browser、Success / Done 状态 |
| slate | 长文本、日志、代码块 |

### 4.14 数据与代码显示

CodeInsights 会频繁显示路径、命令、模型、日志和代码。规范如下：

- 路径使用 monospace chip，允许中间省略，hover 展示完整路径。
- 命令输出默认使用等宽字体，行高 1.55，最大高度后滚动。
- JSON / Markdown / diff 输出用代码块承载，避免放进普通段落。
- 数字、耗时、token 数、任务计数使用 `tabular-nums`。
- 错误详情默认折叠，标题展示可读摘要和错误来源。

### 4.15 Design Token 契约

后续实现建议把 token 分成“已有 token 继续使用”和“建议新增语义 alias”两层。新增 alias 不要求一次完成，但不要在组件里用裸色值绕过它。

| Token | 类型 | 语义 | 首批使用位置 |
| --- | --- | --- | --- |
| `--surface-app` | color | 应用最外层背景，可映射到现有 `background` / `.shell-bg` | AppShell |
| `--surface-panel` | color | 三栏面板和主内容容器 | MainArea、RightSidePanel |
| `--surface-card` | color | 普通卡片、记录、设置分组 | PipelineRecords、SettingsCard |
| `--surface-muted` | color | 轻量分组、代码块外层、chip | PathChip、ToolActivity |
| `--surface-elevated` | color | popover、select、menu | Popover、Select、Dropdown |
| `--surface-modal` | color | dialog、alert dialog | SettingsDialog、AlertDialog |
| `--text-primary` | color | 主文本，映射 `foreground` | 全局 |
| `--text-secondary` | color | 次文本，映射 `muted-foreground` | meta、description |
| `--text-tertiary` | color | 时间戳、低权重辅助信息 | record meta、file meta |
| `--border-subtle` | color | 普通结构分隔 | Card、Sidebar |
| `--border-strong` | color | active、focus 附近辅助边界 | selected row、active tab |
| `--focus-ring` | color | 键盘 focus | 所有交互元素 |
| `--status-running` | color | 运行中 | Pipeline、Agent、Tab |
| `--status-waiting` | color | 等待用户或权限 | Gate、Permission |
| `--status-success` | color | 完成、保存成功 | Done、Saved |
| `--status-danger` | color | 失败、危险操作 | Error、Delete |
| `--status-neutral` | color | 停止、空闲、归档 | Stopped、Idle |
| `--radius-card` | length | 普通卡片圆角 | Card、Records |
| `--radius-control` | length | Button、Input、Menu item | UI primitives |
| `--radius-panel` | length | Shell 面板、Dialog | AppShell、SettingsDialog |
| `--shadow-card` | shadow | 普通卡片轻阴影 | SettingsCard、Record |
| `--shadow-panel` | shadow | Shell 大面板 | AppShell |
| `--shadow-modal` | shadow | Dialog / Preview | Modal |
| `--motion-fast` | time | hover / press | Button、row |
| `--motion-normal` | time | popover / accordion | UI primitives |
| `--motion-slow` | time | dialog / panel | Dialog、SidePanel |

落地策略：

- 第一轮可以先在 Tailwind class / CSS variable 中形成 alias，不要求立即改完所有调用点。
- 状态色 token 需要有 foreground / background / border 三件套，例如 `--status-running-bg`、`--status-running-fg`、`--status-running-border`。
- token 命名使用语义，不使用具体色相，例如不要把 `--status-running` 命名为 `--blue-500`。
- 特殊主题只覆盖 token，不覆盖具体组件 class。

### 4.16 量化默认值

为减少实现时的范围漂移，后续第一轮 UI 改造建议采用这些默认值；只有明确场景需要时才使用范围值。

| 项目 | 默认值 | 例外 |
| --- | --- | --- |
| 普通卡片 radius | 8px | 重要审核 / 失败面板可 12px |
| 控件 radius | 8px | icon button 可 6px，composer 可 12px |
| Shell panel radius | 16px | 窄窗口可降到 12px |
| Button height | 36px | 主动作 40px，紧凑操作 32px |
| Icon button size | 36px | 表格 / 文件树行内操作可 32px |
| Input height | 36px | 多行 composer 自适应 |
| Sidebar item height | 40px | 紧凑列表 32px 到 36px |
| Tab item height | 34px | 运行状态 indicator 不改变高度 |
| Settings row min height | 56px | 长描述允许增高 |
| Card padding | 12px | 信息密集卡片 10px，宽松审核卡片 16px |
| Page / panel gap | 12px | 大内容区可 16px |
| Body font size | 14px | 长阅读正文可 15px |
| Meta font size | 12px | 最小不低于 11px |
| Icon size | 16px | toolbar 18px，状态点 12px |
| Focus ring | 2px + 2px offset | 高对比主题可 3px |
| Tooltip delay | 400ms | 危险按钮可更短但不低于 250ms |
| Hover motion | 100ms | reduced motion 下可直接切换 |
| Dialog motion | 200ms | reduced motion 下只保留 opacity |

这些默认值应优先进入 primitive 或 shared class，而不是散落在页面局部。

## 5. 核心页面规范

### 5.1 AppShell / Sidebar / Tab

目标：三栏是应用的稳定骨架，不能像临时布局。用户要能快速判断当前模式、会话、工作区、后台状态和打开的标签。

规范：

- 外层 `.shell-bg` 继续承担主题氛围，但饱和度要低，不能抢主内容。
- 左侧 Sidebar 与 PipelineSidebar 使用同一导航密度、选中态、hover 态和归档入口。
- ModeSwitcher 保留滑块交互，但选中态颜色必须来自 `primary` 或主题覆盖。
- TabBar 当前 active tab 需要和主 `content-area` 连成一体；非 active tab 只保留轻 hover。
- Tab 运行状态用底部细线或小状态点，避免整块染色。
- 右侧 SidePanel 与 MainArea 使用同级 shell panel 视觉，不做嵌套卡片。

状态规范：

- Running：蓝色细线 + pulse，仅用于正在运行的 tab。
- Blocked：amber 细线 + 文案 tooltip。
- Completed：emerald 静态点或细线，查看后回到 neutral。
- Failed：rose 点，必须能进入错误详情或对应 session。

结构细节：

- LeftSidebar 顶部固定品牌 / mode 入口，中部放 Pipeline / Agent，底部放 Settings、更新、Profile。
- 会话侧栏顶部保留搜索与新建入口，列表区滚动，底部保留归档或低频操作。
- TabBar 每个 tab 结构固定为 icon / title / dirty 或 running indicator / close，避免不同 tab 宽度突然跳动。
- MainArea header 如果存在，只承载当前任务摘要和少量动作，不重复 Sidebar 信息。
- RightSidePanel header 显示当前上下文，例如“文件”“审核”“详情”，空态时显示收起说明和入口。

密度建议：

| 元素 | 高度 / 间距 |
| --- | --- |
| LeftSidebar icon button | 40px 到 44px |
| Session item | 36px 到 44px |
| Compact session item | 32px |
| TabBar | 36px 到 42px |
| Tab item | 32px 到 36px |
| Panel header | 44px 到 52px |

验收口径：

- 任何窗口宽度下，当前模式、当前 session、当前 tab 三个上下文都能被识别。
- 后台运行 tab 有可见状态，但不会把整个 TabBar 染成状态色。
- 右侧面板为空时不留下大面积无解释空白。

### 5.2 Pipeline

目标：从“记录查看器”升级为“贡献工作流控制台”。用户优先看到当前阶段、当前需要的决策、产物和失败恢复路径。

布局规范：

- 顶部：Header + StageRail 保持固定心智，表达任务、状态和进度。
- 主区：Records / live output 是主要阅读区。
- 右侧：Gate / Review / Tester / Committer / Composer 是当前操作区。
- 运行中 Composer 降低权重，突出当前节点和实时输出。

StageRail 规范：

- 每个阶段使用图标 + 中文标签 + 简短状态，不把 raw node enum 作为主文案。
- 节点连接线表达完成进度。
- Waiting gate 节点使用 amber，Failed 节点使用 rose，Done 使用 emerald。
- 点击阶段用于过滤或定位 records，必须有 focus ring。

Records 规范：

- 默认按阶段聚合，系统事件、用户输入、产物和错误用不同 badge。
- live output 面板必须区分“节点正在准备”和“模型已有输出”。
- 长日志默认折叠，产物和失败摘要默认展开。
- 复制、打开产物目录、定位错误等操作使用 icon + tooltip。

Gate 面板规范：

- 人工审核卡片永远在右侧操作区优先展示。
- Approve 使用 emerald，Reject / Rerun 使用 neutral 或 destructive，不能三个按钮同等重量。
- 反馈输入框必须有 label，不只靠 placeholder。
- 对 test blocked、remote write confirmation 等高风险 gate，明确风险文本和二次确认。

失败与停止规范：

- 失败卡片提供：失败阶段、用户可读原因、最近输出摘要、定位错误、重试或打开设置。
- 停止中状态立刻显示，按钮文案从“停止运行”变为“正在停止...”。
- 已停止不是错误态，用 neutral notice 表达可修改任务后重新开始。

记录卡片 anatomy：

- Header：阶段标签、记录类型、时间、状态 badge。
- Body：用户可读摘要或主要输出。
- Metadata：产物路径、模型、耗时、节点名等低权重信息。
- Actions：复制、展开、定位、打开产物、重试。

记录类型建议：

| 类型 | 默认展示 |
| --- | --- |
| User input | 用户输入摘要，保留原文展开 |
| Node start | 阶段开始说明，低权重 |
| Text delta / output | 合并成可读段落或 live output |
| Artifact | 产物标题、路径、打开动作，默认展开 |
| Gate | 审核要求、风险、可选动作，右侧面板同步 |
| Error | 可读原因、失败阶段、详情折叠，默认展开 |
| Stop / Resume | 中性 notice，说明恢复方式 |

Gate 模板：

- `plan_review`：展示计划摘要、风险、将修改的范围、Approve / Request changes。
- `document_review`：展示文档或测试证据摘要、通过条件、阻塞原因输入。
- `submission_review`：展示本地 commit / 远端 PR 预览、风险确认、二次确认控件。
- `remote_write_confirmation`：使用高风险视觉，展示 remote、branch、commit、PR title，不允许隐藏风险。

Pipeline 空态：

- 无会话：主动作“新建 Pipeline”，次动作“打开 Agent”或“配置渠道”。
- 有会话但无记录：显示任务标题、创建时间、继续 / 重新开始入口。
- 配置缺失：显示缺少渠道、模型或工作区，并直接链接 Settings 对应 tab。

Pipeline 验收口径：

- 运行中没有模型输出时，用户能看到“节点已启动，正在等待模型输出”这类明确说明。
- 等待人工审核时，右侧操作区比记录流更醒目。
- 失败后用户能找到失败阶段、原因、最近输出和恢复动作。
- 停止后状态不是失败色，不误导用户认为任务崩溃。

### 5.3 Agent

目标：Agent 是长文本、工具调用和用户交互混合的阅读工作区。重点是降低噪音、保留运行透明度、让输入区稳定可靠。

消息区规范：

- 用户消息和 Agent 消息保持明显但克制的角色区分。
- 工具活动默认折叠成可扫描列表，失败工具结果默认展开摘要。
- 生成图片、文件引用、命令输出等富内容使用固定尺寸或最大宽度，避免布局跳动。
- Sticky user message 与 scroll minimap 要服务定位，不要抢正文视觉。

输入区规范：

- Composer 保持底部稳定，不随附件、建议、PlanMode 轻易改变整体高度。
- 附件预览使用 chip 或缩略图，文件名可读，删除按钮可键盘操作。
- `/ Skill`、`# MCP`、`@ file` 提示属于辅助信息，不应撑满 placeholder。
- 发送、停止、附件、文件夹、思考模式、权限模式都使用统一 icon button 尺寸。

Banner 规范：

- Permission、AskUser、ExitPlanMode、PlanMode 统一为横幅组件族。
- Waiting / permission 用 amber 或 primary soft background，危险确认才使用 destructive。
- 横幅必须清楚说明“等待谁做什么”，并把主按钮放在右侧或底部固定位置。
- PlanMode 虚线边框可保留，但应只表达模式，不作为长期闪烁装饰。

工具活动规范：

- 工具状态分为 running、success、warning、error、background。
- 运行中显示 spinner 和 elapsed time；后台任务显示可进入 BackgroundTasksPanel 的入口。
- 工具输入输出中的路径、命令、文件名使用 monospace 或 path chip。

消息 anatomy：

- Sender：用户、Agent、System / Tool，用低权重标签或头像区分。
- Content：Markdown、代码块、Mermaid、推理折叠、文件引用。
- Meta：模型、时间、耗时、token 或工具数量，默认弱化。
- Actions：复制、重试、继续、引用、展开推理。

消息阅读规范：

- 用户消息可以使用轻背景块，但不要像聊天气泡那样过度圆润。
- Agent 长回复默认占主阅读宽度，代码块和表格可突破到更宽容器。
- Reasoning / thinking 默认折叠，标题显示摘要和耗时。
- 工具活动与正文之间保持清楚边界，避免用户误读工具输出为 Agent 结论。

Composer 状态：

| 状态 | 表现 |
| --- | --- |
| Ready | placeholder 简短，工具栏完整 |
| Attachment pending | 附件 chip 在输入上方，发送按钮仍可见 |
| Sending | 发送按钮变停止或 loading，输入仍可读 |
| Waiting permission | Composer 降权，Permission banner 升权 |
| PlanMode | 顶部或输入区提示当前模式，不改变整体布局 |
| Disabled | 明确说明原因，例如“请选择工作区” |

权限与 AskUser：

- Permission banner 展示工具名、路径/命令摘要、风险级别和允许方式。
- AskUser banner 展示问题原文、回答输入和发送动作，不和普通 Composer 混淆。
- ExitPlanMode 展示计划摘要和“继续执行 / 修改计划”两个清晰动作。
- 后台会话的权限请求在 Sidebar / TabBar 有 amber indicator，回到会话后 banner 保持原位置。

Agent 验收口径：

- 用户能分清“Agent 正在想”“工具正在跑”“应用在等用户授权”。
- 工具失败默认展示摘要，不需要先展开才能知道失败原因。
- 输入区在附件多、权限等待、PlanMode 之间切换时不大幅跳动。
- 后台运行状态能在 tab 或 session item 中被发现。

### 5.4 Settings

目标：设置页是高密度管理界面，需要清楚、稳定、可恢复，而不是卡片堆叠。

Dialog 规范：

- SettingsDialog 保持居中浮窗，但内容高度要保证长页面滚动自然。
- 左侧导航固定宽度，当前 tab 高亮明确；有更新或环境问题时使用小状态点 + tooltip。
- 顶部 title 只显示当前 tab，不放过多说明。

表单规范：

- `SettingsSection` 控制一级信息分组。
- `SettingsCard` 用于一组相关设置，不在卡片内再放装饰卡片。
- `SettingsRow` 左侧 label + description，右侧控件，移动或窄宽时允许换行。
- Secret、API Key、Base URL、MCP command 等字段必须有持久 label 和 helper text。
- 危险操作和删除操作使用 destructive 文案与确认，不只改变 icon 颜色。

状态规范：

- 保存中、测试中、连接成功、连接失败都需要 inline feedback。
- 未保存更改拦截保留，但按钮文案要明确“留在当前页”和“放弃并离开”。
- 长列表如渠道、MCP、Skills、快捷键要支持扫描：名称、状态、更新时间/来源、主要操作。

Tab 级规范：

| Tab | 视觉重点 |
| --- | --- |
| General | 用户档案、头像、基础行为设置，低风险 |
| Appearance | 主题预览、系统跟随、密度或图标选项，状态即时可见 |
| Channels | Provider、模型、API Key、Base URL、连接测试，错误就近展示 |
| Agent | 默认渠道、工作区、MCP、Skills，强调本地路径和能力来源 |
| Feishu / Integrations | 授权状态、同步目标、重新认证入口 |
| About / Update | 当前版本、更新状态、下载进度、重启安装 |

表单布局细节：

- 一行一事：每个 `SettingsRow` 只承载一个决定，避免右侧同时放多个强操作。
- 长命令 / Base URL / 路径字段使用等宽字体或 path chip，但 label 仍使用普通字体。
- Secret 字段默认隐藏，显示/复制按钮使用 icon-only + tooltip。
- 测试连接按钮靠近相关字段，不放在页面底部。
- 保存反馈尽量 inline，只有跨 tab 风险才使用 toast 或 dialog。

危险操作：

- 删除渠道、重置配置、清空会话、退出登录等必须进入 AlertDialog。
- AlertDialog 文案包含影响范围，例如“不会删除本地会话”或“会移除该渠道的 API Key”。
- destructive 按钮不能和 cancel 按钮同等权重；cancel 放默认焦点更安全。

Settings 验收口径：

- 窄窗口下设置行不挤压控件，label 与控件可以上下排列。
- 长页面滚动时左侧 tab 导航仍能定位当前位置。
- 表单错误不只出现在页面顶部，字段附近能看到原因。
- API Key / token 不会在截图和日志中意外明文展示。

### 5.5 Onboarding / Welcome

目标：首次使用和空状态要让用户直接进入工作，不做大段介绍。

规范：

- Onboarding 第一屏聚焦“完成环境与模型配置后开始 Pipeline / Agent”。
- Welcome 空状态提供 2 到 3 个直接动作，例如新建贡献 Pipeline、新建 Agent 会话、打开设置。
- 避免大面积渐变 hero 和说明卡片堆叠。
- 环境检查失败时，直接展示问题和修复入口，不隐藏在教程文案里。

首次启动路径：

1. 检查运行环境与 Bun / Git / Agent SDK 可用性。
2. 引导配置至少一个可用渠道。
3. 引导选择或创建 Agent 工作区。
4. 给出“开始 Pipeline”与“打开 Agent”的直接入口。

空态模板：

- 标题：说明当前没有什么，例如“还没有 Pipeline 会话”。
- 说明：一句话解释价值，例如“创建一个贡献工作流，让 Agent 分阶段探索、计划和审核。”。
- 主动作：新建 Pipeline 或新建 Agent 会话。
- 次动作：打开设置或查看工作区。

Welcome 验收口径：

- 空态不超过三张卡片，不形成 onboarding 迷宫。
- 用户不配置完所有高级功能也能开始最小可用流程。
- 环境问题比欢迎文案更醒目，修复入口明确。

### 5.6 Chat 回退

目标：旧 Chat 是隐藏回退，但不能成为视觉割裂点。

规范：

- ChatInput 与 Agent Composer 共享尺寸、边框、工具栏按钮语言。
- ChatMessage 与 AgentMessage 共享基础 message primitive。
- Chat 工具活动和 Agent 工具活动使用同一状态色和折叠规则。
- Chat 专属功能如 parallel mode、thinking、system prompt 使用 secondary 控件，不提升为主视觉。

兼容策略：

- Chat 回退不新增独立主题、不新增独立 icon 语言。
- 若 Agent message primitive 重构，Chat 优先复用只读展示层。
- Chat 的空态说明“这是隐藏回退入口”，但不要在 UI 中贬低功能。
- Chat 设置入口沿用 Settings 中渠道和系统提示词配置，不做页面内重复配置。

### 5.7 File Browser

目标：File Browser 是 Agent 工作区的操作面板，优先表达文件结构、变更状态和可执行动作。

规范：

- 文件树行高保持 28px 到 32px，hover 和 selected 清楚区分。
- 最近被 Agent 修改、可添加到聊天、删除、重命名等状态必须有 tooltip 和 `aria-label`。
- 文件路径 chip 使用 monospace 小字号，但不能低于 11px。
- DropZone 用 dashed border 表示可拖放，成功/失败给出即时反馈。
- 文件预览和删除确认使用现有 Dialog / AlertDialog 视觉，不另起一套样式。

文件树 anatomy：

- Icon：目录、文件、特殊文件类型、变更状态。
- Name：文件名，长名中间省略。
- Meta：大小、修改时间、Agent 修改标记，默认隐藏或弱化。
- Actions：添加到上下文、打开、重命名、删除，通过 hover 和 focus 显示。

状态规范：

| 状态 | 表现 |
| --- | --- |
| Selected | primary soft background + 左侧 accent |
| Hover | neutral hover，不覆盖 selected |
| Modified by Agent | small blue / emerald indicator + tooltip |
| Error | rose indicator + 可读错误 |
| Loading children | 行内 spinner，不阻塞整个树 |
| Empty folder | 行内 muted 文案“此文件夹为空” |

File Browser 验收口径：

- 键盘可以展开 / 折叠目录、移动焦点、触发行内动作。
- 删除或重命名前能看到完整路径，避免误操作。
- 大文件树滚动不卡顿，行高稳定，没有 hover 时宽度跳动。

### 5.8 页面级 Wireframe

本节只表达结构关系，不规定最终像素。后续实现应优先保证结构稳定，再做细节视觉。

AppShell：

```text
┌─────────────────────────────────────────────────────────────────────┐
│ App background / shell-bg                                           │
│ ┌──────┐ ┌───────────────┐ ┌───────────────────────┐ ┌───────────┐ │
│ │ Left │ │ Session list  │ │ TabBar                │ │ Right     │ │
│ │ nav  │ │ Search + New  │ ├───────────────────────┤ │ panel     │ │
│ │      │ │ Sessions      │ │ MainArea              │ │ Files /   │ │
│ │      │ │ Archive       │ │ Pipeline / Agent      │ │ Review    │ │
│ └──────┘ └───────────────┘ └───────────────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Pipeline：

```text
┌───────────────────────────────────────────────────────────────┐
│ PipelineHeader: title / status / actions                      │
├───────────────────────────────────────────────────────────────┤
│ StageRail: explorer -> planner -> developer -> reviewer -> ... │
├─────────────────────────────────────┬─────────────────────────┤
│ Records / Live output               │ Gate / Review panel     │
│ - stage grouped records             │ - current decision      │
│ - artifact cards                    │ - risk / evidence       │
│ - errors / stop notices             │ - approve / reject      │
└─────────────────────────────────────┴─────────────────────────┘
```

Agent：

```text
┌───────────────────────────────────────────────────────────────┐
│ AgentHeader: workspace / channel / model / mode               │
├───────────────────────────────────────────────────────────────┤
│ Banner zone: Permission / AskUser / PlanMode / error          │
├───────────────────────────────────────────────────────────────┤
│ Message stream                                                │
│ - user message                                                │
│ - agent markdown / reasoning                                  │
│ - tool activity list                                          │
├───────────────────────────────────────────────────────────────┤
│ Composer: attachments / editor / toolbar / send-stop          │
└───────────────────────────────────────────────────────────────┘
```

Settings：

```text
┌───────────────────────────────────────────────────────────────┐
│ SettingsDialog title / current tab                            │
├───────────────┬───────────────────────────────────────────────┤
│ Settings nav  │ Settings content                              │
│ General       │ Section                                       │
│ Appearance    │ ┌───────────────────────────────────────────┐ │
│ Channels      │ │ SettingsRow: label / desc / control       │ │
│ Agent         │ │ SettingsRow: label / desc / status        │ │
│ About         │ └───────────────────────────────────────────┘ │
└───────────────┴───────────────────────────────────────────────┘
```

File Browser：

```text
┌─────────────────────────────────────┐
│ Header: workspace / refresh / search│
├─────────────────────────────────────┤
│ DropZone / status notice            │
├─────────────────────────────────────┤
│ Tree                                │
│ ▾ folder                            │
│   file.ts        actions on focus   │
│   component.tsx  modified indicator │
└─────────────────────────────────────┘
```

线框验收：

- 重要状态区固定在可预期位置，例如 Agent banner 在消息上方、Pipeline gate 在右侧。
- Composer / TabBar / Header 的高度变化不能造成主内容大幅跳动。
- 右侧面板消失或折叠时，主内容仍能独立完成核心任务。

## 6. 组件规范

### 6.1 Button

按钮层级：

- Primary：当前页面唯一主动作。
- Secondary：常用但非主动作。
- Ghost：工具栏、行内操作、低权重命令。
- Destructive：删除、回退、停止远端写入等风险动作。

规范：

- 默认高度 36px，紧凑按钮 32px，主操作 40px。
- Icon-only 默认 36px，必须 tooltip + `aria-label`。
- Loading 按钮禁用并显示 spinner 或明确文案。
- Stop 按钮可用 destructive text + soft hover，不默认整块大红。

### 6.2 Card

规范：

- 普通卡片 8px radius，padding 12px 到 16px。
- 审核、失败、重要状态卡片可以 12px radius。
- 卡片标题、状态 badge、操作区三者布局要稳定。
- 避免卡片内部再套卡片；需要分组时使用 divider、section title 或 muted surface。

### 6.3 Input / Composer

规范：

- 所有输入必须有 label 或可访问名称。
- Placeholder 只给示例，不承担 label。
- Error 显示在字段附近，颜色 + 图标 + 文本同时出现。
- RichTextInput 工具栏固定，附件区和建议区在输入正文上方。

### 6.4 Badge / Status Pill

规范：

- Badge 文案短，优先中文。
- 状态 badge 使用 soft background，不使用高饱和实心色，除非是主 CTA。
- Running badge 可带 spinner；Completed 不需要动效。
- 数字 badge 使用 tabular numbers。

### 6.5 Dialog / Popover / Tooltip

规范：

- Dialog 用于需要打断的选择或确认。
- Popover 用于轻量设置、hover 预览和局部选项。
- Tooltip 只解释 icon 或缩写，不放长文案。
- Dialog 动效 150ms 到 220ms，Popover 100ms 到 160ms。
- 尊重 `prefers-reduced-motion`，减少 scale 和 slide。

### 6.6 Table / List

规范：

- 列表行需要 hover、selected、disabled 三态。
- 行内操作默认隐藏但 focus-visible 时必须出现。
- 50 条以上列表优先考虑虚拟化或分页。
- 时间、状态、来源、操作固定位置，提升扫描效率。

### 6.7 Tabs / Segmented Control

规范：

- 顶层模式切换使用 segmented control；页面内导航使用 tabs；不要混用。
- Active 状态使用 primary soft background 或底部 accent，不只改变文字粗细。
- Tab 内若有运行或错误状态，放小 indicator，不改变 tab 主结构。
- Segmented control 的滑块动效不超过 180ms，避免拖慢模式切换。
- 每个 tab trigger 需要 `aria-controls` 或等价可访问关系。

### 6.8 Notice / Banner / Toast

规范：

- Notice：页面内静态提示，例如配置缺失、已停止、无权限。
- Banner：需要用户立即处理的横向状态，例如 Permission、AskUser、PlanMode。
- Toast：短暂反馈，例如保存成功、复制成功、连接测试完成。

使用边界：

- 需要决策的事项不用 toast，必须留在页面中。
- 高风险事项不用普通 notice，必须有显式确认控件。
- Toast 自动消失 3 到 5 秒；错误 toast 需要保留进入详情的路径。

### 6.9 Empty / Skeleton / Error Block

Empty block：

- 图标 20px 到 24px，低权重。
- 标题 14px 到 16px。
- 正文一行到两行。
- 主动作不超过一个，次动作不超过两个。

Skeleton：

- 使用真实内容结构的骨架，不做大面积闪烁条。
- 列表骨架条数不超过 5 条。
- 超过 1 秒 loading 才显示 skeleton，短 loading 可用按钮 spinner。

Error block：

- 标题说明发生了什么。
- 正文说明为什么可能发生。
- 操作说明下一步，例如重试、打开设置、复制详情。
- 技术详情默认折叠，使用 monospace。

### 6.10 Command / Menu / Dropdown

规范：

- Menu item 高度 32px 到 36px，左侧 icon 16px。
- 危险 item 放到底部或使用 divider 分隔。
- Keyboard shortcut 放右侧 `kbd`，颜色弱化。
- Disabled item 需要 tooltip 或描述说明原因。
- Command palette 如果后续引入，应复用 AppShell 搜索和 Settings 导航语义，不创造第三套导航。

### 6.11 Path Chip / File Chip / Model Chip

规范：

- Path chip 使用 monospace，背景 muted，radius 6px。
- 文件 chip 左侧使用文件图标，右侧删除或打开动作。
- Model chip 展示 provider + model，长模型名中间省略。
- Chip 不承担按钮角色时不要用强 hover；可点击 chip 必须有 cursor 和 focus ring。
- 路径完整值通过 tooltip 或复制动作提供。

### 6.12 Progress / Stepper

规范：

- Pipeline 阶段轨是 stepper，不是普通 progress bar。
- 长任务可使用“不确定进度 + 当前阶段文案”，避免伪百分比。
- 真实下载或更新使用 determinate progress，并显示大小 / 速度 / 状态。
- Stepper 每步包含 label、状态和可选摘要；失败步可点击定位错误。

### 6.13 Form Validation

规范：

- 必填项用 label 旁标记，不只靠 placeholder。
- 校验时机：输入中不打断，blur 后或提交后显示错误。
- Base URL、代理、MCP command 这类复杂字段提供 helper text。
- 错误文案靠近字段，包含如何修复。
- 成功校验不要一直显示绿色噪音，短暂确认即可。

### 6.14 Icon Button

规范：

- 默认尺寸 36px，紧凑区最小 32px。
- icon 尺寸 16px 到 18px。
- Hover、focus、pressed、disabled 四态必须齐全。
- Tooltip 延迟 300ms 到 500ms；键盘 focus 也能触发说明。
- 删除、停止、拒绝等风险 icon button 不单靠红色，必须有 tooltip 或确认。

### 6.15 组件默认值总表

这一表用于实现阶段做快速对照。若组件已经有 shadcn / Radix primitive，优先通过 variant 和 className 收敛，不直接复制新组件。

| 组件 | 默认高度 | Radius | Padding / Gap | 字号 | 状态要求 |
| --- | --- | --- | --- | --- | --- |
| Primary Button | 40px | 8px | x 14px | 14px / medium | loading、disabled、focus |
| Secondary Button | 36px | 8px | x 12px | 14px | hover、disabled、focus |
| Ghost Button | 36px | 8px | x 10px | 14px | hover、pressed、focus |
| Icon Button | 36px | 6px | center | icon 16px | tooltip、aria-label、focus |
| Compact Icon Button | 32px | 6px | center | icon 16px | 仅用于密集列表 |
| Text Input | 36px | 8px | x 10px | 14px | label、error、helper |
| Composer | auto / min 96px | 12px | 12px | 14px | attachments、disabled、sending |
| Card | auto | 8px | 12px | 14px | hover 仅用于可点击 card |
| Status Badge | 22px | 999px 或 6px | x 8px | 12px | icon + text |
| Menu Item | 34px | 6px | x 8px / gap 8px | 13px | shortcut、disabled、danger |
| Tooltip | auto | 6px | 6px 8px | 12px | delay、keyboard focus |
| Dialog | auto | 16px | 20px 到 24px | 14px | title、description、focus trap |
| Settings Row | min 56px | none | y 12px | 14px | label、description、control |
| File Tree Row | 30px | 6px | x 8px / gap 6px | 13px | selected、hover、focus、actions |
| Tab Item | 34px | 8px | x 10px | 13px | active、running、blocked、close |

状态命名建议：

- 组件 variant 使用 `default`、`secondary`、`ghost`、`destructive`、`outline`。
- 状态 variant 使用 `idle`、`running`、`waiting`、`blocked`、`success`、`failed`、`stopped`。
- 不建议把业务状态写成组件 variant，例如不要出现 `plannerRunningButton`。

## 7. 交互与动效规范

### 7.1 状态反馈

所有 async 操作都要有 4 个状态：

- Idle：可点击或可输入。
- Loading：按钮禁用，文案或 spinner 可见。
- Success：短暂确认，必要时 toast。
- Error：就近展示原因和下一步。

适用场景：

- Pipeline start / stop / gate respond / select task。
- Agent send / stop / compact / attach file / attach folder。
- Settings save / test connection / delete channel / set app icon。
- File Browser rename / delete / add to chat / refresh。

### 7.2 动效节奏

规范：

- Hover / press：100ms 到 150ms。
- Accordion / collapsible：150ms 到 220ms。
- Dialog / sheet：180ms 到 240ms。
- 长列表进入不做 stagger，避免干扰阅读。
- 动效只用于解释状态变化，不做纯装饰。

### 7.3 Keyboard

规范：

- Tab 顺序必须符合视觉顺序。
- Esc 关闭 Popover / Dialog，但不能误取消运行中任务。
- Enter / Space 激活按钮。
- 侧边栏 session item 若使用 `role="button"`，需要完整 keyboard handler。
- 快捷键展示用 `kbd` 风格，保持同一尺寸。

### 7.4 Scroll

规范：

- 主内容、设置内容、侧边栏列表分别是明确滚动容器。
- Sticky 区域只用于 header、当前输入或重要操作，不把普通卡片 sticky。
- 自动滚动必须可被用户中断。
- Scroll minimap 只在长消息 / 长记录中出现，短内容隐藏。

### 7.5 Async 操作状态矩阵

| 操作 | Loading 表现 | Success 表现 | Error 表现 |
| --- | --- | --- | --- |
| Pipeline start | Composer disabled + StageRail running | 第一条 node start 记录 | 错误卡片 + 设置入口 |
| Pipeline stop | 按钮“正在停止...” | neutral notice“已停止” | 错误 notice + 重试停止 |
| Gate approve | 主按钮 loading | Gate 消失，阶段进入 running | Gate 保留，错误在按钮附近 |
| Agent send | 发送变停止，消息占位 | Agent 消息开始流式 | 输入保留，错误 banner |
| Permission allow | 按钮 loading | banner 消失，工具继续 | banner 保留，显示失败原因 |
| Settings test | 测试按钮 loading | inline success | 字段附近 error |
| File delete | AlertDialog destructive loading | 文件树移除 + toast | Dialog 内 error，不自动关闭 |

规范：

- Loading 状态不能让用户失去上下文。
- Success 后如果页面发生跳转，要保留短反馈或更新可见状态。
- Error 后保留用户输入，避免要求重新填写。

### 7.6 Motion Token

建议动效 token：

| Token | 时长 | 用途 |
| --- | --- | --- |
| `motion-fast` | 100ms | hover、press、tooltip 进入 |
| `motion-normal` | 160ms | tab indicator、popover、accordion |
| `motion-slow` | 220ms | dialog、panel、composer 高度变化 |
| `motion-exit` | 120ms | popover / dialog 退出 |

Easing：

- Enter：`ease-out` 或 gentle spring。
- Exit：`ease-in`，比 enter 更短。
- State change：`ease-out`，不使用弹跳。
- Reduced motion：关闭 translate / scale，仅保留 opacity 或直接切换。

### 7.7 拖放与文件交互

规范：

- DropZone hover 只在可拖入时高亮；不可拖入显示禁用态。
- 拖入文件时显示目标区域，不让整个页面都变色。
- 拖放成功后展示文件 chip 或文件树定位。
- 拖放失败在 DropZone 附近展示原因，例如格式不支持、文件过大、读取失败。
- 文件删除、重命名、移动必须有完整路径确认。

### 7.8 多会话与后台反馈

规范：

- 后台运行中的 session 在 sidebar 有 running indicator。
- 后台等待权限或 AskUser 的 session 使用 amber indicator，并提供 tooltip。
- 后台失败 session 使用 rose indicator，点击后定位错误记录或 banner。
- 当前 session 切换时，不自动滚到底部，除非用户正在跟随 live output。
- 多会话并行状态不能只放在当前页面；Sidebar / TabBar 也要承载摘要。

## 8. 可访问性检查

后续每次 UI 实现完成前至少检查：

- 文本对比度：正文 4.5:1，较大标题 3:1。
- Focus ring：所有 button、input、select、tab、session item、file tree item 可见。
- Icon-only：有 tooltip 和 `aria-label`。
- 状态不只靠颜色：running、waiting、failed、success 都有文案或图标。
- Dialog：有 title，焦点进入后可 Esc 或按钮退出。
- 表单：label 持久可见，错误靠近字段。
- 动效：`prefers-reduced-motion` 下可减少非必要 motion。
- 点击区域：高频工具按钮不低于 32px，推荐 36px。
- 文本溢出：长模型名、长文件名、长 session title 有 truncate 和完整查看路径。
- Screen reader：运行状态、停止状态、错误状态使用 `role="status"` 或 `aria-live`。

### 8.1 页面级检查

| 页面 | 必查项 |
| --- | --- |
| Pipeline | StageRail 可键盘定位，gate 状态有文本，失败详情可展开，停止按钮有确认反馈 |
| Agent | Composer 有 label，Permission / AskUser banner 可读屏，工具活动可展开，流式状态可感知 |
| AppShell | 模式切换有当前状态，Tab 可关闭且有名称，Sidebar item 可键盘激活 |
| Settings | Dialog 有 title，tab 导航可键盘切换，字段 label 持久可见，错误靠近字段 |
| Onboarding / Welcome | 主动作可聚焦，环境错误比说明更早被读到 |
| Chat 回退 | 消息角色可被读屏识别，输入区和 Agent 语义一致 |
| File Browser | tree / treeitem 语义清楚，展开折叠可键盘操作，行内按钮有名称 |

### 8.2 Keyboard 路径

至少验证这些键盘路径：

- 从 AppShell 进入 Pipeline，新建会话，输入任务，启动。
- 在 Pipeline gate 中阅读内容，Approve 或 Request changes。
- 从 Agent 输入消息，触发 permission banner，允许或拒绝。
- 在 Settings 中切换 tab，编辑渠道，测试连接，保存。
- 在 File Browser 中展开目录、选中文件、添加到上下文、删除并取消。

规范：

- Tab 顺序与视觉顺序一致。
- 焦点进入 Dialog 后不逃逸到背景。
- Esc 可以关闭轻量浮层，但不能误停止 Pipeline 或 Agent。
- 所有 hover-only 操作在 focus-visible 时也出现。

### 8.3 Contrast 与色盲安全

规范：

- 状态色必须配 icon 或文本；红 / 绿不能作为唯一差异。
- Amber 文本在浅色主题中不能使用过浅色阶，优先深 amber 文本 + 浅 amber 背景。
- Dark mode 中 muted text 不低于可读对比度，不用过灰的 secondary 文案承载关键信息。
- Focus ring 与背景至少 3:1，不能在 ocean / forest 主题中消失。
- 图表或阶段轨如果使用多色，必须有 label 或 shape 差异。

### 8.4 Screen Reader 文案

建议 aria 文案：

| 控件 | aria 文案示例 |
| --- | --- |
| 停止 Pipeline | `停止当前 Pipeline` |
| 允许工具 | `允许本次工具调用` |
| 拒绝权限 | `拒绝本次工具调用` |
| 展开工具输出 | `展开工具输出详情` |
| 删除文件 | `删除文件 {fileName}` |
| 关闭标签 | `关闭标签 {title}` |
| 复制路径 | `复制完整路径` |

规范：

- aria 文案描述结果，不描述图标外观。
- 动态状态区域使用 `aria-live="polite"`，高风险错误可以使用 `assertive`。
- 不把长日志直接读屏；给摘要和展开入口。

## 9. 后续落地建议

建议按风险和可见度分三轮推进：

### 9.1 第一轮：统一基础视觉 token

- 收敛普通卡片 radius、shadow、border。
- 为 Button、Input、Card、Badge、Dialog 建立统一 class 约定。
- 清理组件中的裸 hex 和一次性颜色，迁移到 semantic token。
- 增加全局 reduced-motion 样式。

验收：

- Pipeline、Agent、Settings 三个主区域的卡片、按钮、输入区看起来属于同一系统。
- 浅色、深色、特殊主题没有明显对比度回退。

### 9.2 第二轮：优化核心工作流页面

- Pipeline：强化 StageRail、Records 聚合、Gate 面板和失败恢复卡片。
- Agent：统一 Composer 工具栏、Banner 组件族和工具活动列表。
- AppShell：统一 Sidebar / PipelineSidebar 的状态、密度和空状态。

验收：

- 用户能在 5 秒内看出 Pipeline 当前阶段、是否需要人工处理、失败下一步。
- Agent 运行中、阻塞、权限请求、PlanMode 状态不再抢输入区布局。

### 9.3 第三轮：补齐设置与长尾页面

- Settings：统一长列表、表单、保存/测试状态和危险操作。
- Onboarding / Welcome：压缩说明，突出直接动作。
- Chat 回退 / File Browser：对齐 Agent 和 AppShell 的控件密度。

验收：

- 新用户从 Welcome 到配置到创建 Pipeline 的路径清楚。
- 旧 Chat 和 File Browser 不再像独立旧版本界面。

### 9.4 推荐验证方式

实现阶段建议执行：

```bash
bun run --filter='@codeinsights/electron' typecheck
```

并通过 Electron / Vite 实机截图检查：

- Pipeline 新建、运行中、等待审核、失败、已停止。
- Agent 空状态、运行中、工具调用、权限请求、PlanMode。
- Settings 的模型配置、Agent 配置、外观设置、快捷键。
- Onboarding / Welcome 的浅色和深色状态。
- File Browser 的 hover、selected、rename、delete confirm。

截图检查重点：

- 文本没有溢出按钮或卡片。
- 卡片没有互相套叠造成层级混乱。
- 状态色语义一致。
- icon-only 操作能被 tooltip 解释。
- 键盘 focus 清楚可见。

### 9.5 建议拆分任务

后续实现不要一次性重写全客户端，建议拆成小 PR / 小提交：

1. 视觉 token 与 primitive 收敛：Button、Card、Badge、Notice、Dialog、focus ring、motion token。
2. AppShell 与导航统一：LeftSidebar、PipelineSidebar、TabBar、RightSidePanel。
3. Pipeline 工作台强化：StageRail、Records、Gate、失败 / 停止 / blocked 状态。
4. Agent 阅读体验：Message、ToolActivity、Composer、Permission / AskUser / PlanMode banner。
5. Settings 密度与表单：Settings primitive、渠道表单、Agent 工作区、危险操作。
6. Welcome / Chat / File Browser 长尾对齐：空态、输入区、文件树、删除确认。

每个任务都应保持：

- 不新增状态管理方案，继续使用 Jotai。
- 不新增 public API / IPC / shared type，除非该任务明确需要并单独评审。
- 不修改 README / AGENTS，除非用户明确允许。
- 优先改复用 primitive，再落到页面局部。

### 9.6 BDD 验收场景建议

可以用以下行为描述指导后续测试或手动验收：

```gherkin
Feature: Pipeline 状态可理解
  Scenario: Pipeline 等待人工审核
    Given 一个 Pipeline 已运行到 plan_review gate
    When 用户查看主界面
    Then StageRail 显示等待状态
    And 右侧审核面板显示主动作和风险说明
    And 记录流中有对应 gate 摘要

Feature: Agent 权限请求不丢失
  Scenario: 后台会话等待权限
    Given Agent 会话在后台触发工具权限请求
    When 用户位于另一个 tab
    Then Sidebar 或 TabBar 显示 amber indicator
    When 用户切回该会话
    Then Permission banner 仍在输入区上方可操作

Feature: Settings 表单反馈就近可见
  Scenario: 渠道连接测试失败
    Given 用户填写了无效 Base URL
    When 用户点击测试连接
    Then 测试按钮显示 loading
    And 失败原因显示在渠道表单附近
    And 用户已填写内容不会丢失
```

### 9.7 截图验收矩阵

建议每轮 UI 实现至少保存这些截图进行对比：

| 页面 | Light | Dark | 特殊主题 | 状态 |
| --- | --- | --- | --- | --- |
| Pipeline | yes | yes | ocean / slate | empty、running、gate、failed、stopped |
| Agent | yes | yes | ocean | empty、streaming、tool running、permission、PlanMode |
| AppShell | yes | yes | forest / slate | multi-tab、background running、blocked |
| Settings | yes | yes | slate | channel form、validation error、danger dialog、update |
| Welcome | yes | yes | ocean | first run、config missing |
| File Browser | yes | yes | forest | selected、hover、rename、delete confirm、empty folder |
| Chat 回退 | yes | yes | slate | message list、composer、tool activity |

### 9.8 风险与约束

- 不建议同时重构布局、主题 token 和业务状态，否则视觉回归难定位。
- 不建议在组件内为每个主题写大量分支，会让后续主题扩展失控。
- 不建议用大面积渐变、发光边框或强阴影弥补层级不清；先整理信息结构。
- 不建议把 Pipeline / Agent 的运行状态全部折叠，透明度是 Agent 产品可信度的一部分。
- 不建议为了极简隐藏危险操作说明；高风险 gate 必须牺牲一些紧凑度换取确定性。

### 9.9 完成定义

当后续实现完成一轮 UI 优化时，应满足：

- `bun run --filter='@codeinsights/electron' typecheck` 通过。
- `git diff --check` 通过。
- Pipeline、Agent、Settings 至少完成浅色和深色截图检查。
- icon-only 按钮具备 tooltip 和可访问名称。
- 新增或修改的状态色通过文本 / 图标双重表达。
- 没有新增裸 hex，或新增裸色值有明确 token 化理由。
- 没有改 README / AGENTS，除非用户明确允许。

### 9.10 Before / After 审计模板

每轮实现前后建议使用同一张表记录差异，尤其适合 UI PR 描述、review 和截图归档。

| 字段 | 填写说明 |
| --- | --- |
| 页面 / 组件 | 例如 PipelineRecords、AgentComposer、SettingsChannelForm |
| 当前问题 | 具体描述，不写“看起来不好” |
| 影响等级 | P0 状态不可判断 / P1 操作不可预期 / P2 视觉不一致 |
| Before 截图 | 截图路径或说明 |
| 目标体验 | 用户应该更容易判断或完成什么 |
| 方案摘要 | token、组件、布局或文案层面的调整 |
| 涉及文件 | 具体到 renderer 组件或 CSS 文件 |
| After 截图 | 截图路径或说明 |
| 验收方式 | typecheck、截图、键盘路径、a11y、手动路径 |
| 残留风险 | 已知没有覆盖的主题、状态或窗口尺寸 |

示例：

| 页面 / 组件 | 当前问题 | 影响等级 | 目标体验 | 涉及文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| PipelineGateCard | 审核态和普通记录卡片视觉接近，用户不易判断需要处理 | P0 | 右侧 gate 成为当前最高优先级操作，风险和主动作清楚 | `components/pipeline/` | gate 截图、键盘 approve、失败态截图 |
| AgentPermissionBanner | 权限请求与普通提示混淆，后台会话提醒不足 | P1 | 当前和后台 permission 都可被发现，回到会话后可操作 | `components/agent/`、`tabs/` | 多 tab 手动路径、aria-label 检查 |

### 9.11 验收脚本与工具建议

本规范本身不要求立刻新增测试工具，但后续实现 UI 时建议使用这些验证方式：

| 验收类型 | 建议命令 / 方法 | 目标 |
| --- | --- | --- |
| TypeScript | `bun run --filter='@codeinsights/electron' typecheck` | 确认 UI 改动不破坏类型 |
| Diff whitespace | `git diff --check` | 确认 Markdown / TSX 无基础格式问题 |
| Unit / focused test | `bun test <相关测试文件>` | 有行为变化时验证状态更新 |
| Electron 实机 | `bun run dev` 或项目当前 Electron 开发命令 | 检查真实窗口、主题和滚动 |
| Screenshot | Electron / Vite 实机截图 | 对比 before / after |
| Keyboard | 手动 Tab / Enter / Space / Esc 路径 | 检查 focus 和可操作性 |
| Contrast | 浏览器 devtools / axe / 对比度工具 | 检查 4.5:1 和 focus ring |
| Reduced motion | 系统 reduced motion 或 CSS emulation | 检查动效降级 |

若后续引入 Playwright / E2E，建议优先覆盖：

- Pipeline gate：等待审核、Approve、Request changes、失败恢复。
- Agent permission：当前会话和后台会话权限请求。
- Settings channel form：连接测试成功 / 失败、字段错误、危险删除确认。
- File Browser：键盘展开、选中、删除取消、路径 tooltip。

### 9.12 截图基线命名

建议截图放在 `improve/ui/screenshots/` 下，使用稳定命名，便于 PR 和 review 对照。目录可以后续实现阶段再创建，本规范只定义约定。

命名格式：

```text
improve/ui/screenshots/{page}-{theme}-{state}-{viewport}.png
```

示例：

```text
improve/ui/screenshots/pipeline-light-running-desktop.png
improve/ui/screenshots/pipeline-dark-gate-desktop.png
improve/ui/screenshots/agent-ocean-permission-desktop.png
improve/ui/screenshots/settings-slate-channel-error-desktop.png
improve/ui/screenshots/file-browser-forest-selected-desktop.png
```

截图要求：

- 每张截图对应一个明确状态，不把多个状态混在一起。
- 截图前关闭真实 API Key、token、用户隐私路径或使用脱敏数据。
- 同一页面 before / after 使用同一窗口尺寸。
- 截图说明写清楚主题、状态和关键验收点。

### 9.13 MVP 优先级

如果后续只做第一轮最小可见优化，建议按这个 MVP 推进：

1. Token alias：surface、status、focus、motion 的最小契约。
2. Primitive：Button、IconButton、Card、Badge、Dialog、Tooltip。
3. AppShell：Tab running / blocked / failed indicator，Sidebar selected / hover / focus。
4. Pipeline：StageRail 状态、Gate 面板、失败 / 停止 notice。
5. Agent：Permission / AskUser / PlanMode banner、ToolActivity 状态、Composer 尺寸稳定。
6. Settings：SettingsRow、ChannelForm 错误、危险操作确认。

MVP 完成定义：

- Pipeline 和 Agent 的 P0 状态不再依赖用户猜测。
- Icon-only 操作具备 tooltip 和 `aria-label`。
- 主页面普通卡片 radius / padding / shadow 基本统一。
- 至少完成 light / dark 下 Pipeline、Agent、Settings 的 before / after 截图。
- 未引入新状态管理方案，未改 public API / IPC / shared type。

### 9.14 实现拆单建议

建议把后续任务拆成以下提交或 PR，避免一次性改动过大：

| 批次 | 范围 | 不包含 |
| --- | --- | --- |
| UI-1 | token alias、focus ring、motion、Button / Card / Badge / Dialog primitive | 页面业务逻辑 |
| UI-2 | AppShell、Sidebar、TabBar、RightSidePanel 视觉和状态 | Pipeline / Agent 内部重排 |
| UI-3 | Pipeline StageRail、Records、Gate、失败 / 停止状态 | 远端写业务逻辑 |
| UI-4 | Agent Message、ToolActivity、Composer、Banner 组件族 | SDK / IPC 改动 |
| UI-5 | Settings primitives、Channel / Agent form、危险操作 | 新增设置项 |
| UI-6 | Welcome、Chat 回退、File Browser 对齐 | 新功能入口 |

每个批次都应附带：

- 影响文件列表。
- before / after 截图。
- 手动验收路径。
- 未覆盖状态说明。
