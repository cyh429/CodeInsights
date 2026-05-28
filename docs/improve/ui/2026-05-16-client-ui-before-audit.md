# 2026-05-16 UI-0 Before 基线审计

## 1. 执行范围

本轮是 UI-0「基线审计与截图准备」，只建立 before 基线，不修改运行时代码、不新增 IPC / public API / shared type、不修改 README / AGENTS。

启动前工作区状态：

- `git status --short` 仅发现 `?? improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。
- 该 `.swp` 对应仍在运行的 vim 进程，不视为可删除残留，本轮不纳入提交。

截图方式：

- 当前已有 `bun run dev` / Electron 开发窗口和 Vite `5173` 服务在运行。
- 直接用 macOS `screencapture` 抓 Electron 窗口失败，系统返回无法从 display / rect 创建图像。
- 为避免杀掉用户现有 dev 进程或抢 Electron 单实例锁，本轮使用临时 Vite renderer harness 注入最小 `electronAPI` mock 采集截图；harness 已删除，不纳入提交。
- 因此截图可证明当前 renderer 视觉结构、主题、密度和可访问性问题，但不替代真实 Electron 端到端运行截图。

## 2. 截图基线

截图目录：`improve/ui/screenshots/`

| 页面 | 主题 | 状态 | 截图 |
| --- | --- | --- | --- |
| Pipeline | light | idle / empty records | `improve/ui/screenshots/ui0-before-pipeline-light-idle-desktop.png` |
| Pipeline | dark | idle / empty records | `improve/ui/screenshots/ui0-before-pipeline-dark-idle-desktop.png` |
| Agent | light | empty / model missing / file panel empty | `improve/ui/screenshots/ui0-before-agent-light-empty-desktop.png` |
| Agent | dark | empty / model missing / file panel empty | `improve/ui/screenshots/ui0-before-agent-dark-empty-desktop.png` |
| Settings | light | model/channel config | `improve/ui/screenshots/ui0-before-settings-light-channel-form-desktop.png` |
| Settings | dark | model/channel config | `improve/ui/screenshots/ui0-before-settings-dark-channel-form-desktop.png` |

未覆盖截图状态：

- Pipeline：running、gate、failed、stopped 未截图，需要 UI-3 阶段用真实或更完整 fixture 补齐。
- Agent：streaming、tool running、permission、PlanMode 未截图，需要 UI-4 阶段补齐。
- Settings：validation error、danger dialog、update 未截图，需要 UI-5 阶段补齐。
- File Browser：selected、hover、rename、delete confirm 未截图，本轮只在 Agent 右侧面板观察到 empty folder。
- Welcome / Onboarding、Chat 回退：本轮记录代码与可见 tab 基线，未单独截图。

## 3. Before 审计记录

| 页面 / 组件 | 当前问题 | 影响等级 | Before 截图 | 目标体验 | 方案摘要 | 涉及文件 | 验收方式 | 残留风险 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AppShell / MainArea | Shell、主面板、侧栏大量使用 `rounded-2xl shadow-xl`，背景使用局部 zinc gradient，surface 层级偏重且不完全 token 化 | P2 视觉不一致 | Pipeline / Agent / Settings 全部截图 | 三栏工作台层级稳定，普通面板和浮层有明确 radius / shadow 规则 | UI-1 先收敛 surface、radius、shadow token；UI-2 再落到 Shell 调用点 | `AppShell.tsx`、`MainArea.tsx`、`PipelineSidebar.tsx`、`LeftSidebar.tsx` | light / dark / special 主题截图，`git diff --check` | 特殊主题尚未截图 |
| AppShell icon-only buttons | 画面和 DOM 中存在多个无可访问名称的 icon-only button，例如收起侧边栏、搜索、session 行内操作 | P1 操作不可预期 | `ui0-before-pipeline-light-idle-desktop.png` | icon-only 按钮必须有 tooltip 和 `aria-label`，键盘 focus 可理解 | UI-1 定义 Icon Button 规则，UI-2 批量补 Shell / Sidebar 调用点 | `PipelineSidebar.tsx`、`LeftSidebar.tsx`、`TabBarItem.tsx` | DOM snapshot / keyboard Tab / screen reader 文案检查 | 需要逐个状态确认 hover-only action |
| TabBar / Multi-tab | 多 tab 可见，但 running、blocked、failed indicator 未在 before fixture 中出现；当前关闭和状态提示需要后续验证 | P1 操作不可预期 | `ui0-before-pipeline-light-idle-desktop.png` | 当前 tab、后台运行、后台阻塞和失败能在 3 秒内识别 | UI-2 建立 tab indicator 配方，不整块染色 | `TabBar.tsx`、`TabBarItem.tsx`、`tab-atoms.ts` | 多 tab + running / blocked / failed fixture 截图，键盘关闭 tab | 本轮未触发后台状态 |
| PipelineHeader / StageRail | Pipeline idle 态的 Header、StageRail、Records、Composer 都是大圆角卡片，层级相近；用户视线容易在多个卡片之间平均分散 | P2 视觉不一致 | `ui0-before-pipeline-light-idle-desktop.png` | idle 时主动作与当前阶段更清楚，记录区不与 gate / composer 抢层级 | UI-3 调整 Pipeline 工作台层级，普通记录用更轻 surface | `PipelineHeader.tsx`、`PipelineStageRail.tsx`、`PipelineRecords.tsx`、`PipelineComposer.tsx` | Pipeline idle / running / gate 截图 | 需要真实 gate 截图复核 |
| PipelineGate / Review boards | gate、review、tester、committer 组件直接使用 sky / amber / rose / emerald 和局部按钮 class，状态配方散落在页面组件中 | P0 状态不可判断 | 未截图，代码审计 | 等待审核、失败、阻塞和成功跨 Pipeline/Agent/Settings 语义一致 | UI-1 抽语义 status token，UI-3 统一 gate / board 视觉 | `PipelineGateCard.tsx`、`ReviewDocumentBoard.tsx`、`ReviewerIssueBoard.tsx`、`TesterResultBoard.tsx`、`CommitterPanel.tsx` | gate / failed / stopped / test blocked 截图，键盘 approve / reject | 本轮未运行真实 Pipeline |
| PipelineRecords empty | 空记录状态仍展示搜索、筛选、上/下一个、复制报告等控件；在 0 条记录时操作噪音高 | P1 操作不可预期 | `ui0-before-pipeline-light-idle-desktop.png` | 空态只保留必要说明和启动任务动作，记录工具在有内容后提升 | UI-3 为 Records 建立 empty / loading / result view model | `PipelineRecords.tsx` | idle empty 截图、running records 截图 | 搜索有内容状态未覆盖 |
| Agent empty / config missing | 空 Agent 画面同时出现问候、模式切换、缺模型提示、前往设置、空 composer 和右侧文件面板，主动作分散 | P0 状态不可判断 | `ui0-before-agent-light-empty-desktop.png` | 缺少可用模型时，用户一眼知道需要配置渠道，composer disabled 原因明确 | UI-4 统一 Agent empty / blocked 模板，并把配置入口作为唯一主动作 | `AgentView.tsx`、`AgentPlaceholder.tsx`、`AgentHeader.tsx` | Agent empty / model missing light/dark 截图，键盘到设置 | 本轮 mock 渠道未被 Agent 识别为可用模型，仍反映 blocked 视觉 |
| Agent / File side panel | 右侧文件面板 empty folder 可见，但 empty、dropzone、选择文件、附加文件夹和主 Agent blocked 状态同时出现，信息密度偏高 | P1 操作不可预期 | `ui0-before-agent-light-empty-desktop.png` | 文件面板只表达文件上下文，不抢当前 Agent blocked 主流程 | UI-4 / UI-6 分离 Agent blocked 与 File Browser empty 的视觉权重 | `SidePanel.tsx`、`FileBrowser.tsx`、`FileDropZone.tsx` | File Browser selected / hover / empty / delete confirm 截图 | 未覆盖真实文件树 |
| Agent Permission / PlanMode | Permission、AskUser、PlanMode 已有独立组件，但 before 未截图；后台权限提示需与 Tab / Sidebar 联动验证 | P0 状态不可判断 | 未截图，代码审计 | 当前和后台 permission 都可发现，回到会话后 banner 可操作 | UI-4 统一 Agent banner 族，UI-2 承接后台 indicator | `PermissionBanner.tsx`、`AskUserBanner.tsx`、`ExitPlanModeBanner.tsx`、`AgentMessages.tsx` | 多 tab 手动路径、permission / PlanMode 截图、aria 检查 | 需要可控 Agent fixture |
| Settings Dialog / Channel config | Settings Dialog 为 `rounded-xl shadow-2xl`，模型配置页内官方供应、添加配置、Demo 渠道、Codex 和 Agent 供应商多个操作并列，主次层级不够收敛 | P1 操作不可预期 | `ui0-before-settings-light-channel-form-desktop.png` | Settings 中每个 tab 只有一个最高优先级动作，表单状态和危险动作就近反馈 | UI-5 收敛 Settings primitive、section density、表单反馈和 danger dialog | `SettingsDialog.tsx`、`SettingsPanel.tsx`、`ChannelSettings.tsx`、`ChannelForm.tsx` | channel form / validation error / danger dialog / update 截图 | 本轮未触发错误和删除确认 |
| Tutorial / Welcome | TutorialBanner 在 Pipeline / Agent / Settings baseline 中持续浮在右下角，容易遮挡核心工作区和截图判断 | P1 操作不可预期 | Pipeline / Agent 截图 | 教程提示不遮挡 gate、permission、composer 或设置主按钮 | UI-6 重新定义 Welcome / Tutorial 的低频入口和关闭策略 | `TutorialBanner.tsx`、`WelcomeView.tsx`、`WelcomeEmptyState.tsx` | first run / config missing / tutorial dismissed 截图 | 本轮未单独截图 onboarding |
| Chat 回退 | Chat tab 可恢复，但 Chat 仍有独立输入、消息、工具活动组件；需要后续确认是否与 Agent primitive 对齐 | P2 视觉不一致 | 未截图，tab 可见于 Pipeline / Agent 截图 | Chat 回退不形成第三套视觉语言 | UI-6 对齐 ChatInput、ChatMessage、tool activity 与 Agent 展示层 | `chat/`、`ai-elements/`、`packages/ui` | message list / composer / tool activity 截图 | 本轮未打开 Chat tab |

## 4. 优先级调整建议

- UI-1 保持优先：先统一 token / primitive，否则 UI-2 到 UI-6 会继续复制裸色值、圆角和 shadow。
- UI-2 需要提前纳入 P1 a11y：icon-only `aria-label`、Tab / Sidebar running-blocked-failed indicator 不应等到页面细节后再补。
- UI-3 的 gate / failed / stopped 截图必须作为阶段入口补齐，因为 UI-0 受限于真实运行 fixture，尚未覆盖 P0 状态。
- UI-4 需要把「缺少模型 / 权限请求 / PlanMode」统一视作 blocked / waiting 状态族，而不是只优化消息气泡。
- UI-5 需要优先处理 Settings 中表单错误、危险操作和连接测试反馈，而不只是卡片样式。
- UI-6 除 Chat 和 File Browser 外，还应处理 TutorialBanner / Welcome 对核心工作区的遮挡问题。

## 5. UI-0 验收结论

- 每个主区域均已建立 before 审计记录。
- Pipeline、Agent、Settings 已各有 light / dark 基线截图。
- P0 / P1 问题均记录了涉及组件和后续验收方式。
- 未改运行时代码；临时 renderer harness 已删除。
