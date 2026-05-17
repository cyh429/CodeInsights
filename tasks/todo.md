# Agent Cockpit UI 创意升级任务

## 2026-05-17 Agent 重构阶段 0：冻结基线计划

- [x] 复习 `tasks/lessons.md`，确认阶段推进、UI 零可见变化和阶段完成即提交纪律。
- [x] 阅读 `docs/agent-refactor/README.md`、`development-checklist.md`、`next-session-prompt.md` 和 `baseline-checklist.md`。
- [x] 检查本机 Agent 开发配置目录与现有 session / workspace / channel 基线，不读取或记录敏感密钥。
- [x] 创建 `docs/agent-refactor/baseline-runs/` 文本证据目录。
- [x] 按行为基线清单生成首轮基线记录，逐项写明输入、预期 UI、预期存储、预期终态和本轮实跑状态。
- [x] 固化当前 SDKMessage JSONL、权限、AskUser / Plan Mode、MCP / Skill、旧 session resume / fork / rewind、飞书入口和 Pipeline 旁路的文本证据。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 的阶段 0 状态。
- [x] 运行 `bun run typecheck` 和 `git diff --check -- docs/agent-refactor tasks/todo.md`。
- [x] 追加 Review，并用详细中文 commit message 单独提交阶段 0 文档成果。

## 2026-05-17 Agent 重构阶段 0：冻结基线 Review

- 已新增 `docs/agent-refactor/baseline-runs/` 文本证据目录，并写入目录说明和首轮基线记录 `2026-05-17-round-1.md`。
- 首轮基线记录覆盖 `baseline-checklist.md` 中 17 个场景，每项都写明输入、预期 UI、预期存储、预期终态和本轮实跑状态。
- 已确认本机开发配置目录为 `~/.rv-insights-dev/`，当前有 1 个 DeepSeek Agent 渠道、1 个默认 workspace、4 条 Agent session metadata、3 个 SDKMessage JSONL transcript。
- 已用存量 JSONL 固化首条消息、错误恢复样例、WebSearch tool activity、result 终态和旧 session 多轮 resume 行为；未记录 API Key、加密密文或完整大段模型输出。
- 当前环境缺少实时 Electron 桌面交互、workspace MCP server、飞书配置和若干权限/AskUser 样例；这些场景没有伪造通过，已作为后续触碰相关边界前必须补跑的缺口记录。
- 已更新 `docs/agent-refactor/development-checklist.md`，标记阶段 0 首轮文本证据完成，并把下一步推进到阶段 1 Shared Event Contract。
- 本轮没有修改 `apps/`、`packages/`、README 或 AGENTS；客户端 UI 零可见变化。
- 验证通过：`bun run typecheck`；`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent 模式 happyclaw 参考重构方案

- [x] 复习项目 `tasks/lessons.md`，确认本次只生成重构方案文档，不直接改业务代码。
- [x] 梳理 RV-Insights 当前 Agent 主链路：IPC、AgentOrchestrator、会话 JSONL、Jotai 全局监听和 UI 展示。
- [x] 梳理 happyclaw 核心理念：复用 Claude Code CLI 运行时、多渠道路由、容器/宿主机运行时、工作区配置、MCP/Skill/插件。
- [x] 在 `docs/agent-refactor/` 下生成重构方案 Markdown，覆盖目标架构、模块边界、迁移阶段、数据模型、验证策略和风险。
- [x] 追加 Review，记录文档范围、依据与残余问题。

## 2026-05-17 Agent 模式 happyclaw 参考重构方案 Review

- 已新增 `docs/agent-refactor/README.md`、`current-state-and-gap.md`、`target-architecture.md`、`migration-plan.md`，形成总览、现状差距、目标架构和阶段迁移路线。
- 方案明确吸收 happyclaw 的核心原则：Claude Code 原生优先、Runner 边界、shared event contract、runtime materialization、内置 MCP bridge；同时明确不照搬 SaaS 认证/RBAC/计费、IM-first 路由、Docker 默认隔离、SQLite 后台。
- 文档依据包括 RV-Insights 的 `AgentView`、preload、agent IPC、`agent-service`、`agent-orchestrator`、`ClaudeAgentAdapter`、`agent-session-manager`、`useGlobalAgentListeners`、`agent-atoms`，以及 happyclaw 的 README、`container-runner`、`container/agent-runner`、`im-channel`、`plugin-utils`、`mcp-tools` 等。
- 本轮未修改业务代码、README 或 AGENTS；仅新增方案文档并更新任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。
- 残余问题：方案尚未进入实现拆分，后续正式编码前需要按阶段确认是否先做 shared event contract，避免一次性大改 AgentOrchestrator 和 Renderer。

## 2026-05-17 Agent 模式重构方案深化计划

- [x] 复核 `tasks/lessons.md` 与现有 `docs/agent-refactor/` 文档，确认本轮继续只做方案文档优化。
- [x] 补充总览文档，明确 happyclaw 理念到 RV-Insights 的取舍、最终交付物和阅读路径。
- [x] 细化现状差距，按模块标注当前职责、问题症状、重构去向和保留边界。
- [x] 细化目标架构，补齐事件契约、Runner 输入输出、runtime 目录、权限、MCP bridge、外部渠道和 Pipeline 复用细节。
- [x] 细化迁移路线，补齐每阶段文件范围、测试策略、回滚点、完成定义和风险缓解。
- [x] 运行 Markdown 差异检查，在本节追加 Review。

## 2026-05-17 Agent 模式重构方案深化 Review

- 已将 `docs/agent-refactor/` 从方向性方案补成可执行规格：总览补了阅读路径、最终交付物和取舍规则；现状差距补了职责拆分、待迁移模块和当前行为基线；目标架构补了 `AgentRuntimeService`、`AgentRuntimeRunner`、`AgentRuntimeManifest`、事件契约、权限生命周期、MCP bridge 和 Pipeline 复用边界；迁移路线补了 feature flag、文件范围、fixture 类型、兼容规则、回滚点和双写总规则。
- 本轮重点吸收了 happyclaw 的原则，但把 RV-Insights 必须保留的本地优先、文件存储、保守权限和 Electron UI 体验边界明确写死，避免后续实现时误把 SaaS / IM-first / Docker-first 模型搬进来。
- 另外把几个最容易在实现期卡住的地方提前定死：`sequence` / `runId` 语义、终态单一来源、旧 session 兼容策略、settings 合并白名单、技能物化模式、外部渠道权限默认策略和新旧 reducer 的对比口径。
- 本轮仍未改业务代码、README 或 AGENTS；只更新了方案文档和任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。
- 后续若进入实现，建议先落 shared event contract，再做进程内 Runner 和 runtime manifest，避免一次性触碰 Orchestrator、Renderer 和工作区目录三条主线。

## 2026-05-17 Agent 模式重构方案二次优化计划

- [x] 复核上轮建议，确认本轮只继续优化方案文档，不改业务代码。
- [x] 新增 baseline checklist、event contract、runtime manifest、implementation PR 指南四份补充文档。
- [x] 在迁移路线中补充这些新文档的链接与更清晰的格式。
- [x] 根据用户要求补充“客户端 UI 零可见变化”硬约束，确保后续实现只改运行时和数据流。
- [x] 运行 Markdown/diff 检查，并追加 Review。

## 2026-05-17 Agent 模式重构方案二次优化 Review

- 已新增 `baseline-checklist.md`、`event-contract.md`、`runtime-manifest.md`、`implementation-prs.md`，把方案从架构路线进一步补成可验证的实现说明。
- 已在 `README.md`、`migration-plan.md`、`implementation-prs.md` 写入客户端 UI 零可见变化约束：后续实现不得改布局、样式、文案、入口、按钮行为或交互路径；Renderer 迁移只能替换内部数据来源，最终 view model 必须与旧路径一致。
- 已修正 `migration-plan.md` 中阶段 2 的字段列表缩进，并补充到新文档的链接。
- 本轮仍未修改业务代码、README 或 AGENTS；只更新 `docs/agent-refactor/` 和任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent 重构开发进度清单计划

- [x] 复核现有 `docs/agent-refactor/` 方案，确认本轮生成长期开发跟踪清单，不改业务代码。
- [x] 新增详细迭代开发 checklist，覆盖阶段、任务、验收、验证命令、回滚点和 UI 零变化约束。
- [x] 将 checklist 接入 `docs/agent-refactor/README.md` 索引，便于后续按文档推进。
- [x] 运行 diff 检查，并追加 Review。

## 2026-05-17 Agent 重构开发进度清单 Review

- 已新增 `docs/agent-refactor/development-checklist.md`，作为后续 Agent 重构迭代的主控进度清单。
- 清单按 12 个阶段组织：冻结基线、Shared Event Contract、Event Log 双写、In-process Runner、Runtime Manifest 只读解析、Runtime Materializer、新插件系统、内置 MCP Bridge、Renderer 新 reducer、External Channel Adapter、Pipeline 复用 Runner、旧路径清理。
- 每个阶段都包含任务、验收、验证命令和回滚方式，并反复约束客户端 UI 零可见变化、旧 session 兼容、feature flag / 回滚路径和 `git diff --check`。
- 已将该清单加入 `docs/agent-refactor/README.md` 索引，后续开发应按该文档逐项更新状态与阶段完成模板。
- 本轮未修改业务代码、README 或 AGENTS；仅新增/更新方案文档和任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent 重构进度状态交接计划

- [x] 更新 `development-checklist.md` 当前开发状态，明确方案与跟踪体系已完成、代码实现尚未开始。
- [x] 标注阶段 0-11 均未开始，并明确下一步应从阶段 0 冻结基线开始。
- [x] 新增下次启动 Codex 的交接提示词文档。
- [x] 将提示词文档加入 `docs/agent-refactor/README.md` 索引。
- [x] 运行 diff 检查并提交本阶段文档状态更新。

## 2026-05-17 Agent 重构进度状态交接 Review

- 已更新 `docs/agent-refactor/development-checklist.md` 的当前开发状态：方案与跟踪体系已完成，代码实现尚未开始，阶段 0-11 均未开始。
- 已明确下一步从“阶段 0：冻结基线”开始，先创建 `baseline-runs/` 并记录当前行为，不改业务代码。
- 已新增 `docs/agent-refactor/next-session-prompt.md`，提供下次启动 Codex 可直接发送的中文提示词。
- 已将提示词文档加入 `docs/agent-refactor/README.md` 索引。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent Mission Header 压缩计划

- [x] 复盘用户截图反馈：红框 Mission Header 信息密度过高，压缩了更重要的消息流与 Command Deck。
- [x] 使用 `ui-ux-pro-max` 的内容优先级与信息层级原则，保留状态可见但降低顶部占位。
- [x] 将 AgentHeader 从大 HUD 面板收敛为紧凑任务状态条，移除右侧 Signal 大卡片。
- [x] 同步收缩 Header 相关角标、扫描线、状态光效与 orb 尺寸，避免视觉壳继续按大面板占位。
- [x] 运行 Electron typecheck、聚焦 Agent UI 测试与 `git diff --check`。
- [x] 在本节追加 Review，记录实现范围、验证结果和残余风险。

## 2026-05-17 Agent Mission Header 压缩 Review

- 已将 AgentHeader 的首屏占位从大 HUD 面板压缩为紧凑任务状态条：`min-h` 从约 124/136px 降到 76/82px，并移除右侧 `Signal` telemetry 大卡片。
- 标题、编辑入口、状态、工作区、模型、权限和文件面板入口仍保留；次要 HUD 信息合并为更小的 lane / telemetry 胶囊，避免挤压消息流。
- 同步收缩 `agent-mission-strip--compact` 的角标、扫描线、orb ring 和阴影强度，让科技感保留在边线与状态反馈上，而不是靠垂直高度堆叠。
- 根据截图二次修正：元信息 chip 强制单行，中文 label 只在 2xl 宽屏显示，常规宽度下保留图标和值，避免“工作区 / 模型 / 权限”逐字换行。
- 本轮未改 IPC、Jotai 状态、Agent 执行逻辑、持久化结构、README 或 AGENTS。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`；`bun test apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/components/ui6-view-model.test.ts`；`git diff --check`。
- 残余风险：当前没有重新启动 Electron 桌面壳做截图复核，最终视觉比例仍建议在实际窗口确认一眼。

## 2026-05-17 Agent Cockpit 科技感重塑落地计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 强化 Agent 全局背景、三栏面板、Mission Header、消息日志、Command Deck 与 Resource Bay 的截图级可见变化。
- [x] 保留 `Agent | Pipeline` 顶部切换器、Jotai 状态、IPC 行为、文件面板和输入区原有交互。
- [x] 集中新增 scoped `agent-*` 视觉样式，使用多色科技 palette，并确保 reduced-motion 降级。
- [x] 运行 typecheck、聚焦测试、renderer 构建和 diff 检查。
- [x] 在本节追加 Review，记录改动范围、验证结果和残余风险。

## 2026-05-17 Agent Cockpit 科技感重塑落地 Review

- 已按计划做截图级可见增强：Agent 背景新增多色雷达 / vignette 层，Mission Header 新增扫描线、HUD 角标、旋转状态环和 telemetry 模块，消息区新增日志时间线，Command Deck 新增能量 beam，左右面板新增 neon cockpit 壳和资源舱扫描效果。
- `Agent | Pipeline` 顶部切换器仍保留在展开态左侧栏顶部；本次没有改 IPC、Jotai atom、Agent 执行逻辑、文件读写逻辑、README 或 AGENTS。
- 新增样式集中在 scoped `agent-*` class，使用 cyan / emerald / amber / violet 多色科技 palette；新加循环动效已纳入 `prefers-reduced-motion` 降级。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`；`bun test apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/components/ui6-view-model.test.ts`，16 pass；`bun run --filter='@rv-insights/electron' build:renderer`；`git diff --check`。
- `build:renderer` 仍有既有的大 chunk warning，本次构建成功；当前环境未打开 Electron 桌面壳做人工截图，残余风险主要是实际窗口里的主观观感与极窄宽度下的视觉密度。

## 2026-05-17 Agent|Pipeline 玻璃感优化计划

- [x] 复核用户截图中顶部模式切换器的视觉问题：比例偏厚、边框和背景发闷、当前态层级不够明确。
- [x] 将 `ModeSwitcher` 重构为紧凑玻璃感分段控件，保留 `Agent | Pipeline` 文案和原切换逻辑。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 Agent|Pipeline 玻璃感优化 Review

- `Agent | Pipeline` 仍保留在展开态左侧栏最上方，切换逻辑未改。
- `ModeSwitcher` 已改成紧凑玻璃感分段控件：半透明外壳、柔和光晕、滑块当前态、图标圆形承托和更小的字号/高度。
- 新增样式集中在 `.mode-switcher-glass` 和其内部 `.mode-slider` / `.mode-btn`，没有扩散到业务组件。
- `@rv-insights/electron` 版本已从 `0.0.77` 提升到 `0.0.78`。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`、`bun run --filter='@rv-insights/electron' build:renderer`、`git diff --check`。

## 2026-05-17 顶部 Agent|Pipeline 恢复计划

- [x] 复核用户指出的顶部模式切换器缺失问题，确认 `ModeSwitcher` 仅是未渲染而非组件丢失。
- [x] 将 `Agent | Pipeline` 放回展开态左侧栏最上方，并让 `Command Desk` 下移一层。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 顶部 Agent|Pipeline 恢复 Review

- 已恢复展开态左侧栏最上方的 `Agent | Pipeline` 模式切换器，保持原 `ModeSwitcher` 逻辑和视觉样式。
- `Command Desk` 现在位于模式切换器下方，不再替代或遮挡顶部模式入口。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`、`bun run --filter='@rv-insights/electron' build:renderer`、`git diff --check`。
- `@rv-insights/electron` 版本已从 `0.0.76` 提升到 `0.0.77`。

## 2026-05-17 左侧栏红框修正计划

- [x] 删除顶部红框中的 `MCP / Skills` 统计卡，避免无意义占位。
- [x] 压缩底部能力行，避免窄侧栏中图标与文字重叠。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 左侧栏红框修正 Review

- 顶部红框中的 `MCP / Skills` 统计卡已直接移除，顶部区域回到原本的命令舱主视觉，不再占据额外高度。
- 底部 `Capabilities` 行已改成更短的中文单行表达，并把内容容器、图标和尾部箭头收紧，避免窄侧栏里文字与图标互相挤压。
- 这次没有改归档、能力配置和用户设置的功能流，只调整侧栏的呈现与响应式占位。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`、`bun run --filter='@rv-insights/electron' build:renderer`、`git diff --check`。
- `@rv-insights/electron` 版本已从 `0.0.75` 提升到 `0.0.76`。

## 2026-05-17 左侧栏底部 Dock 紧凑化计划

- [x] 根据用户反馈复核底部 dock 空间占用，确认主要高度来自标题说明、两行副文本、较大 icon 和按钮 padding。
- [x] 去除非必要副说明，将归档与能力条压成单行信息表达，缩小图标、计数胶囊、按钮 padding 和底部外边距。
- [x] 保留归档切换、能力配置、用户设置三类入口，不改变数据流和点击目标。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 左侧栏底部 Dock 紧凑化 Review

- 已将底部 dock 从三段较高的信息卡压缩为更轻的紧凑面板：标题说明被移除，归档与能力入口改为单行排列，按钮高度、图标尺寸、计数胶囊和底部外边距都同步收紧。
- 现在这块区域的视觉重心更集中，仍保留归档切换、MCP / Skills 配置和用户设置入口，但占据的纵向空间明显更少。
- 变更只影响 `LeftSidebar` 底部结构和配套 scoped CSS，没有碰数据流、IPC 或设置逻辑。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`、`bun run --filter='@rv-insights/electron' build:renderer`、`git diff --check`。
- `@rv-insights/electron` 版本已从 `0.0.74` 提升到 `0.0.75`。

## 2026-05-17 左侧栏底部 Dock 红框优化计划

- [x] 复核截图红框对应范围：`LeftSidebar` 底部归档入口、Agent 能力摘要和用户设置入口。
- [x] 使用 `ui-ux-pro-max` 的层级、触达面积、状态表达原则，将底部散列按钮重构为统一 Dock Bay。
- [x] 保持现有归档切换、MCP / Skills 配置入口、用户设置入口不变，只增强视觉结构。
- [x] 运行 Electron renderer 类型检查、构建和 diff 检查。
- [x] 在本节追加 Review，记录改动与残余风险。

## 2026-05-17 左侧栏底部 Dock 红框优化 Review

- 已将红框区域收束为统一的 `Dock Bay` 面板：上方是归档 / 历史入口，中间是 Agent 工作区能力摘要，底部是用户账户条，不再像几段普通文字与按钮的简单堆叠。
- 归档入口保留原有切换行为；Agent 模式下的 MCP / Skills 配置入口仍然直达设置页；用户设置入口仍然直达全局设置，交互逻辑未改。
- 新增的 `agent-bottom-dock`、`agent-dock-link`、`agent-dock-icon`、`agent-dock-count` 等样式只作用于侧栏底部区域，没有扩散到其他面板。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`、`bun run --filter='@rv-insights/electron' build:renderer`、`git diff --check`。
- `@rv-insights/electron` 版本已从 `0.0.73` 提升到 `0.0.74`。
- 残余风险主要是 Electron 桌面壳中的最终观感和窄宽窗口下的换行表现，当前静态构建没有发现结构性问题。

## 2026-05-17 侧栏视觉重构计划

- [x] 审查并重构 `LeftSidebar`、`RightSidePanel`、`NavigatorPanel`、`ModeSwitcher`、`Panel`、`PanelHeader` 的视觉层次，保持现有功能不变。
- [x] 仅补充必要的 scoped 样式，强化侧栏与面板的层级、密度、状态感和现代感。
- [x] 运行侧栏相关构建与差异检查，确认没有引入布局或交互回退。
- [x] 在本节追加 Review，记录改动范围、验证结果和残余风险。

## 2026-05-17 侧栏视觉重构 Review

- 已完成侧栏视觉重构：左侧栏从普通列表容器升级为带 `Command Desk` 顶栏、状态统计、Workspace Matrix、分层列表和底部用户 dock 的控制台式结构；折叠态也同步保留更强的入口识别。
- `ModeSwitcher`、`Panel`、`PanelHeader`、`NavigatorPanel` 的默认层次已抬高，整体更接近现代面板壳，信息密度更高但没有新增状态管理。
- 右侧面板没有改业务逻辑，只保留容器和视觉壳的统一；相关 scoped 样式集中在 `globals.css`，继续沿用现有 shadcn / radix / lucide 体系。
- 验证结果：`git diff --check` 通过；`bun run --filter='@rv-insights/electron' build:renderer` 成功完成，仍只有既有的大 chunk warning。全量 `typecheck` 在当前工作区被仓库里一个非侧栏的 `ChatMessages.tsx` 缺失导入问题干扰，当前不在这次侧栏重构范围内。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-17 主内容工作台视觉重构

- [ ] 盘点并限定主内容相关文件范围：`agent/*`、`chat/*`、`pipeline/*`、`tabs/*` 与必要共用 `ui/*`。
- [ ] 重构主内容区容器、标题区、消息卡、空状态、输入区与对话框的视觉层级，形成更高质感的工作台叙事。
- [ ] 保持交互与数据流不变，只做视觉与局部布局增强，避免触碰侧边栏主逻辑。
- [ ] 运行类型检查与必要的聚焦验证，确认改造不破坏功能。
- [ ] 在本节追加 Review，记录改动文件、视觉要点与残余风险。

## 2026-05-17 主内容工作台视觉重构 Review

- 已将主内容统一成更明确的工作台叙事：`MainArea` / `TabContent` / `ChatView` / `AgentView` / `PipelineView` 都增加了更强的背景层、顶边高光和内容容器层次。
- 已强化头部、消息区、输入区与记录区的视觉重量：`ChatHeader`、`AgentHeader`、`ChatMessages`、`AgentMessages`、`ChatInput`、`PipelineHeader`、`PipelineComposer`、`PipelineRecords` 的卡片边界、阴影、留白和信息密度都做了统一收紧。
- 共用对话框与命令面板保持现有交互，只保留或延续更高质感的模态外观；本次没有改 IPC、Jotai 数据流、消息语义或主进程逻辑。
- 版本号已从 `0.0.72` 提升到 `0.0.73`。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`；`bun run --filter='@rv-insights/electron' build:renderer`；`git diff --check`。
- 残余风险主要是主观观感和 Electron 桌面壳里的最终层级表现，建议在实际窗口里再看一次 Chat / Agent / Pipeline 三个主面板的首屏。

## 2026-05-17 Agent Cockpit 可见度补强

- [x] 复盘用户反馈：上一轮 cockpit 优化偏保守，肉眼变化不够明显。
- [x] 使用 `ui-ux-pro-max` 的可见层级、色彩、动效与可读性原则重新校准样式强度。
- [x] 加重 Agent 背景、Mission Header、消息卡、工具横幅、输入区和左右资源面板的光效、材质、状态边线。
- [x] 更新 `tasks/lessons.md`，记录“创意 UI 重塑必须有截图级可见变化”的纠正。
- [x] 运行类型检查、renderer 构建与 diff 检查，确认补强不影响逻辑。
- [x] 在本节追加 Review。

## 2026-05-17 Agent Cockpit 可见度补强 Review

- 已把 Agent 主工作台继续往“任务舱 / mission console”方向推进：补强了 AppShell 的 Agent 背景层次、左侧 Workspace Matrix、AgentHeader 顶部舱、消息堆叠、Command Deck 与右侧 Resource Bay 的视觉分区。
- 这次改动仍然只碰渲染层视觉与少量版本元数据，没有新增 IPC、atom、存储格式或业务逻辑；`@rv-insights/electron` 版本已从 `0.0.71` 提升到 `0.0.72`。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`、`bun run --filter='@rv-insights/electron' build:renderer`、`git diff --check`、聚焦的 sidebar / agent UI model 测试。
- `build:renderer` 仍有既有的大 chunk warning，但构建成功，没有引入新的阻断性错误。
- 由于当前环境没有直接进入 Electron 桌面壳做截图复核，这次结论基于静态构建与代码审查；残余风险主要是纯视觉观感，需要桌面壳里再看一轮最终版式。

## 2026-05-17 Agent Cockpit UI 科幻舱内重塑

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 为 Agent 相关布局补齐更强的 cockpit / mission console 视觉层级，统一全局背景、面板材质和状态光效。
- [x] 重构 AgentHeader、AgentMessages、AgentView 的展示 class，让头部、消息卡、输入区形成一致叙事。
- [x] 让权限横幅与 AskUser 横幅也进入同一视觉系统，避免在新风格里突兀。
- [x] 运行 `bun run --filter='@rv-insights/electron' typecheck` 与 `git diff --check`，必要时做浏览器截图验证。
- [x] 在本节追加 Review，记录实现范围、验证结果和残余风险。

## 2026-05-17 Agent Cockpit UI 科幻舱内重塑 Review

- 已将 Agent 相关视觉统一到 cockpit / mission console 语言：头部信息条更像任务舱控制面板，消息卡增加角色色带和更强层次，输入区和权限 / 问答横幅也进入同一材质系统。
- 已新增 `agent-shell-bg`、强化 `agent-cockpit-shell`、`agent-message-card`、`agent-command-deck`、`agent-tool-rail` 等 scoped 样式，保留 reduced-motion 兼容，没有引入新依赖，也没有改 IPC、Jotai atoms 或持久化格式。
- `@rv-insights/electron` 版本已从 `0.0.70` 提升到 `0.0.71`。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`；`bun run --filter='@rv-insights/electron' build:renderer`；`git diff --check`。
- 浏览器侧真实 Electron 预览未做成自动截图，因为当前环境缺少 Playwright 依赖且该界面依赖 Electron preload；静态构建已通过，后续仍建议在桌面壳里看一次最终观感。

# Agent Cockpit UI 优化任务

## 2026-05-17 三栏横向宽度拖拽计划

- [x] 保护现有未提交临时文件和用户改动，先确认 `git status --short`。
- [x] 定位 AppShell 三栏宽度来源，确认 Agent / Pipeline 左栏与 Agent 右侧文件面板的显示条件。
- [x] 新增 Jotai 持久化宽度状态，覆盖左侧栏与右侧面板，设置合理 min / max，避免拖拽压垮主内容区。
- [x] 在两个分隔处新增横向 resize handle，支持鼠标拖拽、双击复位、键盘左右调整和基础 aria 信息。
- [x] 调整 AppShell 布局样式，确保折叠态、右侧面板关闭态、标题栏拖拽区域和现有滚动不冲突。
- [x] 运行 focused typecheck / tests / `git diff --check`，必要时启动客户端或构建 renderer 做布局验证。
- [x] 在本节追加 Review，记录实现范围、验证结果和残余风险。

## 2026-05-17 三栏横向宽度拖拽 Review

- 已在 AppShell 两处分隔处新增横向 resize handle：左侧导航栏 / 中间内容之间常驻，右侧文件面板打开时在中间内容 / 文件面板之间显示。
- 左侧栏宽度持久化为 `rv-insights-app-shell-left-sidebar-width`，Agent / Pipeline 共用；右侧文件面板宽度持久化为 `rv-insights-app-shell-right-panel-width`。
- 宽度约束：左栏 220-420px，右栏 280-520px，并按视口预留主内容最小宽度，避免拖拽把主工作区压到不可用。
- 交互支持鼠标拖拽、双击复位、Enter / Home 复位、方向键调整；handle 使用 `role="separator"` 和中文 `aria-label`。
- 同步让 `PipelineSidebar`、`RightSidePanel`、`SidePanel` 接收外部宽度，避免外层可变但内部仍固定 320px 的空白问题。
- `@rv-insights/electron` 版本 `0.0.68 -> 0.0.69`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`；`bun run --filter='@rv-insights/electron' build:renderer`；`bun test apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.test.ts` 14 pass；`git diff --check`。
- `build:renderer` 仍有既有 chunk size warning，本次构建成功，未作为三栏拖拽改造阻塞项。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。
- 用户截图反馈左栏拖窄后顶部模式切换区会挤压 / 溢出；已追加修复：左栏最小宽度提升到 260px，`ModeSwitcher` 降低水平 padding、允许 label truncate，并同步 Agent / Pipeline 左栏 minWidth。

## 2026-05-17 Agent Cockpit UI 创意升级计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 将 Agent 模式左右侧边栏与中间工作台统一升级为更有层次的 “Agent Cockpit” 视觉语言。
- [x] 优化左侧栏的信息分区、会话列表状态、折叠态入口与底部账户区。
- [x] 优化 Agent Header、消息区、输入区与工具活动展示，让中间区域更像任务控制台。
- [x] 优化右侧文件面板与 File Browser 的资源舱样式、文件树行、空态、拖拽区与危险操作确认。
- [x] 集中收敛 Agent 专用 CSS token / utility，保持主题兼容且不引入新依赖。
- [x] 运行 typecheck、聚焦测试或必要的手动验证，确认视觉改动不影响交互与布局。
- [x] 在本节追加 Review，记录改动、验证和残余风险。

## 2026-05-17 Agent Cockpit UI 创意升级 Review

- 已完成 Agent 模式三栏可见改造：左侧栏增加 Workspace Matrix、控制台式模式区、新建 / 搜索高亮入口、会话行 active / hover 能量边；中间 Mission Strip、消息卡、工具轨、Composer Deck 增加光感、网格、状态色和更清晰层级；右侧文件面板与 File Browser 改为资源舱 / vault 风格。
- 新增样式集中在 `agent-*` scoped CSS class，继续使用现有主题 token、Lucide 图标、Radix/shadcn 基础组件；未新增依赖，未修改 IPC、Jotai atom、Agent 执行逻辑、文件读写逻辑、README 或 AGENTS。
- 文件树行现在有更明显的 selected / hover / recently modified 表达，空态和拖拽区使用同一资源舱视觉；主要交互仍保留原 aria-label、tooltip、键盘路径和删除确认。
- `@rv-insights/electron` 版本 `0.0.67 -> 0.0.68`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`；`bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/components/agent/agent-ui-model.test.ts` 14 pass；`bun run --filter='@rv-insights/electron' build:renderer`；`git diff --check`。
- `build:renderer` 仍有既有 chunk size warning，本次构建成功，未作为 Agent Cockpit 视觉改造阻塞项。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

# Pipeline 完善分析任务

## 2026-05-16 Pipeline Sidebar Command Deck UI 计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 只改造 `PipelineSidebar` 的视觉层级，保留现有 IPC、状态、排序、归档、工作区与会话操作逻辑。
- [x] 将展开态侧边栏升级为深色玻璃指挥舱：顶部模式区、工作区控制台、新建 / 搜索操作区、会话任务卡片、底部能力区与账户 dock。
- [x] 将折叠态侧边栏同步升级，保持展开 / 新建 / 用户入口风格一致。
- [x] 增强会话分组标题、状态徽标、选中态、hover 操作和空状态，确保状态不只靠颜色表达。
- [x] 运行 Pipeline 侧边栏模型测试、Electron typecheck 与 `git diff --check`。
- [x] 在本节追加 Review，说明改动、验证和残余风险。

## 2026-05-16 Pipeline Sidebar Command Deck UI Review

- 已完成 Pipeline 专属侧边栏改造：展开态现在是深色玻璃指挥舱面板，顶部模式区、工作区控制台、新建 / 搜索入口、会话任务卡片、分组标题、能力区和账户 dock 都有明显可见变化。
- 会话列表项保留原选择、重命名、置顶、归档行为；视觉上新增状态 orb、节点 / 轮次 chip、状态徽标、左侧状态轨、当前会话能量边和微型刻度，状态不只靠颜色表达。
- 折叠态同步改造为同一视觉语言，展开、新建和用户设置入口保持原功能与 tooltip / aria-label。
- 未修改 IPC、atoms、会话排序、归档逻辑、工作区逻辑、持久化结构、README 或 AGENTS；未新增依赖。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.test.ts` 11 pass；`bun run --filter='@rv-insights/electron' typecheck`；`bun run --filter='@rv-insights/electron' build:renderer`；`git diff --check`。
- `build:renderer` 仍有既有 chunk size warning，本次构建成功，未作为本次侧边栏 UI 改造阻塞项。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-16 Pipeline Stage Rail Creative UI Refresh 计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 将 `PipelineStageRail` 从朴素卡片网格改为“贡献航线 / Mission Route”视觉，保留现有状态模型和阶段定位行为。
- [x] 为每个阶段增加序号、节点图标、状态徽章、微型进度刻度、hover / focus 反馈，并强化当前运行阶段的 glow / scan / pulse。
- [x] 增加 scoped `pipeline-stage-route-*` CSS utilities，并确保 reduced-motion 下循环动画降级。
- [x] 递增 `@rv-insights/electron` patch 版本并同步 `bun.lock` workspace metadata。
- [x] 运行 Pipeline 聚焦测试、typecheck 和 `git diff --check`。
- [x] 在本节追加 Review，说明改动、验证和残余风险。

## 2026-05-16 Pipeline Stage Rail Creative UI Refresh Review

- 已完成红框区域改造：`PipelineStageRail` 现在使用 Mission Route / 贡献航线布局，阶段卡片包含节点图标、两位序号、状态 icon、状态徽章和微型进度刻度；当前阶段具备 glow、扫描高光和脉冲节点。
- 状态来源保持不变：继续使用 `buildPipelineStageViewModels` 的 `done / active / waiting / failed / stopped / todo`，点击阶段定位记录的行为未改变。
- 新增 CSS 均为 scoped `pipeline-stage-route-*` utility，动画使用 opacity / transform / background-position，并已加入 `prefers-reduced-motion: reduce` 降级。
- `@rv-insights/electron` 版本 `0.0.65 -> 0.0.66`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@rv-insights/electron' typecheck`；`bun run --filter='@rv-insights/electron' build:renderer`；`git diff --check`。
- 未修改 README / AGENTS，不新增依赖，不新增 public API / IPC / shared type，不改 Pipeline 状态机、主进程服务或持久化格式。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-16 Pipeline Header 大标题移除计划

- [x] 移除 PipelineHeader 中展示会话标题的大号 H1，保留顶部 RV Pipeline 与当前节点、状态摘要。
- [x] 同步收紧 Header 内部间距，避免删除标题后出现明显空洞。
- [x] 更新 `tasks/lessons.md` 记录用户对 Pipeline Header 信息密度的纠正。
- [x] 运行聚焦测试或类型检查，并重新截图确认红框区域不再保留。
- [x] 在本节追加 Review。

## 2026-05-16 Pipeline Header 大标题移除 Review

- 已移除 `PipelineHeader` 中的大号会话标题 H1；Header 现在只保留 `RV Pipeline`、当前节点、状态摘要、轮次和右侧状态卡，用户标红区域不再占位。
- 已更新 `tasks/lessons.md`，记录 Pipeline Header 不再重复以超大标题展示会话名的偏好。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@rv-insights/electron' typecheck`。
- 已重新采集截图：`/tmp/rv-insights-shots/pipeline-header-stage.png`，确认红框内容已删除。

## 2026-05-16 Pipeline Neon Control Deck UI 优化计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 改造 Pipeline 主内容背景、Header、StageRail、Records、Composer，让运行状态和阶段进度有明显科技感与动态反馈。
- [x] 适度增强 PipelineSidebar 的新建入口、当前会话选中态和运行中状态点。
- [x] 增加 scoped Pipeline CSS utilities / keyframes，并确保 reduced-motion 下动画降级。
- [x] 递增 `@rv-insights/electron` patch 版本并同步锁文件。
- [x] 运行 Pipeline 聚焦测试、pipeline atoms 测试、typecheck 与 `git diff --check`。
- [x] 启动客户端做 Pipeline 模式视觉验证，检查桌面与窄宽布局、长文本、搜索、运行/等待/失败/停止状态。
- [x] 在本节追加 Review，说明改动、验证和残余风险。

## 2026-05-16 Pipeline Neon Control Deck UI 优化 Review

- 已完成 Pipeline 可见层改造：主工作区增加网格 / 微光背景；Header 改为任务指挥舱；StageRail 增加能量线、当前阶段 glow 和状态 icon；Records 增加控制台式搜索 / filter、实时输出扫描光、记录左侧状态轨和 hover lift；Composer 改为任务发射台；PipelineSidebar 增强新建入口、选中态和运行状态点。
- CSS 新增均使用 `pipeline-*` scoped class；动画使用 transform / opacity / background-position，并在 `prefers-reduced-motion: reduce` 下禁用循环扫描、能量线、状态脉冲和高亮呼吸。
- Code review 后已修复：不再对已含 alpha 的 `status-*-bg` / `status-*-border` token 叠加 Tailwind opacity modifier；Pipeline 背景伪元素加 `z-index: 0`，内容容器加 `z-10`；新增装饰性 Lucide 图标补 `aria-hidden`。
- `@rv-insights/electron` 版本 `0.0.64 -> 0.0.65`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@rv-insights/electron' typecheck`；`bun run --filter='@rv-insights/electron' build:renderer`；`git diff --check`。
- Vite 渲染端已在 `http://127.0.0.1:5174/` 启动并返回 200；直接浏览器打开会因缺少 Electron preload 的 `window.electronAPI` 报错，这是现有 Electron 架构限制，不是本次 UI 改动引入。真实 Pipeline 视觉仍需通过 Electron 桌面壳查看。
- 未修改 README / AGENTS，不新增依赖，不新增 public API / IPC / shared type，不改 Pipeline 状态机、主进程服务或持久化格式。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-16 UI 全阶段完成后状态同步计划

- [x] 检查 `git status --short`，确认当前仅有 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 需要继续保护。
- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 当前开发状态，明确 UI-0 到 UI-7 全部完成，UI-7 commit 为 `33b8ccec`。
- [x] 更新 checklist 的当前启动提示和下次启动提示词，避免下次误从 UI-7 重复开始。
- [x] 在本地任务记录中追加下次启动提示词，说明后续应从新的 UI 专项或用户新需求开始。
- [x] 保持 README / AGENTS 不变，只更新 UI 进度跟踪文档和本地任务记录。

## 2026-05-16 UI 全阶段完成后状态同步 Review

- 当前 UI 阶段状态：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5、UI-6、UI-7 全部完成；未完成阶段：无。
- 最新 UI 阶段提交：`33b8ccec`，`test(ui): 完成客户端 UI 视觉验收收口`。
- UI-7 已完成并验证：4 个聚焦测试文件 11 pass、`bun run --filter='@rv-insights/electron' typecheck`、`git diff --check`。
- 后续继续开发时不要重复 UI-0 到 UI-7；应先定义新的 UI 专项或接收新的用户需求，再写入 `tasks/todo.md` 计划并 check-in。
- 可选后续专项：真实 Electron 截图复核、File Browser 完整 roving tabindex / typeahead、低频集成设置页 token 化、窄窗口矩阵、新产品功能 UI。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 下次启动提示词（UI 全阶段完成后）

```text
你正在 RV-Insights 仓库继续开发。请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前 UI 优化进度：
1. UI 文档基线已完成并提交：7bef500c，docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0「基线审计与截图准备」已完成并提交：61c263c8，docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1「Token 与 primitive 收敛」已完成并提交：20a90d36，feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. UI-2「AppShell / Sidebar / Tab」已完成并提交：c3636336，style(ui): 统一 AppShell 导航与标签状态。
5. UI-3「Pipeline 工作台」已完成并提交：3881eb10，style(pipeline): 优化 Pipeline 工作台状态层级。
6. UI-4「Agent 阅读与交互」已完成并提交：b28ac9df，style(agent): 优化 Agent 消息工具与交互状态。
7. UI 截图索引已补充并提交：1d78bf66，docs(ui): 补充 UI 截图索引说明。
8. UI-5「Settings 管理界面」已完成并提交：8362e8b4，style(settings): 统一设置界面表单与危险操作。
9. UI-5 后续开发状态已同步并提交：3ccb2886，docs(ui): 同步 UI-5 后续开发状态。
10. UI-6「Welcome / Chat 回退 / File Browser」已完成并提交：ed3d48d3，style(ui): 对齐 Welcome Chat 与 File Browser 体验。
11. UI-6 后续开发状态已同步并提交：f523ad71，docs(ui): 同步 UI-6 后续开发状态。
12. UI-7「全局验收与收尾」已完成并提交：33b8ccec，test(ui): 完成客户端 UI 视觉验收收口。
13. 已完成：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5、UI-6、UI-7。未完成：无。
14. UI-7 验收内容：阶段 Review、P0/P1 关闭矩阵、主题矩阵、icon-only 可访问性、状态色辅助表达、键盘路径、长文本 / 长路径溢出和截图矩阵已收口。
15. UI-7 验证通过：bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/tabs/tab-close-confirm-model.test.ts；bun run --filter='@rv-insights/electron' typecheck；git diff --check。
16. 当前工作区可能存在未提交临时文件 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，以及 .DS_Store 修改；它们不是 UI 阶段成果，不要纳入提交，先确认来源并保护用户变更。

请从当前完成状态继续：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 implementation checklist 的当前状态快照、UI-7 最终 Review、P0/P1 关闭矩阵，以及 tasks/todo.md 的 UI 全阶段完成后状态同步 Review。
3. 不要回头重复 UI-0 到 UI-7 的阶段实现；这些阶段已经完成并提交。
4. 如果用户要求继续 UI 优化，先在 tasks/todo.md 写新的专项计划并 check-in，再开始实现。可选后续专项包括：真实 Electron 截图复核、File Browser 完整 roving tabindex / typeahead、低频集成设置页 token 化、窄窗口矩阵、或新的产品功能 UI。
5. 继续遵守 Jotai、Radix/shadcn 风格组件、Lucide 图标、现有主题 token、本地 JSON/JSONL 存储的约束。
6. 不新增 public API / IPC / shared type，除非单独评审；不修改 README / AGENTS，除非用户明确允许。
7. 新专项完成后运行 bun run --filter='@rv-insights/electron' typecheck、相关 focused tests 或手动路径验证、git diff --check；按需要补充截图或在 Review 中说明覆盖依据。
8. 新专项完成后更新 checklist 或新增对应 improve/ui 跟踪文档，并在 tasks/todo.md 追加 Review；单独提交，不执行 push / PR，除非用户明确要求。
```

## 2026-05-16 UI-7 全局验收与收尾计划

- [x] 执行 `git status --short`，确认当前仅有 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 需要保护，不纳入 UI-7 提交。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、UI visual spec 与 implementation checklist 的 UI-7 范围。
- [x] 检查 UI-0 到 UI-6 的阶段 Review 是否完整，确认 P0 / P1 问题已关闭或有明确暂缓原因。
- [x] 做全局静态审计：主题 token fallback、裸 hex、状态色辅助表达、reduced motion、Dialog title / cancel / focus、icon-only `aria-label` / tooltip。
- [x] 做跨页面键盘与溢出审计：File Browser、Sidebar、TabBar、Settings nav；长文件名、长模型名、长 session title、长错误文本和长路径。
- [x] 对照截图矩阵确认 light / dark / 至少一个特殊主题覆盖 AppShell、Pipeline、Agent、Settings、Welcome、Chat 回退、File Browser；必要时补采或记录已有截图覆盖。
- [x] 如发现回归，只做最小修复，不重复 UI-2 到 UI-6 的阶段实现，不新增 public API / IPC / shared type，不修改 README / AGENTS。
- [x] 运行最终验证：`bun run --filter='@rv-insights/electron' typecheck`、相关 focused tests 或手动路径验证、`git diff --check`。
- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 的总览、UI-7 任务、截图矩阵与最终 Review。
- [x] 在本节追加 UI-7 Review，单独提交 UI-7，提交时继续排除 `.DS_Store` 与 swap 文件。

## 2026-05-16 UI-7 全局验收与收尾 Review

- UI-7 已完成全局验收：UI-0 到 UI-6 阶段 Review 已补齐，P0 / P1 关闭矩阵已写入 implementation checklist。
- 最小修复范围：ChatHeader 编辑确认 / 取消、置顶、并排模式补 `aria-label`；WelcomeEmptyState 移除组件内 `forest-light` 裸 hex 分支，回到 token；TabBar 补 `tablist` / `tab` / `aria-selected` 与 ArrowLeft / ArrowRight / Home / End 切换；LeftSidebar 隐藏行内操作退出 Tab 顺序，运行 / 等待 / 成功 / 失败状态补 sr-only 文案；File Browser 补 ArrowUp / ArrowDown 在 treeitem 间移动。
- `@rv-insights/electron` 版本 `0.0.63 -> 0.0.64`，`bun.lock` workspace metadata 已同步。
- 截图矩阵已收口：Pipeline、Agent、AppShell、Settings、Welcome、Chat 回退、File Browser 已有 light / dark / 特殊主题组合覆盖；Chat 回退 light/dark 与 File Browser light/dark 以 token 复用、既有特殊主题截图、focused tests 和手动路径审计接受。
- 验证通过：`bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/tabs/tab-close-confirm-model.test.ts` 11 pass；`bun run --filter='@rv-insights/electron' typecheck`；`git diff --check`。
- 未修改 README / AGENTS，不新增 public API / IPC / shared type，不改变业务状态、存储结构或 Agent / Pipeline 执行语义。
- 已知风险：File Browser 仍不是完整 roving tabindex / typeahead 树模型，但 UI-7 已补上下方向键聚焦移动；低频集成设置页仍有历史状态色 class，因均带文本状态或图标辅助，本轮不作为阻塞项。
- 提交时继续排除 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。

## 2026-05-16 UI-6 后进度文档同步计划

- [x] 检查 `git status --short`，确认当前只剩 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 UI visual spec swap 文件需要保护。
- [x] 更新 UI implementation checklist 的最新状态快照，明确 UI-6 commit `ed3d48d3` 已完成并提交。
- [x] 更新阶段进度表、截图矩阵和当前启动提示，明确 UI-0 到 UI-6 已完成，UI-7 未完成。
- [x] 将下次启动提示词改为 UI-7「全局验收与收尾」，避免下次重复 UI-6。
- [x] 保持 README / AGENTS 不变，只更新 UI 进度跟踪文档和本地任务记录。

## 2026-05-16 UI-6 后进度文档同步 Review

- 已同步 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：UI-6 commit 为 `ed3d48d3`，提交标题为 `style(ui): 对齐 Welcome Chat 与 File Browser 体验`。
- 当前完成阶段：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5、UI-6；未完成阶段：UI-7。
- UI-6 已完成 Welcome / Onboarding 空态、Chat 回退 message list / composer / tool activity、File Browser selected / hover / rename / delete confirm / empty folder 的视觉层级、focus、路径溢出和危险确认收敛。
- UI-6 验证记录：UI-6 聚焦测试 4 pass、`bun run --filter='@rv-insights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- UI-6 截图记录：`welcome-light-first-run-desktop.png`、`welcome-dark-config-missing-desktop.png`、`chat-slate-message-list-desktop.png`、`chat-slate-tool-activity-desktop.png`、`file-browser-forest-selected-desktop.png`、`file-browser-forest-delete-confirm-desktop.png`。
- 下次启动应从 UI-7「全局验收与收尾」开始，先做全局验收计划，再检查主题矩阵、键盘路径、icon-only 可访问性、状态色辅助表达、长文本 / 长路径溢出、截图矩阵和最终 Review。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入阶段提交。

## 下次启动提示词（UI-7）

```text
你正在 RV-Insights 仓库继续推进全客户端 UI 优化。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前进度：
1. UI 文档基线已完成并提交：7bef500c，docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0 已完成并提交：61c263c8，docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1 已完成并提交：20a90d36，feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. UI-2 已完成并提交：c3636336，style(ui): 统一 AppShell 导航与标签状态。
5. UI-3 已完成并提交：3881eb10，style(pipeline): 优化 Pipeline 工作台状态层级。
6. UI-4 已完成并提交：b28ac9df，style(agent): 优化 Agent 消息工具与交互状态。
7. UI 截图索引已提交：1d78bf66，docs(ui): 补充 UI 截图索引说明。
8. UI-5 已完成并提交：8362e8b4，style(settings): 统一设置界面表单与危险操作。
9. UI-5 后续开发状态已同步并提交：3ccb2886，docs(ui): 同步 UI-5 后续开发状态。
10. UI-6 已完成并提交：ed3d48d3，style(ui): 对齐 Welcome Chat 与 File Browser 体验。
11. 已完成：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5、UI-6。未完成：UI-7。
12. 当前工作区可能存在 .DS_Store 修改和 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，不要纳入提交。

请从 UI-7「全局验收与收尾」开始：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 checklist 的 UI-7 阶段和视觉规范中主题、可访问性、页面级 Wireframe、截图矩阵相关部分。
3. 先在 tasks/todo.md 写 UI-7 计划并 check-in，再做全局验收审计。
4. 不要回头重复 UI-2 / UI-3 / UI-4 / UI-5 / UI-6 的阶段实现；除非验收发现具体回归，只做最小修复。
5. 不新增 public API / IPC / shared type；不修改 README / AGENTS，除非用户明确允许。
6. UI-7 完成定义：所有阶段 Review 已填写；light / dark / 至少一个特殊主题下 AppShell、Pipeline、Agent、Settings、Welcome、Chat 回退、File Browser 层级清楚；icon-only 按钮有 aria-label / tooltip；状态色有文本或图标辅助；File Browser、Sidebar、TabBar、Settings nav 键盘路径可用；长标题、长模型名、长路径、长错误文本无明显溢出。
7. 完成 UI-7 后运行 typecheck、相关 focused tests 或手动路径验证、git diff --check，按需要补充截图，更新 checklist 和 tasks/todo.md Review，并单独提交。
```

## 2026-05-16 UI-6 Welcome / Chat 回退 / File Browser 计划

- [x] 检查 `git status --short`，确认只保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 UI visual spec swap 文件。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、UI checklist 的 UI-6 阶段、视觉规范 `5.5` / `5.6` / `5.7` / `5.8`。
- [x] 做 UI-6 before 审计，记录 Welcome / Onboarding、Chat 回退、File Browser 当前结构、状态表达、focus 和溢出风险。
- [x] 优化 Welcome / Onboarding：首次启动与空态聚焦环境 / 模型配置后进入 Pipeline / Agent，动作不超过三个，环境问题优先。
- [x] 优化 Chat 回退：ChatInput 对齐 Agent Composer 密度和语义，ChatMessage / tool activity 状态色与折叠语言收敛，隐藏回退定位不视觉割裂。
- [x] 优化 File Browser：文件树 row hover / selected / focus、treeitem 语义、路径 chip、rename / delete confirm、empty folder、recently modified indicator。
- [x] 补 UI-6 聚焦测试或可验证模型，覆盖 Welcome 动作、Chat tool activity tone、File Browser tree / danger copy / path display。
- [x] 递增受影响 package patch 版本并同步锁文件。
- [x] 运行 `bun run --filter='@rv-insights/electron' typecheck`、相关聚焦测试或手动路径验证、`git diff --check`。
- [x] 采集 light / dark / 特殊主题截图，更新 UI checklist 与本地 Review，单独提交 UI-6。

## 2026-05-16 UI-6 Before 审计

- Welcome / Onboarding：`WelcomeView` 当前没有真正空态，只在无 tab 时自动复用或创建 draft，并短暂显示 spinner；`WelcomeEmptyState` 仍是问候 + tip + Agent/Pipeline segmented control，缺“新建 Pipeline / 新建 Agent / 打开设置”直接动作，也没有隐藏 Chat 回退定位说明。`OnboardingView` 是全屏渐变 hero + 教程卡片，Windows 环境检查在第二步才出现，环境问题不够早；按钮可聚焦但教程卡和主动作层级偏营销化。
- Chat 回退 message list：已使用 `ai-elements/message` primitive，但空态复用旧 Welcome 问候，未说明 Chat 是隐藏回退；user / assistant 消息 action hover 依赖较重，错误块和 stopped 文案仍使用局部 raw tone，长 tool result / 错误文本有 break-all 但整体 tool block 层级与 Agent ToolActivity 不一致。
- Chat 回退 composer：`ChatInput` 仍保留 Cherry Studio 风格 `rounded-[17px]`、`border-[0.5px]`、raw green drag over 和 36px 圆形按钮，和 UI-4 Agent Composer 的 token / focus / disabled 语言不完全一致；附件、思考、停止、发送有 tooltip 但 icon button 缺明确 `aria-label`，左侧工具在窄宽可能挤压。
- Chat tool activity：`ChatToolActivityIndicator` 仅把 start/result 合并后交给 `ChatToolBlock`，状态色与 Agent `getToolActivityTone` 未共享；运行 / 成功 / 错误主要由 block 内部决定，折叠和 summary 密度与 Agent 工具活动不一致。
- File Browser selected / hover：文件行是 `div` + click，行高由 `py-1` 自然撑开，hover `accent/50`、selected `accent`，缺左侧 accent bar；row 本身不可 tab focus，键盘只能进入行内按钮 / 菜单，tree / treeitem 语义缺失。
- File Browser rename：原位 input 有 Enter / Escape / blur 保存，错误就近显示；但重命名前没有展示完整路径或确认，长路径只在浏览器 title / truncate 中出现，focus ring 只靠 border，保存失败会撑高行。
- File Browser delete confirm：已用 AlertDialog，但说明只展示名称或数量，没有完整路径列表，删除失败只 `console.error` 且弹窗关闭；危险按钮缺 loading / 防重复点击，批量删除误操作风险较高。
- File Browser empty folder / overflow：根目录空态是居中文案“目录为空”，子目录为空是行内“空文件夹”，文案和规范不一致；长文件名 truncate 但无 tooltip，root path breadcrumb 是尾部两段，缺 monospace path chip 和完整路径 hover。recently modified indicator 有 `aria-label` 但不是 tooltip，且只用小点表达。

## 2026-05-16 UI-6 Welcome / Chat 回退 / File Browser Review

- UI-6 已完成：WelcomeEmptyState 改为 3 个直接动作（进入 Pipeline / 进入 Agent / 打开设置），补充 Chat 隐藏回退定位；Onboarding 去除大面积渐变 hero，前置 Windows 环境问题说明，教程入口降为次级动作。
- Chat 回退已收敛：ChatInput 容器改用 `rounded-card`、`border-border-subtle`、`bg-surface-card`、focus ring 和横向工具栏溢出策略；发送 / 停止 / 附件 / thinking icon button 补 `aria-label`；ChatToolBlock 使用 UI-6 tone 映射对齐 Agent 工具状态色。
- File Browser 已收敛：根路径 chip 使用 monospace 和中间省略；文件树加入 `tree` / `treeitem` / `group` 语义，row 可 focus，支持 Enter / Space 选择或展开、ArrowRight / ArrowLeft 展开折叠；selected 增加 primary soft 背景和左侧 accent；最近修改标记补 tooltip。
- File Browser 危险操作已优化：删除确认展示完整路径或多选路径列表，删除失败留在弹窗内 inline 展示，删除中禁用关闭路径；rename 父路径计算兼容 POSIX / Windows separator，rename error 不再在 blur 时立即消失。
- 代码审查后已修复：ARIA tree 容器不再包含 alert/status/empty 普通节点，展开子项包在 `role="group"`；Welcome “新建”文案改为“进入”，避免和实际 setMode 行为不一致；添加到聊天按钮从 `invisible` 改为 opacity 控制，键盘 focus 可达。
- `@rv-insights/electron` 版本 `0.0.62 -> 0.0.63`，`bun.lock` workspace metadata 已同步。
- 验证通过：UI-6 聚焦测试 4 pass、`bun run --filter='@rv-insights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- 截图已采集：`welcome-light-first-run-desktop.png`、`welcome-dark-config-missing-desktop.png`、`chat-slate-message-list-desktop.png`、`chat-slate-tool-activity-desktop.png`、`file-browser-forest-selected-desktop.png`、`file-browser-forest-delete-confirm-desktop.png`。
- 本阶段不修改 README / AGENTS，不新增 public API / IPC / shared type，不改变文件读写安全边界；`.DS_Store` 和 UI spec swap 文件继续保护不纳入提交。

## 2026-05-16 UI-5 后进度文档同步计划

- [x] 检查 `git status --short`，确认当前只剩 `.DS_Store` 和 UI visual spec swap 文件需要保护。
- [x] 更新 UI implementation checklist 的最新状态快照，明确 UI-5 commit `8362e8b4` 已完成并提交。
- [x] 更新阶段进度表、截图矩阵和当前启动提示，明确 UI-0 到 UI-5 已完成，UI-6 到 UI-7 未完成。
- [x] 将下次启动提示词改为 UI-6「Welcome / Chat 回退 / File Browser」，避免下次重复 UI-5。
- [x] 保持 README / AGENTS 不变，只更新 UI 进度跟踪文档和本地任务记录。

## 2026-05-16 UI-5 后进度文档同步 Review

- 已同步 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：UI-5 commit 为 `8362e8b4`，提交标题为 `style(settings): 统一设置界面表单与危险操作`。
- 当前完成阶段：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5；未完成阶段：UI-6、UI-7。
- UI-5 已完成 SettingsDialog / SettingsPanel 导航、Settings primitives、ChannelSettings / ChannelForm、AgentSettings、McpServerForm、About / Update、危险操作和错误反馈层级收敛。
- UI-5 验证记录：Settings 聚焦测试 7 pass、`bun run --filter='@rv-insights/electron' typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- UI-5 截图记录：`settings-light-channel-form-desktop.png`、`settings-dark-validation-error-desktop.png`、`settings-slate-danger-dialog-desktop.png`、`settings-slate-update-desktop.png`。
- 下次启动应从 UI-6「Welcome / Chat 回退 / File Browser」开始，先做长尾页面 before 审计，再优化 Welcome / Onboarding 空态、旧 Chat 回退视觉、File Browser 文件树 / rename / delete confirm / empty folder。
- 当前仍需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入阶段提交。

## 下次启动提示词（UI-6）

```text
你正在 RV-Insights 仓库继续推进全客户端 UI 优化。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前进度：
1. UI 文档基线已完成并提交：7bef500c，docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0 已完成并提交：61c263c8，docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1 已完成并提交：20a90d36，feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. UI-2 已完成并提交：c3636336，style(ui): 统一 AppShell 导航与标签状态。
5. UI-3 已完成并提交：3881eb10，style(pipeline): 优化 Pipeline 工作台状态层级。
6. UI-4 已完成并提交：b28ac9df，style(agent): 优化 Agent 消息工具与交互状态。
7. UI 截图索引已提交：1d78bf66，docs(ui): 补充 UI 截图索引说明。
8. UI-5 已完成并提交：8362e8b4，style(settings): 统一设置界面表单与危险操作。
9. 已完成：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5。未完成：UI-6、UI-7。
10. 当前工作区可能存在 .DS_Store 修改和 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，不要纳入提交。

请从 UI-6「Welcome / Chat 回退 / File Browser」开始：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 checklist 的 UI-6 阶段和视觉规范中 Welcome / Onboarding、Chat 回退、File Browser 相关部分，以及 5.8 页面级 Wireframe 对应说明。
3. 先做 UI-6 before 审计，记录 Welcome / Onboarding 空态、Chat 回退 message list / composer / tool activity、File Browser selected / hover / rename / delete confirm / empty folder 的当前结构、状态表达、focus 和溢出风险。
4. 不要回头重复 UI-2 / UI-3 / UI-4 / UI-5；AppShell、Sidebar、Tab、Pipeline 主面板、Agent 工作区和 Settings 管理界面已完成。
5. 不新增 public API / IPC / shared type；不修改 README / AGENTS，除非用户明确允许。
6. UI-6 完成定义：Welcome / Onboarding 空态、Chat 回退、File Browser 文件树与危险确认在 light / dark / 至少一个特殊主题下层级清楚、focus 可见、无明显文本或路径溢出。
7. 完成 UI-6 后运行 typecheck、相关聚焦测试或手动路径验证、git diff --check，采集 light / dark / 特殊主题截图，更新 checklist 和 tasks/todo.md Review，并单独提交。
```

## 2026-05-16 UI-5 Settings 管理界面计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、UI checklist 与视觉规范 `5.4 Settings` / `5.8 Settings Wireframe`。
- [x] 执行 `git status --short`，确认需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。
- [x] 做 UI-5 before 审计，记录 Settings primitives、ChannelSettings、ChannelForm、AgentSettings、McpServerForm、About / Update 与危险操作问题。
- [x] 优化 SettingsDialog / SettingsPanel 导航、当前 tab、状态点、scroll 容器和关闭 / 未保存拦截文案。
- [x] 收敛 Settings primitives：SettingsSection / Card / Row 支持窄宽换行、control 宽度、helper / error / feedback 语义。
- [x] 优化 Channels：渠道列表操作可见性、删除确认、API Key / Base URL / 连接测试错误就近反馈。
- [x] 优化 Agent：工作区、MCP、Skills、本地路径、删除 / 导入 / 同步反馈和危险操作确认。
- [x] 优化 About / Update：版本、环境检测、更新状态与下载入口层级。
- [x] 补 Settings 聚焦测试，覆盖导航状态、primitive 布局、危险操作和表单反馈模型。
- [x] 运行 typecheck、Settings 聚焦测试、`git diff --check`，采集 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 与本地 Review，单独提交 UI-5。

## 2026-05-16 UI-5 Before 审计

- SettingsDialog / SettingsPanel：Dialog 宽高接近规范但固定 `85vh`，窄宽时左侧导航 160px + 右侧内容可能压缩表单；关闭按钮缺 `aria-label`；about tab 的红点没有 tooltip 或可读说明；导航按钮缺 `aria-current`，状态点只靠颜色表达。
- Settings primitives：`SettingsRow` 固定横向 `label/control`，右侧控件 `flex-shrink-0`，长 Base URL、MCP command、Skills 路径和多按钮操作在窄窗口下有挤压风险；`SettingsCard` 会自动分隔所有子节点，容易把非 row 提示也切成装饰层；字段 helper / error / feedback 语义分散在调用点。
- ChannelSettings：渠道行编辑 / 删除按钮只在 hover 显示，键盘用户不易发现；删除确认已用 AlertDialog，但文案未说明影响范围，确认按钮非 destructive loading 状态；删除失败只写日志，缺 inline feedback。
- ChannelForm：API Key 有持久 label 和隐藏默认值，但显示按钮无可访问名称且 `tabIndex=-1`；创建必填错误主要靠 disabled / toast，字段附近缺错误；测试连接结果靠局部 raw 颜色；模型列表长 ID、手动添加双输入在窄宽下易挤压。
- AgentSettings：工作区 / MCP / Skills 结构存在但本地路径和来源信息层级偏弱；MCP 与 Skill 删除使用原生 `confirm()`，不符合危险操作规范；行内操作多为 hover 才显现且缺 `aria-label`；长 command/url/description 主要 truncate，缺 tooltip 或 path chip。
- McpServerForm：command、env、headers 有 label/helper，但必填错误靠 disabled / return，未就近说明；测试成功/失败使用 raw green/red；textarea 可能显示 token 明文，截图风险需避免默认明文；返回 icon 按钮缺 `aria-label`。
- About / Update：更新和环境检测功能完整，但按钮使用裸 `button` class，状态与 Settings Button / feedback 语义不统一；release notes 长内容在卡片内展开后可能造成局部滚动压力；检查失败只显示短文案，错误详情依赖 title。
- 危险操作：渠道删除有 AlertDialog；未保存离开有 AlertDialog；MCP / Skill 删除仍是 `confirm()`；cancel 默认焦点大体安全，但 destructive action 未统一 `destructive` variant，也未防重复点击。

## 2026-05-16 UI-5 Settings 管理界面 Review

- UI-5 已完成：SettingsDialog 改为稳定 `min(88vh, 752px)` / `min(92vw, 1000px)` 尺寸，Settings nav 增加 tab 描述、`aria-current`、about 状态图标说明，关闭按钮补 `aria-label`。
- Settings primitives 已收敛：SettingsRow 支持窄宽上下排列和 control 换行；SettingsInput / Select / Toggle 补 label、helper、error 语义；新增 SettingsTextarea 统一 MCP env / headers 多行输入。
- Channels 已优化：渠道编辑 / 删除 / toggle 补键盘 focus 和 `aria-label`；渠道删除 AlertDialog 说明影响范围、loading 防重复点击、失败留在弹窗内 inline 展示；ChannelForm API Key、创建必填、模型列表和测试反馈更靠近字段。
- Agent / MCP / Skills 已优化：MCP / Skill 删除从原生 `confirm()` 改为 AlertDialog；删除失败 inline 展示；MCP command / env / headers 有 helper；行内 icon 操作补可访问名称和 focus 可见性。
- 代码审查后已修复：Radix `AlertDialogAction` 异步删除提前关闭问题；可用模型行嵌套交互控件问题；about 状态 icon 增加 `role="img"`。
- `@rv-insights/electron` 版本 `0.0.61 -> 0.0.62`，`bun.lock` workspace metadata 已同步。
- 验证通过：Settings 聚焦测试 7 pass、`bun run --filter='@rv-insights/electron' typecheck`、`git diff --check`。
- 截图已采集：`settings-light-channel-form-desktop.png`、`settings-dark-validation-error-desktop.png`、`settings-slate-danger-dialog-desktop.png`、`settings-slate-update-desktop.png`。
- 本阶段不修改 README / AGENTS，不新增 public API / IPC / shared type，不改变配置存储结构；`.DS_Store` 和 UI spec swap 文件继续保护不纳入提交。

## 2026-05-16 UI-4 后进度文档同步计划

- [x] 检查 `git status --short`，确认当前仅有 `.DS_Store` 和 visual spec swap 文件需要保护。
- [x] 更新 UI implementation checklist 的最新状态快照，写明 UI-4 commit `b28ac9df` 与截图索引 commit `1d78bf66`。
- [x] 更新阶段进度表和下次启动提示词，明确 UI-0 到 UI-4 已完成，UI-5 到 UI-7 未完成。
- [x] 保持下次启动范围从 UI-5 Settings 管理界面开始，不回头重复 UI-2 / UI-3 / UI-4。

## 2026-05-16 UI-4 后进度文档同步 Review

- 已同步 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：UI-4 commit 为 `b28ac9df`，截图索引 commit 为 `1d78bf66`。
- 当前完成阶段：UI-0、UI-1、UI-2、UI-3、UI-4；未完成阶段：UI-5、UI-6、UI-7。
- 下次启动应从 UI-5「Settings 管理界面」开始，先做 Settings before 审计，再优化 Settings primitives、渠道表单、Agent 配置、MCP / Skills、危险操作和错误反馈。
- 当前仍需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入阶段提交。

## 2026-05-16 UI-4 Agent 阅读与交互计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、UI checklist 与视觉规范 `5.3 Agent` / `5.8 页面级 Wireframe`。
- [x] 执行 `git status --short`，确认需保护 `.DS_Store`、UI checklist 既有改动和 spec swap 文件。
- [x] 做 UI-4 before 审计，记录 AgentHeader、AgentMessages、ToolActivityItem、PermissionBanner、AskUserBanner、AgentComposer 当前问题。
- [x] 补 Agent UI 聚焦测试，覆盖 header meta、banner tone、tool activity 状态、composer 锁定说明。
- [x] 实现 UI-4：Agent banner zone 上移、header meta、message 阅读宽度、ToolActivity 状态、Permission / AskUser / ExitPlan / PlanMode banner 与 Composer 稳定性。
- [x] 递增 `@rv-insights/electron` patch 版本并同步锁文件。
- [x] 运行 typecheck、Agent 聚焦测试、`git diff --check`，采集 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 和本地 Review，单独提交 UI-4。

## 2026-05-16 UI-4 Before 审计

- AgentHeader：当前只展示可编辑标题和文件面板按钮，没有 workspace / channel / model / permission mode 的轻量 meta；编辑确认 / 取消按钮缺少可见 tooltip，文件面板按钮缺少明确 `aria-label`。
- AgentMessages：消息流与 banner 顺序不符合 wireframe，Permission / AskUser / PlanMode 当前位于消息流下方；长回复阅读宽度依赖外层 72rem，代码块与表格会被 `MessageContent overflow-hidden` 截断风险放大。
- ToolActivityItem：running / completed / background / error 使用分散 raw color class，状态行点击按钮缺少 `aria-label`，失败只显示 `Error` badge，摘要和完整输出层级不够稳定。
- PermissionBanner：视觉是浮起卡片而非 banner zone；缺 `aria-live`，关闭按钮只靠 `title`，工具名 / 命令摘要在长路径下容易挤压操作按钮。
- AskUserBanner：视觉语言与 Permission / ExitPlan 相似但未抽象统一；横幅内 tab / option class 使用模板字符串和强 primary 块，长问题或选项说明有横向挤压风险；缺 `aria-live`。
- AgentComposer：AskUser / ExitPlan 出现时整个输入区被隐藏，造成底部高度跳动；发送 / 停止 / 附件等 icon button 部分缺 `aria-label`；拖拽态使用裸色值；disabled 原因只在顶部提示，不统一为稳定 notice。

## 2026-05-16 UI-4 Agent 阅读与交互 Review

- UI-4 已完成：AgentHeader 增加 workspace / model / permission / running meta；Permission、AskUser、PlanMode、ExitPlanMode 统一移动到 header 下方 banner zone；Composer 不再因交互 banner 消失，改为稳定展示并显示锁定原因。
- ToolActivity 状态色收敛到 running / success / waiting / danger semantic token；工具详情、展开按钮、复制按钮补 focus / aria；消息内容改为 `overflow-visible`，表格支持横向滚动。
- 新增 `agent-ui-model.ts` 和聚焦测试，覆盖 header meta、banner tone、tool tone 和 composer disabled / interrupt send 状态。
- 代码审查后已修复：交互锁进入 `handleSend` 守卫，Permission pending 也会锁住 Composer，附件按钮 / 粘贴 / 拖拽跟随锁定状态；Permission / AskUser / ExitPlan 多横幅同屏时只有最高优先级横幅响应全局快捷键；AskUser 多问题提交要求全部问题已回答。
- `@rv-insights/electron` 版本 `0.0.60 -> 0.0.61`，`bun.lock` workspace metadata 已同步。
- 验证通过：Agent 聚焦测试 11 pass、`bun run --filter='@rv-insights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- 截图已采集：`agent-ui4-light-empty-desktop.png`、`agent-ui4-dark-permission-desktop.png`、`agent-ui4-ocean-planmode-desktop.png`。
- 临时 renderer harness 已删除；本阶段不修改 README / AGENTS，不新增 public API / IPC / shared type，不改 Agent SDK 编排或持久化语义。

## 2026-05-16 UI-3 后进度文档同步计划

- [x] 检查 `git status --short`，确认只存在 `.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 本地噪声需要保护。
- [x] 更新 UI implementation checklist 顶部状态快照，明确 UI-0、UI-1、UI-2、UI-3 已完成并提交。
- [x] 补齐 UI-3 阶段 Review，写明 commit、涉及文件、验证命令、截图路径、未覆盖范围和残留风险。
- [x] 更新 checklist 的下次启动提示词，明确下一阶段从 UI-4 Agent 阅读与交互开始。
- [x] 执行文档校验和 `git diff --check`，确认没有格式问题。

## 2026-05-16 UI-3 后进度文档同步 Review

- 已更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：最新状态改为 UI-3 完成并提交，UI-3 commit 为 `3881eb10`。
- 已标注已完成阶段：UI-0、UI-1、UI-2、UI-3；未完成阶段：UI-4、UI-5、UI-6、UI-7。
- 已补齐 UI-3 Review：Pipeline 主面板与 v2 右侧操作面板已收敛，验证为 Pipeline 聚焦测试 25 pass、Electron typecheck、`git diff --check` / `git diff --cached --check`。
- 下次启动应直接从 UI-4「Agent 阅读与交互」开始，先做 Agent before 审计，再改 Agent Message、ToolActivity、Composer、Permission / AskUser / PlanMode 和后台权限路径。
- 本次只更新进度跟踪文档，不修改 README / AGENTS，不新增 public API / IPC / shared type。

## 计划

- [x] 复习项目 lessons 状态：当前未发现 `tasks/lessons.md`，本次没有用户纠正需要记录。
- [x] 梳理当前 Pipeline 后端编排、节点 runner、artifact、gate、checkpoint 实现。
- [x] 梳理当前 Pipeline UI、Jotai 状态、IPC/preload 与人工审核体验。
- [x] 对照目标六 Agent 开源贡献工作流，列出缺口、优先级与改造路径。
- [x] 在 `improve/pipeline/` 下生成 markdown 分析文档。
- [x] 校验文档存在性和关键内容，并在本文末尾追加 review。

## Review

- 已生成 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`。
- 已覆盖后端五节点现状、Codex/Claude 路由差距、`patch-work` 产物契约、UI/IPC 缺口、六 Agent 路线图、BDD 验收场景和关键风险。
- 已执行文件存在性、行数和关键词校验；本次是分析文档任务，未运行应用测试。

## 2026-05-13 方案深化计划

- [x] 复核现有六 Agent Pipeline 分析文档结构。
- [x] 补充 Pipeline v2 产品边界、术语和阶段状态定义。
- [x] 补充 Contribution / patch-work / artifact / gate / event 的详细数据契约。
- [x] 补充 LangGraph 状态机、runner 路由、prompt、CLI 权限和失败循环细节。
- [x] 补充 UI 工作台、IPC、持久化、测试矩阵和实施拆分。
- [x] 校验文档关键词和结构，并追加本轮 review。

## 2026-05-13 方案深化 Review

- 已将 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md` 扩展为 Pipeline v2 详细规格。
- 新增内容覆盖产品边界、启动输入、ContributionTask、PatchWorkManifest、Explorer/Planner/Developer/Reviewer/Tester/Committer 细分契约、gate kind、stream event、IPC、UI 工作台、持久化、Git service、安全策略、prompt、错误恢复、测试矩阵、分阶段实施、迁移和配置项。
- 已执行结构与关键词校验；本次仍为方案文档完善，未运行应用测试。

## 2026-05-13 二次优化计划

- [x] 复核现有 Pipeline v2 方案是否遗漏实现阶段风险。
- [x] 补充工作区隔离、Git 污染控制和 `patch-work` 提交边界。
- [x] 补充 LangGraph 状态幂等、恢复、路由和人工 gate 细化建议。
- [x] 补充 CLI 预检、运行预算、观测性、提示词注入防护和质量门禁。
- [x] 补充更清晰的 MVP 切片、里程碑验收和实现顺序。
- [x] 校验文档新增章节并追加本轮 review。

## 2026-05-13 二次优化 Review

- 已在 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md` 追加“二次评估与优化方案”。
- 新增内容覆盖 preflight、工作区隔离、`patch-work` 不进入默认补丁、revision/原子写入、LangGraph raw state、节点幂等、gate 消息线程、CLI 进程监督、预算、提示词注入防护、committer 职责拆分、tester/reviewer 修复边界、观测性、三类数据源边界、UI 启动表单、MVP-A/B/C 和新版 Phase 顺序。
- 已执行 `git diff --check` 和关键词检索校验；本次仍是方案文档优化，未运行应用测试。

## 2026-05-13 阶段开发清单计划

- [x] 基于 Pipeline v2 方案生成独立阶段开发跟踪清单。
- [x] 在清单中明确阶段入口条件、开发任务、验收标准、测试命令和禁止跨越规则。
- [x] 覆盖 Phase 0 到 Phase 8，并标注 MVP-A/B/C 边界。
- [x] 校验清单文档存在、关键章节完整，并追加本轮 review。

## 2026-05-13 阶段开发清单 Review

- 已生成 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`。
- 清单覆盖强制开发规则、MVP-A/B/C 边界、全局完成定义、Phase 0-8 阶段任务、每阶段入口条件、建议文件、测试命令、完成定义和禁止事项。
- 已执行 `git diff --check`、章节关键词检索和文件行数校验；本次为文档清单任务，未运行应用测试。

## 2026-05-13 Phase 0 规格冻结计划

- [x] 复习 `AGENTS.md`、本任务清单和 Pipeline v2 分析文档。
- [x] 检查 `git status`，确认没有未提交的用户改动需要保护。
- [x] 验证分析文档是否覆盖状态机 Mermaid、节点契约、BDD 场景、fixture repo 和 v1/v2 共存。
- [x] 在分析文档补充 Phase 0 冻结确认，不修改运行时代码。
- [x] 更新阶段开发清单中的 Phase 0 状态。
- [x] 执行 `git diff --check` 和关键词检索。

## 2026-05-13 Phase 0 Review

- Phase 0 已冻结：现有分析文档已覆盖状态机、节点 runtime / 输入 / 输出 / gate / 失败循环 / 产物文件，并补充 fixture repo 与 v1/v2 共存结论。
- 已将 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md` 标记为 Phase 0 完成、Phase 1 开始。
- 本阶段只改 `improve/pipeline/` 文档，不涉及 package version 变更，不改 README / AGENTS，不改运行时代码。

## 2026-05-13 Phase 1 计划

- [x] 先补测试：`ContributionTask` 持久化、`patch-work` manifest/revision/路径安全、preflight blocker。
- [x] 新增 `ContributionTask` / `PatchWorkManifest` / preflight 相关共享类型。
- [x] 新增 `contribution-task-service.ts`，使用 JSON 索引和 JSONL event。
- [x] 新增 `pipeline-patch-work-service.ts`，支持固定文件、manifest、checksum、revision、原子写入和路径安全。
- [x] 新增 `pipeline-preflight-service.ts`，检查 Git root、branch、remote、未提交变更、冲突、Claude CLI、Codex CLI、Git、包管理器。
- [x] 递增受影响 package patch version。
- [x] 运行 Phase 1 指定测试、`bun run typecheck` 和 `git diff --check`，通过后追加 Review。

## 2026-05-13 Phase 1 Review

- 已完成 Phase 1，不修改六节点 graph、不改 UI、不实现远端 GitHub 行为、不改 `.gitignore`。
- 新增 `ContributionTask`、`PatchWorkManifest`、`PipelinePreflightResult` 等共享类型；`@rv-insights/shared` 版本 `0.1.25 -> 0.1.26`。
- 新增 `contribution-task-service.ts`，支持 `contribution-tasks.json` 索引、`contribution-tasks/{taskId}.jsonl` 事件、运行时 enum/schema 校验和坏行容错。
- 新增 `pipeline-patch-work-service.ts`，支持 manifest、固定文件、checksum、revision 归档和原子写入；路径安全覆盖绝对路径、`..`、文件/目录 symlink、manifest/tmp/bak symlink、dangling symlink、保留路径。
- 新增 `pipeline-preflight-service.ts`，覆盖 Git root/branch/remote/dirty/conflict、Claude CLI、Codex CLI、Git 和包管理器识别；resolver 异常会转换为稳定 blocker。
- `@rv-insights/electron` 版本 `0.0.46 -> 0.0.47`，`bun.lock` workspace 版本元数据已同步。
- 已新增 `tasks/lessons.md`，记录本轮路径安全和运行时校验教训。
- 验证通过：Phase 1 + v1 graph 兼容测试 35 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`、代码复审无阻塞问题。
- 全量 `bun test` 已运行，结果 264 pass / 1 fail；失败为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次 Phase 1 改动。

## 2026-05-14 进度文档更新计划

- [x] 检查 `git status`，确认 Phase 1 已提交后没有待保护的 tracked 改动。
- [x] 更新 Pipeline v2 checklist，明确 Phase 0/1 已完成、Phase 2-8 未完成、下一步只能进入 Phase 2。
- [x] 在分析规格文档中补充当前实现状态指针，避免下次启动误读为已进入源码开发后续阶段。
- [x] 在 checklist 中追加下次启动提示词，便于新会话按当前进度继续。
- [x] 执行文档校验并追加 Review。

## 2026-05-14 进度文档更新 Review

- 已更新 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md` 的最新状态快照和下次启动提示词。
- 已更新 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`，声明当前实现进度以 checklist 为准：Phase 0/1 已完成，Phase 2 尚未开始。
- 本轮只修改跟踪文档和本地任务记录，不进入 Phase 2，不修改 README / AGENTS，不改运行时代码。

## 2026-05-14 Phase 2 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 2 内容。
- [x] 检查 `git status`，确认当前待保护改动只涉及 Pipeline 进度文档。
- [x] 将 checklist 中 Phase 2 “阶段开始”和入口条件标记为已开始 / 已满足。
- [x] 先补 Phase 2 测试：shared state replay、v1/v2 graph、runner router strategy、StageRail display model。
- [x] 实现 shared v2 类型：`version?: 1 | 2`、`committer` 节点、v2 stage output、v2 gate kind。
- [x] 实现 state replay 的 v1/v2 分支，保持 v1 records replay 不变。
- [x] 实现 v2 fake graph 或 builder，让 tester approve 后进入 committer，不替换 v1 graph。
- [x] 实现 runner strategy 表驱动映射：explorer/planner 使用 Claude，developer/reviewer/tester/committer 使用 Codex。
- [x] 更新六节点 display model，不做 UI 大改。
- [x] 递增受影响 package patch version。
- [x] 运行 Phase 2 指定测试、`bun run typecheck` 和 `git diff --check`，通过后追加 Review。

## 2026-05-14 Phase 2 Review

- Phase 2 已完成并已提交，commit `53119675ee4f975f463f7214d2b00a2ae9e0c4a5`（`feat(pipeline): 接入 Phase 2 六 Agent v2 骨架`）；未进入 Phase 3。
- 新增 Pipeline v2 共享契约：`PipelineVersion`、`PipelineSessionMeta.version`、`PipelineStateSnapshot.version`、`committer` 节点、v2 gate kind、explorer/planner/developer/reviewer/tester/committer 扩展 stage output。
- `pipeline-state` 支持 v1/v2 replay 分支：v1 tester approve 仍 completed；v2 tester approve 进入 committer，committer approve 后 completed。
- 新增 `createPipelineGraphV2`，保留 `createPipelineGraph` v1；v2 fake runner happy path 覆盖 explorer -> planner -> developer -> reviewer -> tester -> committer。
- 新增 `pipeline-node-router.test.ts`，runner strategy 表驱动：v1 保护 tester=Claude，v2 explorer/planner=Claude、developer/reviewer/tester/committer=Codex。
- StageRail display model 支持 v2 六节点展示，`PipelineStageRail` / `PipelineGateCard` 接收 version；没有做 Phase 3 UI 大改。
- 代码审查后已修复两个契约风险：v2 explorer gate kind 改为 `task_selection`，gate decision record 持久化 `kind`、`selectedReportId`、`submissionMode`。
- `@rv-insights/shared` 版本 `0.1.26 -> 0.1.27`，`@rv-insights/electron` 版本 `0.0.47 -> 0.0.48`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 2 指定测试 + service/runner 补充测试 72 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 代码审查复核通过：两个 MEDIUM finding 已解决，无阻塞 finding。
- 全量 `bun test` 已运行，结果 274 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 2 改动。

## 2026-05-14 Phase 2 提交后进度文档更新计划

- [x] 检查 `git status`，确认 Phase 2 已提交后没有待保护的 tracked 改动。
- [x] 更新 Pipeline v2 checklist，明确 Phase 2 已提交、Phase 3 尚未开始、下一步只能进入 Phase 3。
- [x] 更新分析规格文档“当前实现进度”，避免下次启动误读为 Phase 2 未提交。
- [x] 更新本地 todo，记录 Phase 2 commit 和后续开发边界。
- [x] 执行文档校验并追加 Review。

## 2026-05-14 Phase 2 提交后进度文档更新 Review

- 已同步 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`：最近阶段提交更新为 `53119675ee4f975f463f7214d2b00a2ae9e0c4a5`，Phase 2 标记为已完成并提交，Phase 3 仍未开始。
- 已同步 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`：当前实现进度改为 Phase 2 已完成并提交。
- 后续启动只能从 Phase 3 开始：先写 Phase 3 计划并标记 checklist，再先补测试 / BDD 场景，随后实现 Explorer 任务选择、Planner 文档审核和 patch-work IPC / preload / UI board。
- 阶段完成纪律已明确：每完成一个阶段并满足完成定义后，自动单独提交；不默认 push 或创建 PR。

## 2026-05-14 Phase 3 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 3 相关内容。
- [x] 检查 `git status`，确认当前待保护改动只涉及 Pipeline 进度文档。
- [x] 将 checklist 中 Phase 3 “阶段开始”和入口条件标记为已开始 / 已满足。
- [x] 先补 Phase 3 测试 / BDD 场景：explorer task selection、planner document gate、patch-work IPC、`ExplorerTaskBoard`、`ReviewDocumentBoard`。
- [x] 扩展 shared / main 契约：explorer report refs、task selection gate、planner document refs / checksum / revision 反馈。
- [x] 扩展 `pipeline-patch-work-service`：读取 manifest、读取安全文件、列 explorer reports、选择 report 并生成 / 更新 `selected-task.md`。
- [x] 接入 IPC 与 preload：读取 patch-work manifest / 文件 / explorer reports / select-task，保持主 UI 使用结构化 IPC，不从 records 反推业务状态。
- [x] 扩展 v2 graph / runner 测试桩：explorer 输出多份 `patch-work/explorer/report-*.md`，用户选择 report 后才能进入 planner，planner 读取 `selected-task.md` 并写 `plan.md` / `test-plan.md`。
- [x] 新增 `ExplorerTaskBoard` 和 `ReviewDocumentBoard` 初版 UI，使用 Pipeline Jotai 状态和结构化 IPC 调用。
- [x] 递增受影响 package patch version。
- [x] 运行 Phase 3 指定测试、`bun run typecheck`、`git diff --check` 和必要的锁文件校验，通过后追加 Review 并单独提交 Phase 3。

## 2026-05-14 Phase 3 Review

- Phase 3 已完成实现和最终复核，等待本轮单独提交。
- 新增 patch-work 结构化读取与选择能力：manifest / 文件读取、explorer reports 列表、select task 写 `selected-task.md`、planner 文档 accepted revision / checksum 记录。
- v2 explorer 会把结构化候选写到 `patch-work/explorer/report-*.md`；v2 planner 会读取 `selected-task.md` 并写 `plan.md` / `test-plan.md`。
- `task_selection` gate 现在要求 `selectedReportId`，选择后更新 `ContributionTask` 和 `PatchWorkManifest`；planner `document_review` 接受后记录 `plan.md` / `test-plan.md` 的 accepted checksum。
- 新增 `pipeline-v2:get-patch-work-manifest`、`pipeline-v2:read-patch-work-file`、`pipeline-v2:list-explorer-reports`、`pipeline-v2:select-task` IPC / preload 契约。
- UI 新增 `ExplorerTaskBoard` 和 `ReviewDocumentBoard`，`PipelineView` 在 v2 task selection / planner document gate 时通过结构化 IPC 读取 patch-work，不从 records 反推业务状态。
- `@rv-insights/shared` 版本 `0.1.27 -> 0.1.28`，`@rv-insights/electron` 版本 `0.0.48 -> 0.0.49`，`bun.lock` 已同步。
- 复核后已加固：explorer 重跑清理旧 reports；explorer / planner 运行时只读工具约束；manifest 登记文件、任务选择和 planner 文档接受均校验 checksum；篡改 manifest 指向保留路径会被拒绝。
- 验证通过：Phase 3 聚焦测试 65 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 297 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 3 改动。

## 2026-05-14 Phase 3 前端可见性修复计划

- [x] 记录教训：组件接入 gate 不等于用户可见，必须确认新建入口能走到 v2 gate。
- [x] 让新建 Pipeline 前端入口显式创建 v2 贡献会话，并在按钮文案中标注贡献 Pipeline v2。
- [x] 扩展 createPipelineSession 主进程 / preload 契约，保留旧调用缺省 v1 兼容语义。
- [x] v2 会话启动前自动创建 ContributionTask 和 patch-work manifest，保证 ExplorerTaskBoard 有结构化数据来源。
- [x] 补测试：v2 session version 持久化、非法 version 拒绝、v2 start 自动创建 ContributionTask / manifest。
- [x] 运行聚焦测试、`bun run typecheck`、`git diff --check` 和锁文件 dry-run 后追加 Review。

## 2026-05-14 Phase 3 前端可见性修复 Review

- 已修复用户指出的前端入口不可见问题：默认新建入口现在显式创建 v2 贡献 Pipeline，并在侧边栏按钮显示“新建贡献 Pipeline”和 `v2` 标识。
- 已保留 v1 兼容语义：`createPipelineSession` 缺省仍是 v1，显式 version 只用于 v2 贡献入口。
- v2 会话启动前会自动创建 `ContributionTask` 和 `patch-work/manifest.json`，确保 Explorer task selection / Planner document review 看板能从正常 UI 路径读取结构化数据。
- `@rv-insights/electron` 版本 `0.0.49 -> 0.0.50`，`bun.lock` workspace metadata 已同步。
- 验证通过：可见性修复聚焦测试 47 pass，Phase 3 扩展测试 76 pass，`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 均通过。
- 全量 `bun test` 已运行，结果 300 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次可见性修复。

## 2026-05-14 Phase 3 Explorer JSON 解析错误修复计划

- [x] 检查 `git status`，确认当前没有未提交 tracked 改动。
- [x] 记录教训：Agent 结构化输出不能假设模型只返回 JSON，必须有解析或恢复兜底。
- [x] 定位 explorer 结构化输出解析逻辑和 v2 prompt 契约。
- [x] 先补测试覆盖 explorer 返回自然语言而非 JSON 的场景。
- [x] 实现修复：优先提取 JSON；完全无 JSON 时为 explorer 生成可恢复 task selection fallback，避免 UI 卡在解析失败。
- [x] 递增受影响 package patch 版本。
- [x] 运行聚焦测试、`bun run typecheck`、`git diff --check` 和锁文件 dry-run，追加 Review 并单独提交。

## 2026-05-14 Phase 3 Explorer JSON 解析错误修复 Review

- 已修复截图中的 `Pipeline explorer 结构化输出解析失败: 输出不是合法 JSON 对象`。
- explorer 现在仍会优先解析 JSON / fenced JSON / 文本中的平衡 JSON object；如果完全没有 JSON，会将自然语言输出转换为受控 fallback stage output。
- v2 explorer fallback 会写入 `patch-work/explorer/report-001.md` 并回填 reports，让 UI 进入 task selection，而不是停在节点失败。
- 已强化所有 Pipeline 节点 system prompt：最终回复必须只包含一个 JSON object；v2 explorer 额外要求把探索过程压缩进 schema 字段。
- `@rv-insights/electron` 版本 `0.0.50 -> 0.0.51`，`bun.lock` workspace metadata 已同步。
- 验证通过：新增复现用例通过；`pipeline-node-runner.test.ts` 13 pass；runner / graph / service 受影响测试 40 pass；`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 均通过。
- 全量 `bun test` 已运行，结果 301 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次 bugfix。

## 2026-05-14 Pipeline 停止按钮反馈修复计划

- [x] 检查 `git status`，确认 Phase 3 后续提交后当前没有待保护的 tracked 改动。
- [x] 复习 `tasks/lessons.md` 与 Pipeline stop 前后端链路，确认本次只修复 Phase 3 后续回归，不进入 Phase 4。
- [x] 记录教训：停止按钮不能只发 IPC，必须有立即可见的 UI 反馈和状态回填。
- [x] 先补测试：Pipeline stop service 返回 terminated 快照，Pipeline composer 停止中 / 已停止文案模型可验证。
- [x] 实现修复：stop IPC 返回结构化 state，前端点击后显示停止中，成功后同步 terminated 状态并展示已停止提示。
- [x] 递增受影响 package patch 版本。
- [x] 运行聚焦测试、`bun run typecheck`、`git diff --check` 和锁文件 dry-run，追加 Review 并提交 bugfix。

## 2026-05-14 Pipeline 停止按钮反馈修复 Review

- 已修复点击“停止运行”后没有可见反馈的问题：按钮请求期间显示“正在停止...”，当前面板会通过 `aria-live` 展示“正在停止当前 Pipeline...”。
- stop IPC 现在返回 `PipelineStateSnapshot`；renderer 不再只依赖 stream 广播，点击后会先乐观回填 `terminated`，成功返回后再用主进程快照校准状态。
- 停止完成后输入区会保留“Pipeline 已停止运行，可以调整任务后重新启动。”提示；如果 stop IPC 失败，会回滚原状态并展示失败原因。
- `@rv-insights/electron` 版本 `0.0.51 -> 0.0.52`，`bun.lock` workspace metadata 已同步。
- 验证通过：`PipelineComposer.test.ts`、`pipeline-atoms.test.ts`、`pipeline-service.test.ts` 共 30 pass；`bun run typecheck`；`git diff --check`；`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 303 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次 stop 反馈修复。

## 2026-05-14 Pipeline 节点静默运行反馈修复计划

- [x] 检查 `git status`，确认当前没有 tracked 待保护改动。
- [x] 记录教训：节点已启动但模型或工具调用暂未产生 `text_delta` 时，UI 不能只显示空等待。
- [x] 定位实时输出面板和 live output Jotai 状态模型。
- [x] 先补测试：节点启动后没有文本 delta 时，实时输出看板应展示“正在准备/等待模型首个输出”的明确说明。
- [x] 实现修复：让 `PipelineRecords` 的空输出状态给出节点已启动、模型/工具调用可能静默的进度说明。
- [x] 递增受影响 package patch 版本。
- [x] 运行聚焦测试、`bun run typecheck`、`git diff --check` 和锁文件 dry-run，通过后追加 Review 并提交 bugfix。

## 2026-05-14 Pipeline 节点静默运行反馈修复 Review

- 已定位截图“探索节点正在输出 / 正在等待节点输出...”的原因：`node_start` 只创建空 live buffer，真实 explorer 在模型首包或工具调用期间可能没有 `text_delta`，导致 UI 看起来卡住。
- 已补测试覆盖：节点启动后应立即写入可见进度；实时输出面板在无模型文本或只有进度文本时展示“节点正在运行”，而不是空等待。
- 已实现修复：`applyPipelineLiveOutput` 在 `node_start` 写入中文启动进度；`PipelineRecords` 新增 live output view model，区分运行进度与真实模型输出，并为面板增加 `aria-live`。
- `@rv-insights/electron` 版本 `0.0.52 -> 0.0.53`，`bun.lock` workspace metadata 已同步。
- 验证通过：聚焦测试 11 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 306 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次 live output 修复。

## 2026-05-14 最新开发状态文档同步计划

- [x] 检查 `git status` 和最新 commit，确认当前代码提交为 `ffd1f309`，tracked worktree 干净。

## 2026-05-16 UI-3 Pipeline 工作台计划

- [x] 执行 `git status --short`，确认仅有需保护的 `.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。
- [x] 复习 `tasks/lessons.md`、UI checklist 的 UI-3 阶段、视觉规范 `5.2 Pipeline` 与 `5.8 页面级 Wireframe`。
- [x] 完成 UI-3 before 审计：PipelineHeader、PipelineStageRail、PipelineRecords、PipelineGateCard、PipelineComposer。
- [x] 改造 Pipeline 主面板结构和视觉层级，不回头重复 UI-2。
- [x] 补充或调整 Pipeline renderer / display model 聚焦测试。
- [x] 运行 `bun run --filter='@rv-insights/electron' typecheck`、Pipeline 聚焦测试、`git diff --check`。
- [x] 采集 UI-3 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 和本 Review，并单独提交 UI-3。

### UI-3 before 审计

- PipelineHeader：已有标题、状态 badge 和当前节点，但整体仍是普通圆角卡片；状态、进度、等待人工和下一步操作没有形成工作台首屏的主视觉锚点。
- PipelineStageRail：阶段标签已中文化，但副文案仍显示 raw node enum；连接线较弱，waiting / failed / stopped 与用户可读状态文案不足；窄窗口依赖 `min-w`，存在横向溢出风险。
- PipelineRecords：已有产物 / 日志 tabs、搜索、阶段筛选和 live output 兜底；问题是控制区视觉权重过大，记录卡 anatomy 不够统一，badge / 时间 / 阶段 / 类型层级不明显，空态仍偏日志页。
- PipelineGateCard：有 feedback label 和按钮校验，但 gate 仍像普通 amber 卡片；高优先级操作、风险摘要、阶段信息和 Approve / Request changes 的视觉权重还不够清楚。
- PipelineComposer：停止中 / 已停止反馈已修复，但运行中 Composer 仍像普通任务卡；空闲输入区缺少“控制台操作区”层级，运行中任务摘要和停止按钮需要更稳定的布局。

## 2026-05-16 UI-3 Pipeline 工作台 Review

- 已完成 Pipeline 主工作台改造：Header、StageRail、Records / Live output、Gate / Review 操作区、Composer、Failure 卡片统一使用 surface / status token 和 8px card radius。
- StageRail 新增 stopped 视觉状态、中文状态标签和 `aria-label`，不再在阶段卡片中展示 raw node enum；阶段按钮保留 focus ring 并可继续定位 Records。
- Records 强化记录 anatomy：阶段 / 类型 badge、tabular time、产物路径 monospace、live output running 说明和阶段聚合标题。
- Gate / Review 右侧操作区覆盖通用 Gate、ExplorerTaskBoard、ReviewDocumentBoard、ReviewerIssueBoard、TesterResultBoard、CommitterPanel；Approve / Reject / Rerun 视觉权重更清楚，高风险 gate 使用 danger token。
- 验证通过：Pipeline 聚焦测试 25 pass；`bun run --filter='@rv-insights/electron' typecheck`；`git diff --check`。
- 截图已采集：`improve/ui/screenshots/pipeline-ui3-light-desktop.png`、`pipeline-ui3-dark-desktop.png`、`pipeline-ui3-slate-light-desktop.png`。截图通过 localhost 临时预览采集，原因是浏览器安全策略拒绝直接打开 `data:` / `file:` URL。

- [x] 更新 Pipeline checklist 的最新状态快照、Phase 3 后续 bugfix、版本号、验证状态和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”，明确 Phase 0-3 完成、Phase 3 后续修复已提交、Phase 4-8 未开始。
- [x] 不修改 README / AGENTS，不进入 Phase 4，不执行 push / PR。
- [x] 执行文档校验并追加 Review。

## 2026-05-14 最新开发状态文档同步 Review

- 已同步 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`：最近提交更新为 `ffd1f309905c08fdd1bf471ef560361d3585d236`，分支状态为 ahead 8 commits，Phase 4 仍未开始。
- 已同步 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`：补充 Phase 3 提交 `881c7ad1` 和后续 bugfix `e65f8ac2` / `71bcb1df` / `364cf964` / `ffd1f309`。
- 当前版本状态已记录：`@rv-insights/shared` 为 `0.1.28`，`@rv-insights/electron` 为 `0.0.53`。
- 当前验证状态已记录：Phase 3 及后续 bugfix 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 通过；全量 `bun test` 最新为 306 pass / 1 fail / 1 error，失败仍为既有 `completion-signal.test.ts` Electron named export 测试环境问题。
- 下次启动只允许从 Phase 4 开始：先检查 `git status`，写 Phase 4 计划并标记 checklist，再先补测试，不开启真实 commit / push / PR。

## 2026-05-14 Phase 4 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 4 相关内容。
- [x] 检查 `git status`，确认开始 Phase 4 前 tracked 工作区干净。
- [x] 将 checklist 中 Phase 4 “阶段开始”和入口条件标记为已开始 / 已满足。
- [x] 先补 Phase 4 测试 / BDD 场景：developer document gate、reviewer issue loop、`patch-work/dev.md` / `review.md`、Developer/Reviewer UI 状态。
- [x] 扩展 shared 契约：developer `devDocRef` / changed files / tests / risks，reviewer structured issues / `reviewDocRef` / iteration metadata。
- [x] 扩展 patch-work 服务：安全写入和读取 `dev.md` / `review.md`，登记 manifest revision 和 checksum。
- [x] 扩展 v2 graph / runner：developer 读取 accepted `plan.md` / `test-plan.md` 并写 `dev.md`，developer 文档审核通过后才进入 reviewer；用户要求修改时回 developer 并产生新 revision。
- [x] 实现 reviewer issue loop：reviewer read-only 读取 `dev.md`、Git diff 和测试方案，输出结构化 issues / `review.md`；不通过且未达上限自动回 developer，达到上限进入人工 gate。
- [x] 接入 UI：复用 `ReviewDocumentBoard` 审核 developer 文档，新增或扩展 `ReviewerIssueBoard` 展示 severity / status，并继续通过结构化 IPC 读取 patch-work 文档。
- [x] 递增受影响 package patch version，预计至少包含 `@rv-insights/shared` 和 `@rv-insights/electron`。
- [x] 运行 Phase 4 指定测试、`bun run typecheck`、`git diff --check` 和必要的锁文件校验；满足完成定义后追加 Review 并单独提交 Phase 4。

## 2026-05-14 Phase 4 Review

- Phase 4 已实现 Developer 文档审核与 Reviewer Issue Loop，并已单独提交。
- developer 现在必须读取已接受的 `plan.md` / `test-plan.md`，输出 `dev.md` 并进入 developer document gate；接受后才进入 reviewer。
- reviewer 读取已接受的 `dev.md`、方案和测试方案，保持 read-only，输出结构化 issues 与 `review.md`；不通过且未达 3 轮上限时自动回 developer，达到上限进入人工 gate。
- UI 新增 `ReviewerIssueBoard`，`ReviewDocumentBoard` 支持 developer 阶段，仍通过结构化 IPC 读取 patch-work 文档，不从 records 反推业务状态。
- 代码审查发现的 SDK abort 竞态已修复：Codex SDK runner 在准备阶段、`thread.run()` 后和 patch-work enrichment 后都会检查中止状态，避免 stopped 会话继续写 `dev.md` / `review.md` 或发送 `node_complete`。
- `@rv-insights/shared` 版本 `0.1.28 -> 0.1.29`，`@rv-insights/electron` 版本 `0.0.53 -> 0.0.54`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 4 聚焦测试 108 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 324 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 4 改动。
- 已创建 Phase 4 单独提交：`d10387ca`（`feat(pipeline): 完成 Phase 4 开发审核与审查循环`）。

## 2026-05-15 Phase 4 后进度文档同步计划

- [x] 检查 `git status`，确认当前 tracked 工作区干净，分支 `base/pipeline-v0` ahead 10 commits，未执行 push / PR。
- [x] 更新 Pipeline checklist 最新状态快照：Phase 0-4 已完成，Phase 5-8 未完成，下一步只能进入 Phase 5。
- [x] 更新 Pipeline 分析文档“当前实现进度”：写入 Phase 4 具体 commit、版本状态、验证状态和剩余闭环缺口。
- [x] 在本地 todo 记录本次文档同步结果和下次启动提示词。
- [x] 不修改 README / AGENTS，不进入 Phase 5，不执行 push / PR。

## 2026-05-15 Phase 4 后进度文档同步 Review

- 已将 Phase 4 提交固定记录为 `d10387cae3557ca57e3679f55c5ab48cd7e75766`（`feat(pipeline): 完成 Phase 4 开发审核与审查循环`）。
- 已确认已完成范围：Phase 0 规格冻结、Phase 1 preflight / ContributionTask / patch-work 基础、Phase 2 六节点 v2 骨架、Phase 3 explorer task selection / planner document gate、Phase 4 developer document gate / reviewer issue loop。
- 已确认未完成范围：Phase 5 tester result / patch-set、Phase 6 committer draft-only、Phase 7 本地 commit gate、Phase 8 远端 PR 集成。
- 下次启动只能从 Phase 5 开始：先检查 `git status`，在本文件写 Phase 5 计划，把 checklist 中 Phase 5 “阶段开始”标为已开始，然后先补测试 / BDD 场景再实现。
- 当前版本状态：`@rv-insights/shared` 为 `0.1.29`，`@rv-insights/electron` 为 `0.0.54`。
- 当前验证状态：Phase 4 聚焦测试 108 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 324 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 2026-05-15 Phase 5 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 5 / Tester 相关内容。
- [x] 检查 `git status`，确认开始 Phase 5 前只有 Pipeline 进度文档存在未提交 tracked 改动，需要继续保护，不得覆盖。
- [x] 将 checklist 中 Phase 5 “阶段开始”标记为已开始，并同步当前状态为 Phase 5 计划中。
- [x] 先补 Phase 5 测试 / BDD 场景：tester result、patch-set manifest、patch-set 排除 `patch-work/**`、测试失败 / 环境阻塞路径、`TesterResultBoard` UI 状态。
- [x] 扩展 shared 契约：tester result、patch-set 文件引用、测试证据、blocked gate payload 和必要的 stage output 字段。
- [x] 扩展 `pipeline-patch-work-service`：安全写入 / 读取 `result.md`、`patch-set/changes.patch`、`patch-set/changed-files.json`、`patch-set/diff-summary.md`、`patch-set/test-evidence.json`，并登记 manifest revision / checksum。
- [x] 新增或扩展 patch-set 生成服务，基于 Git diff 生成草稿 patch-set，默认排除 `patch-work/**`，且不执行 commit / push / PR。
- [x] 扩展 Codex tester runner：读取 accepted `dev.md` / `review.md` / `test-plan.md` 和 Git diff，执行或记录测试计划，必要时触发 developer 修复或 `test_blocked` gate。
- [x] 接入 IPC / preload / Jotai / UI：复用结构化 patch-work 文档读取能力，`TesterResultBoard` 不从 records 反推主业务状态。
- [x] 递增受影响 package patch version：`@rv-insights/shared` `0.1.29 -> 0.1.30`，`@rv-insights/electron` `0.0.54 -> 0.0.55`。
- [x] 运行 Phase 5 指定测试、`bun run typecheck`、`git diff --check` 和必要的锁文件校验；满足完成定义后追加 Review 并单独提交 Phase 5。

## 2026-05-15 Phase 5 Review

- Phase 5 已实现 Codex Tester、测试报告与 patch-set 草稿，并已单独提交 `aa08baf257fab43db6c9c30a106466f3b1629da1`（`feat(pipeline): 完成 Phase 5 Tester 结果与 patch-set 草稿闭环`）；未进入 Phase 6。
- Tester v2 读取 accepted `test-plan.md` / `dev.md` 和最新 `review.md`，以 workspace-write Codex 运行；prompt 明确禁止真实 git / commit / push / PR，runner 前置命令 wrapper 与禁用 `GIT_DIR` 阻断常规和绝对路径 Git 调用，并在运行前后额外校验 Git HEAD、refs、index、local config 与已有补丁未被整体丢弃。
- 新增 `pipeline-git-submission-service.ts`，基于 `git diff HEAD` + untracked 文件生成 patch-set 草稿，默认排除 `patch-work/**`；已覆盖 staged 变更和正文出现 `patch-work/**` 的边界。
- Tester 输出并登记 `patch-work/result.md`、`patch-set/changes.patch`、`patch-set/changed-files.json`、`patch-set/diff-summary.md`、`patch-set/test-evidence.json`，manifest 记录 revision / checksum。
- 测试失败、测试未运行、缺少 `passed`、缺失 evidence、存在 failed / skipped evidence 或 unsafe patch-set 会进入 `test_blocked` gate；用户接受风险后进入 committer draft-only，选择修订会带反馈回 developer。
- UI 新增 `TesterResultBoard`，通过现有结构化 patch-work 文档读取 result / patch-set / evidence，不从 records 反推主业务状态。
- Backend approve 会服务端复验 patch-set 未包含 `patch-work/**`，且正常 `document_review` approve 必须确认 `test-evidence.json` 非空并全部 passed；`test_blocked` approve 仅作为显式风险接受。
- 代码审查后已补 hardening：绝对路径 Git 绕过会被默认 `GIT_DIR` 禁用和 refs / index / config / 补丁丢弃检测兜底；tester fallback `result.md` 的结论改为基于 failed / skipped evidence 的保守判断。
- 验证通过：Phase 5 聚焦测试 124 pass，`bun run typecheck`，`git diff --check`，`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 348 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 5 改动。

## 2026-05-15 Phase 5 后续启动提示词（历史归档）

此处原为 Phase 5 完成后进入 Phase 6 的启动提示。Phase 6 / Phase 7 现已完成，最新可用提示词见本文末尾“下次启动提示词（Phase 8）”。

## 2026-05-15 Phase 5 提交后开发状态文档同步计划

- [x] 检查 `git status` 和最新提交，确认 Phase 5 提交已改写为详细中文 commit 信息。
- [x] 更新 Pipeline checklist 最新状态快照：固定 Phase 5 最终 commit hash、分支 ahead 状态、已完成 / 未完成阶段和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”：固定 Phase 5 最终 commit hash，明确 Phase 6-8 尚未开始。
- [x] 更新本地 todo，记录本次文档同步结果和下次启动提示词。
- [x] 不修改 README / AGENTS，不进入 Phase 6，不执行 push / PR。

## 2026-05-15 Phase 5 提交后开发状态文档同步 Review

- 已将 Phase 5 最终提交固定记录为 `aa08baf257fab43db6c9c30a106466f3b1629da1`（`feat(pipeline): 完成 Phase 5 Tester 结果与 patch-set 草稿闭环`）。
- 已确认已完成范围：Phase 0 规格冻结、Phase 1 preflight / ContributionTask / patch-work 基础、Phase 2 六节点 v2 骨架、Phase 3 explorer task selection / planner document gate、Phase 3 后续可用性修复、Phase 4 developer document gate / reviewer issue loop、Phase 5 tester result / patch-set。
- 已确认未完成范围：Phase 6 committer draft-only、Phase 7 本地 commit gate、Phase 8 远端 PR 集成。
- 下次启动只能从 Phase 6 开始：先检查 `git status`，在本文件写 Phase 6 计划，把 checklist 中 Phase 6 “阶段开始”标为已开始，然后先补测试 / BDD 场景再实现。
- 当前版本状态：`@rv-insights/shared` 为 `0.1.30`，`@rv-insights/electron` 为 `0.0.55`。
- 当前验证状态：Phase 5 聚焦测试 124 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 348 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 2026-05-15 Phase 6 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 6 / Committer 相关内容。
- [x] 检查 `git status`，确认开始 Phase 6 前已有未提交 tracked 改动只涉及 Pipeline 进度文档，需要继续保护，不得覆盖。
- [x] 将 checklist 中 Phase 6 “阶段开始”和入口条件标记为已开始 / 已满足。
- [x] 先补 Phase 6 测试 / BDD 场景：committer draft-only schema、`commit.md` / `pr.md` manifest 登记、Git 写操作禁用、提交材料 UI 状态。
- [x] 扩展 shared 契约：committer stage output 明确 `commitDocRef`、`prDocRef`、commit message、PR title/body、blockers、risks、draft-only submission 状态。
- [x] 扩展 `pipeline-git-submission-service` 的只读能力：读取 Git status / diff 摘要、候选变更列表和 CONTRIBUTING / 贡献指南，不执行 `git add`、`git commit`、`git push` 或 GitHub 写 API。
- [x] 扩展 `pipeline-patch-work-service`：安全写入 / 读取 `commit.md`、`pr.md`，登记 manifest revision / checksum，并确保不会把 `patch-work/**` 默认纳入 patch-set 或提交候选。
- [x] 扩展 Codex committer runner：读取 `result.md`、`patch-set/*`、CONTRIBUTING 和 Git 状态，只生成提交 / PR 草稿，输出 draft-only blockers / risks。
- [x] 接入 graph / gate：tester approve 或 `test_blocked` 风险接受后进入 committer，committer 完成后进入 `submission_review` gate，默认动作仅保存提交材料，不进入 Phase 7 的真实 commit。
- [x] 接入 IPC / preload / Jotai / UI：新增 `CommitterPanel`，继续通过结构化 patch-work IPC 读取 `commit.md` / `pr.md` / 测试证据，不从 records 反推主业务状态。
- [x] 递增受影响 package patch version：`@rv-insights/shared` `0.1.30 -> 0.1.31`，`@rv-insights/electron` `0.0.55 -> 0.0.56`，并同步 `bun.lock` workspace metadata。
- [x] 运行 Phase 6 指定测试、`bun run typecheck`、`git diff --check` 和 `bun install --frozen-lockfile --dry-run`；满足完成定义后追加 Review 并单独提交 Phase 6。

## 2026-05-15 Phase 6 Review

- Phase 6 已完成 Committer Draft-Only 闭环，随本轮阶段提交落地；未进入 Phase 7。
- Committer v2 读取 accepted `result.md`、`patch-set/changes.patch`、`patch-set/changed-files.json`、`patch-set/diff-summary.md`、`patch-set/test-evidence.json`、CONTRIBUTING 和 Git 状态，只生成提交 / PR 草稿。
- 新增只读提交上下文读取能力：Git status、diff 摘要、变更文件、HEAD、分支和 CONTRIBUTING；读取 CONTRIBUTING 时拒绝 symlink 越界；不执行 `git add`、`git commit`、`git push` 或 GitHub 写 API，提交候选继续排除 `patch-work/**`。
- Committer enrichment 写入并登记 `patch-work/commit.md` 和 `patch-work/pr.md`，stage output 回填 `commitDocRef` / `prDocRef`，`localCommit` 和 `remoteSubmission` 保持 `not_requested`。
- `submission_review` gate 在 Phase 6 只接受 `submissionMode: local_patch`，会接受 `commit_doc` / `pr_doc` 并完成 ContributionTask；`local_commit` / `remote_pr` 会被拒绝，committer schema/parser 和 UI 也会阻止非 `draft_only` 提交状态。
- UI 新增 `CommitterPanel`，在 `submission_review` gate 通过结构化 patch-work IPC 读取 `commit.md` / `pr.md`，同时展示 patch-set 摘要、测试证据、blocker 和风险，不从 records 反推主业务状态。
- `@rv-insights/shared` 版本 `0.1.30 -> 0.1.31`，`@rv-insights/electron` 版本 `0.0.55 -> 0.0.56`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 6 聚焦测试 150 pass、runner 复核测试 54 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 362 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 6 改动。
- Phase 6 禁止事项已保持：未开启真实 commit、push 或 PR，未默认将 `patch-work/**` 加入 patch-set 或 commit 候选。

## 2026-05-15 Phase 6 后续启动提示

- Phase 6 已按阶段纪律单独提交，commit `fab7f906f546e619157286ffb6fe40c869f1d3e2`（`feat(pipeline): 完成 Phase 6 提交材料草稿闭环`），提交范围不包含 `patch-work/**`，不执行 push / PR。
- 下一步只能在用户明确允许本地 commit 能力后进入 Phase 7：受控本地 Commit Gate。
- Phase 7 开始前仍需先检查 `git status`，在本文件写 Phase 7 计划，并把 checklist 中 Phase 7 “阶段开始”标为已开始。
- Phase 7 必须先补本地 commit gate、重复 resume 幂等、commit result 回填和 UI 状态测试，再实现功能。
- Phase 7 禁止开启 push / PR，不得把 `patch-work/**` 默认加入 patch-set 或 commit。

## 2026-05-15 Phase 6 提交后开发状态文档同步计划

- [x] 检查 `git status` 和最新提交，确认 Phase 6 已改写为详细中文 commit 信息。
- [x] 更新 Pipeline checklist 最新状态快照：固定 Phase 6 最终 commit hash、已完成 / 未完成阶段、版本状态和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”：固定 Phase 6 最终 commit hash，明确 Phase 7-8 尚未开始。
- [x] 更新本地 todo，记录本次文档同步结果和下次启动提示词。
- [x] 不修改 README / AGENTS，不进入 Phase 7，不执行 push / PR。

## 2026-05-15 Phase 6 提交后开发状态文档同步 Review

- 已将 Phase 6 最终提交固定记录为 `fab7f906f546e619157286ffb6fe40c869f1d3e2`（`feat(pipeline): 完成 Phase 6 提交材料草稿闭环`），提交信息已包含详细中文说明。
- 已确认已完成范围：Phase 0 规格冻结、Phase 1 preflight / ContributionTask / patch-work 基础、Phase 2 六节点 v2 骨架、Phase 3 explorer task selection / planner document gate、Phase 3 后续可用性修复、Phase 4 developer document gate / reviewer issue loop、Phase 5 tester result / patch-set、Phase 6 committer draft-only。
- 已确认未完成范围：Phase 7 受控本地 Commit Gate、Phase 8 远端 PR 集成。
- 下次启动只能在用户明确允许本地 commit 能力后从 Phase 7 开始：先检查 `git status`，在本文件写 Phase 7 计划，把 checklist 中 Phase 7 “阶段开始”标为已开始，然后先补测试 / BDD 场景再实现。
- 当前版本状态：`@rv-insights/shared` 为 `0.1.31`，`@rv-insights/electron` 为 `0.0.56`。
- 当前验证状态：Phase 6 聚焦测试 150 pass、runner 复核测试 54 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 362 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 2026-05-15 Phase 7 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 7 相关内容。
- [x] 检查 `git status`，确认开始 Phase 7 前 tracked 工作区没有未提交文件；当前分支 `base/pipeline-v0` 相对远端 ahead 13 commits。
- [x] 将 checklist 中 Phase 7 “阶段开始”和“用户明确允许实现本地 commit 能力”标记为已满足；本阶段只实现 gated local commit，不执行 push / PR。
- [x] 先补 Phase 7 测试 / BDD 场景：local commit gate 未确认不提交、确认后 fixture repo 可提交、staging 默认排除 `patch-work/**`、重复 resume / operation id 不重复提交、commit result 回填 Contribution events、`CommitterPanel` local commit 状态。
- [x] 扩展 shared 契约：submission review `local_commit` 决策、commit operation id、staging candidate / excluded files、local commit result / error / attemptedAt / commitHash。
- [x] 扩展 `pipeline-git-submission-service`：`validateCommitPreconditions`、受控 staging policy、默认排除 `patch-work/**`、只允许候选文件 staged、执行 `git add` / `git commit` 前后校验、失败时保留提交材料和错误。
- [x] 接入主进程 graph / gate / service：只有用户明确选择 `submissionMode: local_commit` 且 operation id 未完成时才执行本地 commit；重复 resume 返回已记录结果，不重复 commit。
- [x] 接入 IPC / preload / Jotai / UI：`CommitterPanel` 继续通过结构化 patch-work IPC 展示提交材料，并展示 base branch、working branch、候选文件、排除文件、commit message、测试结论和提交结果。
- [x] 递增受影响 package patch version：`@rv-insights/shared` `0.1.31 -> 0.1.32`、`@rv-insights/electron` `0.0.56 -> 0.0.57`，并同步 `bun.lock` workspace metadata。
- [x] 运行 Phase 7 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`；满足完成定义后追加 Review 并单独提交 Phase 7，不执行 push / PR。

## 2026-05-15 Phase 7 Review

- Phase 7 已完成受控本地 Commit Gate，并已单独提交 `d6da8380dc69e179c24d542d4a73cd1be90216cc`（`feat(pipeline): 完成 Phase 7 受控本地提交闭环`）。
- Git service 新增 `validateCommitPreconditions` 和 `createLocalPipelineCommit`：本地 commit 必须显式 `confirmed: true`，无 operation id、无 commit message、detached HEAD、无候选变更、冲突或 staged `patch-work/**` 都会阻止提交。
- 受控 staging 只 stage Git status 候选源码文件，默认排除 `patch-work/**`；使用 literal pathspec 防止特殊文件名扩大 stage 范围，若 `patch-work/**` 已经进入 index，commit 前会二次阻断。
- `submission_review` gate 现在支持 `local_patch` 保存草稿和 `local_commit` 本地提交；`remote_pr` 仍被拒绝，push / PR 未开启。
- local commit 前会先只读校验 `commit.md` / `pr.md` checksum，commit result 会写入 `local_commit_created` / `local_commit_failed` Contribution events，并回填 committer stage output；重复 resume 使用 operation id 识别已创建结果，不重复执行 commit。
- `CommitterPanel` 新增本地 commit 候选、排除项、分支、测试证据和提交结果展示；仍通过结构化 patch-work IPC 读取 `commit.md` / `pr.md`，不从 records 反推主业务状态。
- `@rv-insights/shared` 版本 `0.1.31 -> 0.1.32`，`@rv-insights/electron` 版本 `0.0.56 -> 0.0.57`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 7 聚焦测试 80 pass，shared / ContributionTask 兼容测试 18 pass，`bun run typecheck`，`git diff --check`，`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 370 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 7 改动。
- Phase 7 禁止事项已保持：未开启 push / PR，未默认将 `patch-work/**` 加入 patch-set 或 commit 候选。

## 2026-05-15 Phase 7 提交后开发状态文档同步计划

- [x] 检查 `git status` 和最新提交，确认 Phase 7 已单独提交且当前 tracked 工作区只包含本轮文档同步。
- [x] 更新 Pipeline checklist 最新状态快照：固定 Phase 7 commit hash、分支 ahead 状态、已完成 / 未完成阶段和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”：固定 Phase 7 commit hash，明确 Phase 8 尚未开始。
- [x] 更新本地 todo：修正 Phase 7 Review 的提交状态，记录本次文档同步结果和下次启动提示词。
- [x] 不修改 README / AGENTS，不进入 Phase 8，不执行 push / PR。

## 2026-05-15 Phase 7 提交后开发状态文档同步 Review

- 已将 Phase 7 最终提交固定记录为 `d6da8380dc69e179c24d542d4a73cd1be90216cc`（`feat(pipeline): 完成 Phase 7 受控本地提交闭环`）。
- 已确认已完成范围：Phase 0 规格冻结、Phase 1 preflight / ContributionTask / patch-work 基础、Phase 2 六节点 v2 骨架、Phase 3 explorer task selection / planner document gate、Phase 3 后续可用性修复、Phase 4 developer document gate / reviewer issue loop、Phase 5 tester result / patch-set、Phase 6 committer draft-only、Phase 7 受控本地 Commit Gate。
- 已确认未完成范围：Phase 8 远端 PR 集成尚未开始，需要单独安全评审和用户明确允许远端写能力。
- 下次启动只能在用户明确允许远端写能力后从 Phase 8 开始：先检查 `git status`，在本文件写 Phase 8 计划，把 checklist 中 Phase 8 “阶段开始”标为已开始，然后先补测试 / BDD 场景再实现。
- 当前版本状态：`@rv-insights/shared` 为 `0.1.32`，`@rv-insights/electron` 为 `0.0.57`。
- 当前分支状态：`base/pipeline-v0` 相对 `origin/base/pipeline-v0` ahead 14 commits；未执行 push / PR。
- 当前验证状态：Phase 7 聚焦测试 80 pass、shared / ContributionTask 兼容测试 18 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 370 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 下次启动提示词（Phase 8）

```text
你正在 RV-Insights 仓库继续开发 Pipeline v2 六 Agent 开源贡献工作流。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md
- improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md 中“当前实现进度”和 Phase 8 相关内容

当前进度：
1. Phase 0-6 已完成并分别提交，Phase 6 commit 为 fab7f906f546e619157286ffb6fe40c869f1d3e2。
2. Phase 7 已完成并提交，commit 为 d6da8380dc69e179c24d542d4a73cd1be90216cc；已实现受控本地 Commit Gate，支持 local_commit 人工确认、受控 staging、默认排除 patch-work/**、operation id 幂等、commit hash 回填和 CommitterPanel 状态展示。
3. 当前 @rv-insights/shared 版本为 0.1.32，@rv-insights/electron 版本为 0.0.57。
4. 当前分支 base/pipeline-v0 相对 origin/base/pipeline-v0 ahead 14 commits；未 push，未创建 PR。
5. Phase 8 尚未开始；后续只能在单独安全评审和用户明确允许远端写能力后进入 Phase 8，不得提前接 push 或 PR。
6. 当前已知验证状态：Phase 7 聚焦测试 80 pass、shared / ContributionTask 兼容测试 18 pass、bun run typecheck、git diff --check、bun install --frozen-lockfile --dry-run 已通过；全量 bun test 最新结果为 370 pass / 1 fail / 1 error，失败仍为既有 completion-signal.test.ts Electron named export 测试环境问题。

开发纪律：
- 开始 Phase 8 前，先检查 git status，保护已有用户变更。
- 开始 Phase 8 前，在 tasks/todo.md 写 Phase 8 计划，并把 checklist 中 Phase 8 的“阶段开始”标为已开始。
- 每个阶段必须先补测试或 BDD 场景，再实现功能。
- 每完成一个阶段并通过完成定义后，单独提交一次；重新启动 Codex 会话后也要主动延续这个纪律。
- 不得默认执行 git push 或创建 PR，除非用户明确允许远端写能力并完成 Phase 8 gate。
- 不得把 patch-work/** 默认加入 patch-set、commit、push 或 PR。
- 使用 Bun：bun test、bun run typecheck。
- 状态管理继续使用 Jotai。
- 本地存储继续使用 JSON / JSONL / manifest，不引入本地数据库。
- README 和 AGENTS.md 只有在我明确允许后再修改。
- 完成功能代码变更时，递增受影响 package 的 patch 版本。

Phase 8 目标：
- 先补远端写二次确认、push/PR 幂等、远端结果回填和 UI 状态测试。
- 远端 push / PR 必须使用独立 high-risk gate，不得复用 Phase 7 local_commit 确认。
- UI 继续通过结构化 IPC 读取 patch-work 文档，不用 records 反推主业务状态。

Phase 8 禁止事项：
- 未经用户明确确认，不执行 push 或创建 PR。
- 不得把 patch-work/** 默认加入 push 或 PR。
```

## 2026-05-15 Phase 8 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 8 相关内容。
- [x] 检查 `git status`，确认开始前已有未提交 tracked 改动只涉及 Phase 7 提交后进度文档同步，需要继续保护并在其上追加 Phase 8 计划。
- [x] 将 checklist 中 Phase 8 “阶段开始”标记为已开始；用户已确认允许实现远端写能力代码，GitHub auth 首版使用本机 `gh` / git credential，不新增 token 存储。
- [x] 完成 Phase 8 独立安全评审：明确 push / PR 只能由主进程受控服务执行，必须使用独立 high-risk gate，不能复用 Phase 7 `local_commit` gate。
- [x] 先补 Phase 8 测试 / BDD 场景：远端写未二次确认不会执行、push/PR operation id 幂等、远端结果回填 Contribution events、失败保留本地 commit 与 PR 草稿、`CommitterPanel` 远端状态展示。
- [x] 扩展 shared 契约：`remote_write_confirmation` gate、远端 operation id、push result、PR result、remote URL / branch / commit hash / PR title/body / draft 状态和错误信息。
- [x] 扩展主进程服务：新增远端写 preflight，校验 remote URL、upstream/base/head branch、local commit hash、auth 可用性和权限；日志与 events 必须脱敏 token / Authorization / remote credentials。
- [x] 实现受控 remote submit 服务：真实 `git push` / `gh pr create --draft` 必须在用户明确授权、独立 gate 确认且 operation id 未完成时才执行；预填充 PR 页面和 GitHub API 创建路径不纳入首版，留作后续可选增强。
- [x] 接入 graph / gate / IPC / preload / Jotai / UI：`CommitterPanel` 继续通过结构化 patch-work IPC 读取 `commit.md` / `pr.md` / 测试证据，并展示远端确认、执行中、成功、失败和可恢复状态。
- [x] 确保 `patch-work/**` 不进入默认 push / PR 范围；远端提交基于 Phase 7 本地 commit hash，不把 patch-work 文档当成提交内容。
- [x] 递增受影响 package patch version：`@rv-insights/shared` `0.1.32 -> 0.1.33`、`@rv-insights/electron` `0.0.57 -> 0.0.58`，并同步 `bun.lock` workspace metadata。
- [x] 运行 Phase 8 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`；全量 `bun test` 仍需标注既有 `completion-signal.test.ts` Electron named export 问题。
- [x] 通过完成定义后追加 Phase 8 Review 并单独提交 Phase 8；不执行 push / PR，除非用户之后明确要求并通过 Phase 8 gate。

### Phase 8 独立安全评审

- 远端写能力必须作为独立 high-risk gate 实现：新增 `remote_write_confirmation` / 独立 remote operation id，不复用 Phase 7 的 `localCommitOperationId`、`local_commit` 决策或按钮状态。
- Agent / Codex runner 仍然不能直接执行 `git push`、`gh pr create` 或 GitHub API 写操作；远端写只能由主进程受控服务在人工确认后执行，并继续保留现有 Git / GitHub CLI 防护。
- 远端执行前必须验证已有 Phase 7 本地 commit hash、HEAD 未漂移、目标 remote / base / head branch、auth / 权限状态、PR title/body 和 draft 状态；所有 preview 信息要在 UI 中显示给用户确认。
- 幂等以 remote operation id 为准：重复 IPC / resume 只能复用已记录的 push / PR 结果；push 成功但 PR 失败时，后续重试不得重复创建远端分支副作用；PR 已存在时回填既有 URL。
- 审计记录写入 Contribution events，并回填 committer stage output；失败必须保留本地 commit、`commit.md`、`pr.md`、错误信息和可重试状态。
- 日志、events、artifact 不得泄露 token、Authorization header、带凭据 remote URL 或其它 secret；remote URL 展示前需要脱敏。
- `patch-work/**` 不进入默认 push / PR 范围；远端提交基于已创建的本地 commit hash，patch-work 文档只作为本地审核材料。
- 用户已确认允许实现远端写能力代码，GitHub auth 首版使用本机 `gh` / git credential，不新增 token 存储；本会话仍不执行真实 push / PR，验证使用 mock。

### Phase 8 安全评审修复计划

- [x] 先补测试覆盖阻塞项：push URL 优先于 fetch URL、`patch-work/**` 已在提交树或 push range 时阻断、远端命令错误脱敏、remote gate kind 服务端强制、push 成功但 PR 失败后可恢复。
- [x] 使用 `git remote get-url --push` 作为实际远端写目标，展示脱敏 push URL，并从 GitHub push URL 解析 `owner/repo` 后传给 `gh pr create --repo`。
- [x] 在远端写 preflight 中校验 `git ls-tree -r <commitHash> -- patch-work` 和本地 `refs/remotes/<remote>/<base>..<commitHash>` 变更路径，确保 `patch-work/**` 不会随远端提交历史进入 push/PR。
- [x] 用 `git check-ref-format --branch` 校验 head/base branch，并通过 `git ls-remote --heads` 确认目标 remote base branch 存在。
- [x] 将远端提交状态扩展为可恢复状态：持久化 `pushed`，遇到 PR 已存在时按 operation id 恢复为成功，避免重复不可控副作用。
- [x] 所有远端命令错误进入 Contribution events、stage artifact 和 UI 前统一脱敏，覆盖 credentialed URL、Authorization、`ghp_`、`github_pat_`、`GH_TOKEN` / `GITHUB_TOKEN`。
- [x] 修复后重新运行 Phase 8 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 和全量 `bun test`，再更新 Phase 8 Review。

## 2026-05-15 Phase 8 Review

- Phase 8 已完成受控远端 PR 集成，并已作为本轮单独提交；本会话未执行真实 `git push`，未创建真实 PR。
- 远端写必须走独立 `remote_write_confirmation` high-risk gate，不能复用 Phase 7 `local_commit` 确认；renderer 会发送独立 remote operation id 和二次确认，backend 会服务端强制校验 gate kind。
- 新增远端提交契约和状态：`remoteSubmissionOperationId`、`remoteWriteConfirmed`、`PipelineRemoteSubmissionSummary`、`pushed` 可恢复状态、`remote_submission_created` / `remote_submission_failed` Contribution events；`@rv-insights/shared` 版本 `0.1.32 -> 0.1.33`。
- `pipeline-git-submission-service` 新增远端 preflight / submit：读取实际 push URL（`git remote get-url --push`）并脱敏展示，从 GitHub push URL 解析 `owner/repo`，`gh pr create` 显式传 `--repo`，并使用本机 `gh` / git credential，不新增 token 存储。
- 远端写前会校验 `allowRemoteWrites`、confirmed、operation id、HEAD == local commit hash、remote/base/head branch、`gh auth status`、目标 remote base branch 存在，并拒绝 `headBranch === baseBranch`、`main`、`master` 等 base/default 分支直推风险。
- `patch-work/**` 远端防护已加固：不仅检查 Git index，还检查待推送 commit tree 和本地 remote/base 到 commit hash 的 push range 历史，发现 `patch-work/**` 曾进入历史即阻断远端写。
- 幂等和恢复：完整成功按 operation id 复用已创建 PR；push 成功但 PR 创建失败会持久化 `pushed` 状态，后续同 operation id 重试会跳过 push，只恢复 PR 创建；PR 已存在时通过 `gh pr view` 回填既有 URL。
- 错误脱敏：远端命令错误进入 stage artifact、Contribution events 和 UI 前统一清洗 credentialed remote URL、Authorization bearer、`ghp_`、`github_pat_`、`GH_TOKEN` / `GITHUB_TOKEN`。
- `CommitterPanel` 新增远端目标、独立确认、红色高风险提交按钮、远端成功 / 失败 / pushed 可恢复状态展示；本地 commit 后远端目标会从 `localCommit` fallback，不依赖 records 反推主业务状态。
- `@rv-insights/electron` 版本 `0.0.57 -> 0.0.58`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 8 核心聚焦测试 65 pass；Phase 8 周边兼容测试 147 pass；`bun run typecheck`；`git diff --check`；`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 387 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 8 改动。
- Phase 8 禁止事项已保持：未执行真实 push / PR；未默认把 `patch-work/**` 加入 patch-set、commit、push 或 PR；README 和 AGENTS.md 未修改。

## 2026-05-16 Phase 8 后开发状态文档同步计划

- [x] 检查 `git status`，确认当前工作树没有未提交代码变更，后续只做进度文档更新。
- [x] 更新 Pipeline checklist 最新状态快照：固定 Phase 8 commit `906834a0`、当前分支 ahead 状态、已完成 / 未完成范围和可选增强方向。
- [x] 更新 Pipeline 分析文档“当前实现进度”：固定 Phase 8 commit，明确真实 push / PR 尚未执行，列出后续可选增强。
- [x] 在本文件追加本次文档同步 Review，确保下次启动能从 `tasks/todo.md` 直接恢复上下文。
- [x] 不修改 README / AGENTS，不执行 push / PR，不改运行时代码。

## 2026-05-16 Phase 8 后开发状态文档同步 Review

- 已确认 Phase 8 最终提交为 `906834a0`（`feat(pipeline): 完成 Phase 8 远端 PR 受控集成`），当前工作树在文档更新前是干净的。
- 已同步 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`：Phase 0-8 均已完成，Phase 8 commit hash、版本号、验证状态、分支 ahead 16 commits、未执行真实 push / PR 均已明确记录。
- 已同步 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`：当前实现进度固定到 Phase 8，列出未完成 / 可选增强：真实远端写验证、低风险预填 PR 页面、GitHub API 创建路径、远端 preflight UI、已有 PR 同步 / 更新流程。
- 已知风险仍是既有全量测试问题：`apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题；Phase 8 聚焦与兼容测试、`bun run typecheck`、`git diff --check`、锁文件 dry-run 均已在 Phase 8 Review 中记录通过。
- 后续启动建议优先修复既有全量测试失败；如要执行真实 push / PR，必须由用户明确授权，并通过 Phase 8 独立 high-risk gate。README / AGENTS.md 仍只能在用户明确允许后修改。

## 2026-05-16 全客户端 UI 视觉规范文档计划

- [x] 复习 `tasks/lessons.md`，确认本次 UI 文档不触碰运行时代码和 README / AGENTS。
- [x] 基于当前 renderer 结构和 `ui-ux-pro-max` 审计维度，整理全客户端 UI 基线。
- [x] 在 `improve/ui/2026-05-16-client-ui-visual-spec.md` 写入中文视觉规范稿。
- [x] 覆盖 Pipeline、Agent、AppShell / Sidebar / Tab、Settings、Onboarding / Welcome、Chat 回退与 File Browser。
- [x] 执行静态校验：文件存在、章节完整、关键词覆盖和 `git diff --check`。
- [x] 在本文末尾追加 Review。

## 2026-05-16 全客户端 UI 视觉规范文档 Review

- 已新增 `improve/ui/2026-05-16-client-ui-visual-spec.md`，全文 576 行。
- 文档按计划覆盖背景与目标、当前 UI 基线、设计原则、全局视觉系统、核心页面规范、组件规范、交互与动效规范、可访问性检查和后续落地建议。
- 页面规范已覆盖 Pipeline、Agent、AppShell / Sidebar / Tab、Settings、Onboarding / Welcome、Chat 回退和 File Browser。
- 本次只新增 UI 规范文档与本地任务记录；未修改运行时代码、README 或 AGENTS，未新增 public API / IPC / shared type。
- 已完成静态校验：文件存在、章节与关键词检索通过，`git diff --check` 通过；本次为文档任务，未运行应用测试。

## 2026-05-16 全客户端 UI 视觉规范增强计划

- [x] 复核现有 `improve/ui/2026-05-16-client-ui-visual-spec.md`，确认不偏离“纯方案文档、不改实现代码、不改 README / AGENTS”的范围。
- [x] 在背景、基线、原则、全局视觉系统中补充更明确的适用对象、设计不变量、token 使用规则、主题验证和状态配方。
- [x] 在核心页面规范中补充 Pipeline、Agent、AppShell、Settings、Onboarding、Chat 回退、File Browser 的结构、状态、交互和验收细节。
- [x] 在组件、动效、可访问性和后续落地建议中补充组件 anatomy、状态矩阵、截图验收矩阵和 BDD 验证建议。
- [x] 执行静态检查：章节关键词覆盖、Markdown 可读性和 `git diff --check`。
- [x] 在本文末尾追加本次增强 Review。

## 2026-05-16 全客户端 UI 视觉规范增强 Review

- 已继续完善 `improve/ui/2026-05-16-client-ui-visual-spec.md`，全文从 576 行扩展到 1303 行。
- 背景与目标新增使用对象、成功标准和决策边界；当前 UI 基线新增审计口径、问题优先级、审计维度映射和应保留的风格资产。
- 设计原则新增设计不变量、信息降噪和 UI 文案规则；全局视觉系统新增 layout grid、z-index、状态配方、focus ring、loading / empty / error / success、主题一致性和数据 / 代码显示规范。
- 核心页面规范为 Pipeline、Agent、AppShell、Settings、Onboarding / Welcome、Chat 回退、File Browser 补充了 anatomy、状态、交互、空态、危险操作和验收口径。
- 组件规范新增 Tabs / Segmented Control、Notice / Banner / Toast、Empty / Skeleton / Error Block、Command / Menu / Dropdown、Path / File / Model Chip、Progress / Stepper、Form Validation 和 Icon Button 细则。
- 交互动效新增 async 操作状态矩阵、motion token、拖放文件交互和多会话后台反馈；可访问性新增页面级检查、键盘路径、对比度 / 色盲安全和 screen reader 文案建议。
- 后续落地建议新增拆分任务、BDD 验收场景、截图验收矩阵、风险约束和完成定义。
- 本次仍为纯文档增强；未修改运行时代码、README 或 AGENTS，未新增 public API / IPC / shared type。
- 已完成静态校验：关键词覆盖检查通过，`git diff --check` 通过；本次为文档任务，未运行 Electron 应用测试或 typecheck。

## 2026-05-16 全客户端 UI 视觉规范落地化优化计划

- [x] 复核现有规范，确认本轮只补实现蓝图和验收模板，不修改运行时代码、README 或 AGENTS。
- [x] 增加代码落地映射表，把规范项对应到 renderer 目录、组件和建议改造顺序。
- [x] 增加 Design Token 契约和量化默认值，减少实现时的范围漂移。
- [x] 增加页面级 wireframe，覆盖 AppShell、Pipeline、Agent、Settings 和 File Browser。
- [x] 增加 before / after 审计模板、验收脚本建议、截图基线路径和 MVP 优先级。
- [x] 执行静态检查并在本文末尾追加 Review。

## 2026-05-16 全客户端 UI 视觉规范落地化优化 Review

- 已继续优化 `improve/ui/2026-05-16-client-ui-visual-spec.md`，全文从 1303 行扩展到 1623 行。
- 新增 `2.6 代码落地映射表`：将 Theme tokens、UI primitives、Settings、AppShell、Tabs、Pipeline、Agent、AI content、File Browser、Chat 回退和 Welcome 映射到具体 renderer 目录与建议改造顺序。
- 新增 `4.15 Design Token 契约` 和 `4.16 量化默认值`：定义 surface、text、border、focus、status、radius、shadow、motion token alias，以及按钮、卡片、面板、字号、间距、动效的默认值。
- 新增 `5.8 页面级 Wireframe`：用结构图覆盖 AppShell、Pipeline、Agent、Settings 和 File Browser，明确核心区域、状态区和操作区位置。
- 新增 `6.15 组件默认值总表`：补充 Button、IconButton、Input、Composer、Card、Badge、Menu、Tooltip、Dialog、SettingsRow、FileTreeRow、TabItem 的默认尺寸和状态要求。
- 新增 `9.10` 到 `9.14`：before / after 审计模板、验收脚本与工具建议、截图基线命名、MVP 优先级和实现拆单建议。
- 本轮仍是纯文档优化；未修改运行时代码、README 或 AGENTS，未新增 public API / IPC / shared type。
- 已完成静态校验：新增章节关键词检索通过，`git diff --check` 通过；本次为文档任务，未运行 Electron 应用测试或 typecheck。

## 2026-05-16 全客户端 UI 迭代开发清单计划

- [x] 基于 `improve/ui/2026-05-16-client-ui-visual-spec.md` 生成独立开发 checklist，用于后续跟踪迭代进度。
- [x] 清单按最佳工程实践组织：阶段目标、依赖、范围、任务项、验收标准、验证命令、截图要求、提交边界和风险。
- [x] 覆盖 UI-0 到 UI-6：基线审计、token / primitive、AppShell、Pipeline、Agent、Settings、长尾页面与总体验收。
- [x] 明确每阶段不得改动 public API / IPC / shared type，除非单独评审；README / AGENTS 仍需用户允许后再改。
- [x] 执行静态检查：文件存在、章节关键词覆盖、`git diff --check`。
- [x] 在本文末尾追加 Review。

## 2026-05-16 全客户端 UI 迭代开发清单 Review

- 已新增 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`，全文 789 行。
- 清单作为后续 UI 迭代开发进度看板，引用视觉规范 `2026-05-16-client-ui-visual-spec.md`，并明确总原则、迭代纪律、状态标记、验证分层和进度总览。
- 阶段覆盖 UI-0 到 UI-7：基线审计、token / primitive、AppShell / Sidebar / Tab、Pipeline 工作台、Agent 阅读与交互、Settings、Welcome / Chat 回退 / File Browser、全局验收与收尾。
- 每个阶段均包含目标、主要文件、不包含范围、任务清单、验收标准、验证命令、截图建议和阶段 Review 模板。
- 清单补充了 before / after 审计记录模板、阶段提交建议、风险登记和后续启动提示，便于后续按阶段单独提交与验证。
- 本轮仍是纯文档产物；未修改运行时代码、README 或 AGENTS，未新增 public API / IPC / shared type。
- 已完成静态校验：文件存在、章节与关键词覆盖检查通过，`git diff --check` 通过；本次为文档任务，未运行 Electron 应用测试或 typecheck。

## 2026-05-16 全客户端 UI 进度文档同步计划

- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 当前开发状态，固定已提交文档基线 commit `7bef500c`。
- [x] 标注已完成：视觉规范文档、落地化优化、迭代开发清单和文档提交；标注未完成：UI-0 到 UI-7 真实 UI 实现阶段均未开始。
- [x] 更新下次启动提示，明确下次应先处理 untracked `.swp` 临时文件，再从 UI-0 基线审计与截图开始。
- [x] 执行静态检查并提交本阶段文档同步。
- [x] 在本文末尾追加 Review，并给用户一段下次启动 Codex 的提示词。

## 2026-05-16 全客户端 UI 进度文档同步 Review

- 已更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`，新增“当前开发状态快照”和“下次启动提示词”。
- 已固定当前 UI 文档基线 commit：`7bef500c984803525e9c7fac67d2c959271d2a1c`（`docs(ui): 新增客户端 UI 视觉规范与迭代清单`）。
- 已明确已完成范围：视觉规范文档、Design Token 契约、量化默认值、页面 wireframe、组件默认值、before / after 审计模板、截图基线命名、MVP 优先级、实现拆单建议，以及 UI-0 到 UI-7 的开发跟踪清单。
- 已明确未完成范围：真实 UI 实现尚未开始，UI-0 到 UI-7 均未完成；下一步必须从 UI-0 基线审计与截图开始。
- 已记录当前注意事项：工作区存在未提交临时文件 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交，后续启动前先确认是否为编辑器残留。
- 已完成静态校验：`git diff --check` 通过；本次为文档状态同步，未运行 Electron 应用测试或 typecheck。

## 2026-05-16 UI-0 基线审计与截图准备计划

- [x] 先执行 `git status --short`，确认开始前已有改动来源，并保护未跟踪 `.swp` 临时文件。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、UI 视觉规范和 implementation checklist 的 UI-0 阶段。
- [x] 梳理当前客户端可截图路径与主题 / 状态覆盖方式，不进入 UI-1 运行时代码修改。
- [x] 创建 `improve/ui/screenshots/` 和 UI-0 before 审计记录，使用视觉规范 `9.10 Before / After 审计模板`。
- [x] 记录 Pipeline、Agent、AppShell、Settings、Welcome / Onboarding、File Browser、Chat 回退的当前问题，按 P0 / P1 / P2 标注影响。
- [x] 采集或记录 Pipeline、Agent、Settings 至少 light / dark before 截图证据。
- [x] 明确 UI-1 到 UI-6 的优先级是否需要调整。
- [x] 运行 `git diff --check`，更新 UI checklist 和本文件 Review 后单独提交 UI-0。

## 2026-05-16 UI-0 基线审计与截图准备 Review

- UI-0 已完成 before 审计记录：`improve/ui/2026-05-16-client-ui-before-audit.md`。
- 已建立截图目录 `improve/ui/screenshots/`，保存 6 张 renderer baseline：Pipeline light / dark、Agent light / dark、Settings light / dark。
- 本轮确认 `.swp` 文件对应仍在运行的 vim 进程，不删除、不提交。
- 直接 Electron 窗口截图受系统截图权限限制失败；本轮使用临时 Vite renderer harness 采集截图，harness 已删除，未纳入提交。审计文档已明确该方法不能替代真实 Electron 端到端状态截图。
- 主要发现：P0 3 个、P1 6 个。优先风险集中在 Agent blocked 态、Pipeline gate / review 状态配方、icon-only 可访问名称、Settings 主次层级和 TutorialBanner 遮挡。
- UI-1 仍应先做 token / primitive；UI-2 需提前纳入 icon-only a11y 与 Tab / Sidebar indicator；UI-3 / UI-4 阶段开始时必须补真实状态截图 fixture。
- 本轮未改运行时代码、README、AGENTS、public API、IPC 或 shared type。
- 验证通过：`git diff --check`。

## 2026-05-16 UI-1 Token 与 Primitive 收敛计划

- [x] 执行 `git status --short`，确认本阶段开始时仅存在已知 `.swp` 临时文件。
- [x] 复习 UI checklist 的 UI-1 阶段、视觉规范 `4.15 Design Token 契约` 与 UI-0 before 审计结论。
- [x] 盘点 `globals.css`、Tailwind config、`components/ui` 与 settings primitives 的现有 token / primitive 缺口。
- [x] 增加最小语义 token alias：surface、text、border、focus、status、radius、shadow、motion，并覆盖 light / dark / ocean / forest / slate fallback。
- [x] 更新 Tailwind token 映射与 reduced-motion 基础样式，避免页面组件继续直接写一次性视觉值。
- [x] 收敛基础 primitive：Button、Badge、Dialog / AlertDialog、Popover / Tooltip、Input / Textarea、Settings primitives 的 radius、focus、motion 与 surface 语言。
- [x] 清理本阶段触达文件中的第一批裸 hex / 一次性颜色；无法 token 化的在 Review 中说明。
- [x] 递增 `@rv-insights/electron` patch 版本并同步锁文件。
- [x] 运行 UI-1 验证：`bun run --filter='@rv-insights/electron' typecheck`、`git diff --check`，并补充 light / dark / ocean primitive 截图证据。
- [x] 更新 UI checklist 与本文件 Review，单独提交 UI-1 阶段成果。

## 2026-05-16 UI-1 Token 与 Primitive 收敛 Review

- UI-1 已完成，范围限定在 renderer token / primitive / settings primitives、截图和 `@rv-insights/electron` 版本更新；未修改 README / AGENTS，未新增 public API / IPC / shared type。
- 新增 semantic token alias：surface、text、border、focus、running / waiting / success / danger / neutral status 三件套、radius、shadow、motion，并暴露到 Tailwind。
- 新增 `Card` 与 `Chip` primitive；Button 支持 loading，新增 `IconButton` 封装 tooltip + `aria-label`；Badge / Alert 支持状态 variant。
- 收敛 Dialog / AlertDialog / Popover / Tooltip / Dropdown / ContextMenu / Command / Tabs / Sheet / Input / Textarea / Select / Switch / Slider / Sonner / Settings primitives 的基础 radius、surface、shadow、focus 和 motion。
- Settings 密钥显隐按钮已从不可聚焦的裸 button 改为有 `aria-label` 和 tooltip 的 `IconButton`。
- `@rv-insights/electron` 版本 `0.0.58 -> 0.0.59`，`bun.lock` workspace metadata 已同步。
- 截图证据：`improve/ui/screenshots/primitives-light-default-desktop.png`、`improve/ui/screenshots/primitives-dark-default-desktop.png`、`improve/ui/screenshots/primitives-ocean-status-desktop.png`。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`、`bun run --filter='@rv-insights/electron' build:renderer`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。renderer build 仅保留既有 chunk size warning。
- 残留风险：页面级 AppShell / Pipeline / Agent 仍有局部状态色和布局 class，需按 UI-2 到 UI-4 分阶段迁移；`globals.css` 中既有特殊主题裸色覆盖仍作为后续主题治理范围保留。

## 2026-05-16 UI-1 后开发状态文档同步计划

- [x] 检查 `git status --short`，确认当前没有未提交代码变更需要纳入 UI 状态文档同步。
- [x] 更新 `tasks/lessons.md`，记录“token / primitive 完成不等于主界面可见变化”的表达教训。
- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 当前状态：UI-0 / UI-1 已完成，UI-2 到 UI-7 未完成。
- [x] 在 checklist 中明确 UI-1 只是基础层，Pipeline 主界面、左侧栏、阶段栏、任务输入区和阶段产物区仍未进入页面级视觉改造。
- [x] 更新下次启动提示词，要求下次从 UI-2 AppShell / Sidebar / Tab 开始，不跳到 UI-3。
- [x] 执行文档静态校验并追加 Review。

## 2026-05-16 UI-1 后开发状态文档同步 Review

- 已同步 UI 最新开发状态：UI-0 commit `61c263c8` 已完成 before 审计与截图，UI-1 commit `20a90d36` 已完成 token 与 primitive 收敛。
- 已明确未完成范围：UI-2 AppShell / Sidebar / Tab、UI-3 Pipeline 工作台、UI-4 Agent、UI-5 Settings、UI-6 Welcome / Chat 回退 / File Browser、UI-7 全局验收均未开始。
- 已补充重要澄清：UI-1 不等于真实客户端主界面 redesign，用户重启后在 Pipeline 主屏看到旧界面是符合当前阶段边界的；主界面可见变化从 UI-2 / UI-3 开始。
- 已将下次启动提示词更新为 UI-2 版本，明确先读文档、先 `git status --short`、保护 `.swp` / `.DS_Store`、不改 README / AGENTS、不新增 IPC / public API / shared type。
- 已知工作区噪音：`.DS_Store` tracked 修改和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 未跟踪文件，均不属于 UI 阶段成果，不能纳入提交。
- 本轮文档静态校验：`git diff --check` 通过；未运行 Electron 应用测试或 typecheck，因为本轮只同步文档状态。

## 下次启动提示词（UI-2）

```text
你正在 RV-Insights 仓库继续推进全客户端 UI 优化。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前进度：
1. UI 文档基线已完成并提交，commit 为 7bef500c984803525e9c7fac67d2c959271d2a1c，提交标题为 docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0「基线审计与截图准备」已完成并提交，commit 为 61c263c80bf98169b64b40c6bddc79bc7873b8fd，提交标题为 docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1「Token 与 primitive 收敛」已完成并提交，commit 为 20a90d3679147dd27c035d9c957546823924ac4b，提交标题为 feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. 已完成：UI-0、UI-1。未完成：UI-2、UI-3、UI-4、UI-5、UI-6、UI-7。
5. 重要澄清：UI-1 只完成 token、Tailwind 映射和基础 primitive 收敛，不是用户可见主界面 redesign；重启客户端后 Pipeline 主界面、左侧栏、阶段栏、任务输入区和阶段产物区基本不会明显变化。
6. 当前工作区可能存在未提交临时文件 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，以及 .DS_Store 修改；它们不是 UI 阶段成果，不要纳入提交，先确认来源并保护用户变更。

请从 UI-2「AppShell / Sidebar / Tab」开始：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 implementation checklist 的 UI-2 阶段和视觉规范 `5.1 AppShell / Sidebar / Tab`、`5.8 页面级 Wireframe`。
3. 先做 UI-2 before 审计，再实现 AppShell、LeftSidebar、PipelineSidebar、TabBar / TabBarItem、MainArea、RightSidePanel 的视觉和状态收敛。
4. 不要跳过 UI-2 直接进入 UI-3；用户截图红框内 Pipeline 主面板属于 UI-3，需在 UI-2 完成后再改。
5. 本轮仍遵守 Jotai、Radix/shadcn 风格组件、Lucide 图标、现有主题 token、本地 JSON/JSONL 存储的约束。
6. 不新增 public API / IPC / shared type，除非单独评审；不修改 README / AGENTS，除非用户明确允许。
7. UI-2 完成定义：当前模式、当前 session、当前 tab、后台 running / blocked / failed 状态可见；Sidebar / Tab keyboard focus 清楚；light / dark / 至少一个特殊主题下无明显溢出。
8. 验证：至少运行 bun run --filter='@rv-insights/electron' typecheck、git diff --check，并采集 UI-2 light / dark / 特殊主题截图。
9. 每完成一个阶段并通过该阶段验证后，立即更新 checklist 和 tasks/todo.md 的 Review，并单独提交该阶段成果；不执行 push / PR，除非用户明确要求。
```

## 2026-05-16 UI-2 AppShell / Sidebar / Tab 计划

- [x] 执行 `git status --short`，确认当前只有 `.DS_Store` 修改和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 未跟踪文件，二者均不纳入 UI-2 提交。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、UI checklist 的 UI-2 阶段，以及视觉规范 `5.1 AppShell / Sidebar / Tab`、`5.8 页面级 Wireframe`。
- [x] 做 UI-2 before 审计，记录 AppShell / LeftSidebar / PipelineSidebar / TabBar / MainArea / RightSidePanel 当前结构、状态 indicator、focus 和溢出风险。
- [x] 实现 UI-2 视觉收敛：统一 AppShell 三栏 surface、LeftSidebar icon button、PipelineSidebar session item、TabBar / TabBarItem 状态 indicator、MainArea 与 RightSidePanel 层级。
- [x] 保持阶段边界：不进入 Pipeline 主面板 UI-3，不修改 Agent message / composer，不新增 public API / IPC / shared type，不修改 README / AGENTS。
- [x] 递增 `@rv-insights/electron` patch 版本并同步 `bun.lock`。
- [x] 运行 `bun run --filter='@rv-insights/electron' typecheck`、`git diff --check`，并采集 UI-2 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 和本文件 Review，单独提交 UI-2 阶段成果。

## 2026-05-16 UI-2 AppShell / Sidebar / Tab Review

- UI-2 已完成，范围限定在 AppShell、Sidebar、TabBar / TabBarItem、MainArea、Agent RightSidePanel、状态派生 atom、截图和 `@rv-insights/electron` 版本更新；未修改 README / AGENTS，未新增 public API / IPC / shared type。
- 新增 before 审计记录：`improve/ui/2026-05-16-client-ui2-before-audit.md`。
- Shell 三栏统一到 `surface-app / surface-panel / rounded-panel / shadow-panel / border-subtle`；ModeSwitcher 使用 primary token；TabBar active tab 与 MainArea panel 连贯，非 active tab 降权。
- Sidebar / Tab 状态统一：Pipeline waiting -> blocked，node / recovery failed -> failed；Agent stream error / retry failed -> failed；running / blocked / failed / completed 使用 token 化细线和 tooltip，不整块染色。
- 可访问性修复：Tab close button 改为真实独立 button，避免 button 嵌套；Conversation / Agent / Pipeline 侧栏行补 Enter / Space 激活，并限制为仅在行容器自身聚焦时触发，避免子按钮键盘事件冒泡误选中会话；icon-only 操作补 `aria-label` 与 focus-visible ring。
- `@rv-insights/electron` 版本 `0.0.59 -> 0.0.60`，`bun.lock` workspace metadata 已同步。
- 截图证据：`improve/ui/screenshots/appshell-light-multi-tab-desktop.png`、`improve/ui/screenshots/appshell-dark-background-running-desktop.png`、`improve/ui/screenshots/appshell-forest-blocked-desktop.png`。
- 验证通过：`bun run --filter='@rv-insights/electron' typecheck`、聚焦测试 21 pass、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- 代码审查结果：已修复 Tab button 嵌套、侧栏 `role=button` 缺键盘激活，以及行级 Enter / Space handler 接收子按钮冒泡导致误选中会话的问题。ModeSwitcher tab/radio 语义建议留到后续 a11y 精修。
- 残留风险：Pipeline 主面板 StageRail / Records / Gate / Composer 仍属 UI-3 范围，本阶段没有进入页面内部重排；截图为 desktop 1280x720，窄屏矩阵留到 UI-7 总体验收。

## 2026-05-16 UI 进度文档同步计划

- [x] 检查 `git status --short`，确认当前只剩 `.DS_Store` 和视觉规范 swap 文件需要保护。
- [x] 更新 UI checklist 顶部状态：UI-0、UI-1、UI-2 已完成，UI-3 到 UI-7 未完成。
- [x] 更新当前启动提示和下次启动提示词：下一阶段从 UI-3 Pipeline 工作台开始，不再重复 UI-2。
- [x] 明确 UI-2 可见变化有限，用户截图中的 Pipeline 主面板属于 UI-3。
- [x] 追加本地 todo Review，便于下次恢复跟踪。

## 2026-05-16 UI 进度文档同步 Review

- 已同步 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：新增 UI-2 commit `c3636336`，阶段表维持 UI-0 / UI-1 / UI-2 已完成，UI-3 / UI-4 / UI-5 / UI-6 / UI-7 未完成。
- 已将 checklist 的“当前启动提示”和“下次启动提示词”改为 UI-3 版本：下次应先做 UI-3 before 审计，再改 PipelineHeader、PipelineStageRail、PipelineRecords、PipelineGateCard、PipelineComposer。
- 已明确下次开发边界：AppShell / Sidebar / Tab 已完成；不要回头重复 UI-2；Pipeline 主面板才是下一步直观可见的 UI 改造重点。
- 当前仍需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入 UI 阶段提交。

## 2026-05-16 Pipeline 记录区创意 UI 优化计划

- [x] 复习 `tasks/lessons.md`，确认本轮必须让 Pipeline 主内容区产生真实可见变化。
- [x] 执行 `git status --short`，确认并保护现有 `.DS_Store` 与 `improve/` 临时文件。
- [x] 重构 `PipelineComposer` 运行态为任务指令条，保留停止运行操作，长任务可换行不溢出。
- [x] 重构 `PipelineRecords` 控制区为任务档案 / 运行轨迹工作台，优化统计胶囊、搜索台、工具栏与阶段筛选。
- [x] 优化阶段产物 / 运行日志 tabs 与空状态视觉，保持 Radix/shadcn 交互语义。
- [x] 在 `globals.css` 增加少量 Pipeline 专用视觉 class，并加入 reduced motion 降级。
- [x] 运行 typecheck、相关 Pipeline 组件测试、`git diff --check`，按结果修正。
- [x] 启动本地应用并尝试 Browser / Electron 截图检查；Electron 正常启动，裸 Vite 浏览器因缺少 preload 只能显示空白，系统 `screencapture` 当前无法创建截图。
- [x] 追加本轮 Review，说明验证结果与残留风险。

## 2026-05-16 Pipeline 记录区创意 UI 优化 Review

- 已完成红框区域可见 UI 改造：`当前任务` 从普通卡片改为运行指令条，增加状态徽章、任务正文容器、扫描光带和停止运行危险操作。
- 已完成 `产物与运行日志` 控制区改造：标题升级为“任务档案 / 运行轨迹”，记录数、显示数、搜索命中改为信息胶囊，搜索台和工具栏整合在同一操作 deck。
- 已完成阶段筛选和 tabs 改造：阶段筛选改为带编号的 segmented rail；`阶段产物 / 运行日志` 变为带 Lucide 图标的嵌入式二级导航；空状态升级为带档案图标、说明文案和网格纹理的状态面板。
- 已新增 Pipeline 专用 CSS class，并为扫描线 / beacon 动画加入 `prefers-reduced-motion` 降级；未新增依赖，未改 IPC / shared type / Jotai / 持久化逻辑。
- 验证通过：`bun run typecheck`、`bun test apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts`、`git diff --check`。
- 运行验证：`bun run dev` 可启动 Vite 与 Electron，Electron 主进程日志显示 IPC、runtime、tray、watcher 正常启动；Browser 打开 `http://localhost:5173/` 时因没有 Electron preload/API 只能看到空白 renderer，不能作为真实 UI 判断。
- 截图限制：尝试激活 Electron 后使用 macOS `screencapture` 失败，错误为 `could not create image from display`，因此本轮没有留下宽屏 / 窄屏截图证据。
- 已停止本轮启动的开发进程；仍需保护既有无关变更：`.DS_Store`、`improve/.DS_Store`、`improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`、`improve/ui/.DS_Store`。

## 2026-05-16 Agent / Pipeline Cockpit 创意 UI 刷新计划

- [x] 使用 `ui-ux-pro-max` 复核可访问性、状态清晰、语义 token、克制动效规则。
- [x] 执行 `git status --short`，确认并保护既有 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。
- [x] 增加 cockpit 风格语义 CSS：mission strip、message card、reasoning chamber、tool rail、composer deck、resource well，并包含 reduced-motion 降级。
- [x] 优化 AgentHeader 为紧凑 mission strip，显示标题、工作区、模型、权限、运行 / 计划状态和文件面板入口。
- [x] 优化 AgentMessages：用户消息、助手输出、运行指示、重试提示和旧格式 fallback 使用更清晰的阅读骨架。
- [x] 优化 ToolActivityItem：工具活动行、分组、详情面板采用状态轨和可扫描元信息。
- [x] 优化 AgentView Composer：输入区变为 command deck，状态 notice、建议、附件和工具栏稳定不跳动。
- [x] 优化 SidePanel 文件资源区：会话 / 工作区文件区、drop zone 外层、附加目录和文件行更像资源面板。
- [x] 运行 `bun run --filter='@rv-insights/electron' typecheck`、相关聚焦测试和 `git diff --check`。
- [x] 启动 Electron 做 light / dark / 特殊主题抽样检查；若截图受限，在 Review 中说明。
- [x] 追加本轮 Review，记录验证结果与残留风险。

## 2026-05-16 Agent / Pipeline Cockpit 创意 UI 刷新 Review

- 已完成 Agent 三栏工作台的 cockpit 视觉刷新：主画布增加克制网格微光，Header 升级为 mission strip，消息区、Reasoning Chamber、工具活动、Composer command deck、右侧资源面板和左侧 Agent 入口统一到同一层级语言。
- 改动保持视觉层范围：未改 IPC、Agent SDK / Pipeline 逻辑、Jotai state shape、持久化结构、shared package API、README 或 AGENTS；未新增依赖。
- 新增 CSS 均为 Agent scoped utility，使用现有 semantic token / CSS variable；状态表达同时包含图标、文案或结构轨道，不只依赖颜色，并包含 `prefers-reduced-motion` 降级。
- `@rv-insights/electron` 版本 `0.0.66 -> 0.0.67`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun install --frozen-lockfile --dry-run`、`bun run --filter='@rv-insights/electron' typecheck`、`bun test apps/electron/src/renderer/components/agent/agent-ui-model.test.ts` 7 pass / 21 expect、`git diff --check`。
- 运行验证：`bun run dev` 可启动 Vite、main/preload 构建、Electron、IPC、runtime、tray 和 watcher；日志未出现 renderer 编译失败。macOS `screencapture` 当前失败，错误为 `could not create image from display`，因此本轮无法留下 light / dark / 特殊主题截图证据。
- 已停止本轮启动的 Vite / Electron 开发进程；仍需保护既有无关文件：`.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。
