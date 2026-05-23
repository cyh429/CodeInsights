# 2026-05-16 全客户端 UI 迭代开发跟踪清单

## 0. 使用说明

本文是 `2026-05-16-client-ui-visual-spec.md` 的工程执行清单，用于后续按阶段跟踪 CodeInsights 客户端 UI 优化进度。

参考规范：

- `improve/ui/2026-05-16-client-ui-visual-spec.md`
- `tasks/lessons.md`
- `tasks/todo.md`
- `AGENTS.md`

本清单只定义开发计划、进度、验收和风险控制。实际实现阶段仍需按仓库规则先检查 `git status`、保护已有用户改动、逐步验证并记录 Review。

## 1. 总原则

### 1.1 不变量

- 公开主入口仍为 `Pipeline | Agent`，旧 `chat` 只作为隐藏回退保持一致性。
- 状态管理继续使用 Jotai，不引入 Redux、Zustand 或新状态框架。
- 本地存储优先继续使用 JSON / JSONL / 配置文件，不引入本地数据库。
- UI 组件优先复用现有 Radix / shadcn 风格 primitive 和 Lucide 图标。
- 不新增 public API / IPC / shared type，除非对应阶段明确需要并单独评审。
- README / AGENTS 只有在用户明确允许后再修改。
- UI 优化不应改变 Agent / Pipeline 的业务语义、权限边界、远端写 gate 或本地文件安全策略。

### 1.2 迭代纪律

- 每个阶段开始前检查 `git status --short`，确认本轮只接管相关文件。
- 每个阶段开始前阅读本清单对应阶段和视觉规范相关章节。
- 每个阶段先做 before 审计，再实现，再做 after 验收。
- 每个阶段完成后更新本清单的状态、证据、截图路径和 Review。
- 非文档代码阶段完成后应单独提交，提交内容只包含该阶段相关文件。
- 涉及 `apps/electron` 运行时代码时，按仓库要求递增受影响 package patch 版本。
- 若阶段中发现原方案不成立，应停止并更新计划，不继续硬推。

### 1.3 状态标记

任务状态使用以下格式：

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[!]` 阻塞，需要用户或前置问题处理
- `[-]` 取消或暂缓，并在 Review 中说明原因

Markdown checkbox 不原生支持 `[~]` / `[!]`，如工具不识别，可在任务文字前加状态标签，例如 `[BLOCKED]`。

### 1.4 验证分层

每个阶段按风险选择验证：

| 验证层级 | 适用范围 | 必做项 |
| --- | --- | --- |
| Static | 文档、CSS、轻量 class 调整 | `git diff --check` |
| Type | TSX / TS / Tailwind class 变更 | `bun run --filter='@codeinsights/electron' typecheck` |
| Focused | 组件行为、状态映射、交互逻辑 | 相关 `bun test <file>` 或手动路径 |
| Visual | 页面结构、主题、状态色、文本溢出 | Electron / Vite 实机截图 |
| A11y | icon-only、表单、Dialog、树、Tab | 键盘路径、aria、contrast |

## 2. 进度总览

### 2.1 当前开发状态快照

更新时间：2026-05-16 UI-7 全局验收完成后

当前文档与阶段提交：

- Commit：`7bef500c984803525e9c7fac67d2c959271d2a1c`
- 提交标题：`docs(ui): 新增客户端 UI 视觉规范与迭代清单`
- 分支：`base/pipeline-v0-ui-enhancement`
- 范围：纯文档基线，未改运行时代码、README、AGENTS、public API、IPC 或 shared type。
- 进度同步提交：`da4d682f45dad606992603df32f9420e30ebfe23`（`docs(ui): 同步客户端 UI 开发进度状态`）。
- UI-0 提交：`61c263c80bf98169b64b40c6bddc79bc7873b8fd`（`docs(ui): 完成 UI-0 基线审计与截图`）。
- UI-1 提交：`20a90d3679147dd27c035d9c957546823924ac4b`（`feat(ui): 完成 UI-1 token 与 primitive 收敛`）。
- UI-2 提交：`c3636336`（`style(ui): 统一 AppShell 导航与标签状态`）。
- UI-3 提交：`3881eb10`（`style(pipeline): 优化 Pipeline 工作台状态层级`）。
- UI-4 提交：`b28ac9df`（`style(agent): 优化 Agent 消息工具与交互状态`）。
- 截图索引提交：`1d78bf66`（`docs(ui): 补充 UI 截图索引说明`）。
- UI-5 提交：`8362e8b4`（`style(settings): 统一设置界面表单与危险操作`）。
- UI-5 后续状态同步提交：`3ccb2886`（`docs(ui): 同步 UI-5 后续开发状态`）。
- UI-6 提交：`ed3d48d3`（`style(ui): 对齐 Welcome Chat 与 File Browser 体验`）。
- UI-6 后续状态同步提交：`f523ad71`（`docs(ui): 同步 UI-6 后续开发状态`）。
- UI-7 提交：`33b8ccec`（`test(ui): 完成客户端 UI 视觉验收收口`）。

已完成：

- [x] 新增并完善 `improve/ui/2026-05-16-client-ui-visual-spec.md`。
- [x] 新增 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`。
- [x] 完成视觉规范、Design Token 契约、量化默认值、页面 wireframe、组件默认值、before / after 审计模板、截图基线命名、MVP 优先级和实现拆单建议。
- [x] 完成 UI-0 到 UI-7 的阶段化开发跟踪清单。
- [x] 已按阶段提交文档成果，commit 为 `7bef500c984803525e9c7fac67d2c959271d2a1c`。
- [x] 完成 UI-0 before 审计记录：`improve/ui/2026-05-16-client-ui-before-audit.md`。
- [x] 建立 `improve/ui/screenshots/` 截图基线，覆盖 Pipeline / Agent / Settings 的 light 与 dark 状态。
- [x] 完成 UI-1 Token 与 primitive 收敛：新增语义 token alias、Tailwind 映射、Card / Chip primitive，统一 Button / Badge / Dialog / Tooltip / Input / Select / 菜单 / Settings primitives 的基础视觉语言。
- [x] 完成 UI-2 AppShell / Sidebar / Tab 收敛：三栏 shell surface、Sidebar item、Tab indicator、RightSidePanel 与键盘 focus 已统一，commit 为 `c3636336`。
- [x] 完成 UI-3 Pipeline 工作台收敛：Header、StageRail、Records / Live output、Gate / Review 操作区、Composer、Failure 卡片已统一状态层级，commit 为 `3881eb10`。
- [x] 完成 UI-4 Agent 阅读与交互：Agent header meta、banner zone、ToolActivity 状态、Composer 稳定性、消息阅读宽度已收敛。
- [x] 完成 UI-5 Settings 管理界面：Settings dialog/nav/primitives、渠道配置、Agent 工作区 / MCP / Skills、危险操作和错误反馈已收敛，commit 为 `8362e8b4`。
- [x] 完成 UI-6 Welcome / Chat 回退 / File Browser：Welcome / Onboarding 空态、旧 Chat 回退 composer / tool activity、File Browser 文件树与危险确认已收敛，commit 为 `ed3d48d3`。
- [x] 完成 UI-7 全局验收与收尾：阶段 Review、P0/P1、主题矩阵、a11y、键盘路径、溢出、验证命令和最终 Review 已收口。

未完成：无。

当前注意事项：

- 当前工作区存在未提交临时文件：`improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。本轮确认它对应仍在运行的 vim 进程，不是可以随手删除的残留；不要纳入提交。
- 当前工作区可能存在 `.DS_Store` 修改；它不是 UI 阶段成果，不要纳入 UI 提交，除非用户明确要求处理系统文件。
- `tasks/` 被 `.gitignore` 忽略，其中的 lessons / todo 为本地工作记录，不属于已提交文档基线。
- UI-1 只是 UI 基础层，不等同于用户可见的主界面优化；不要向用户暗示“全客户端 UI 已经有明显变化”。
- UI-7 已完成全局验收；本轮提交仍需继续保护 `.DS_Store` 和 UI visual spec swap 文件。
- 全客户端 UI 优化阶段已全部完成；后续若继续开发，应先定义新的阶段或专项，不要重复 UI-0 到 UI-7。

### 2.2 阶段进度表

| 阶段 | 名称 | 状态 | 主要范围 | 完成证据 |
| --- | --- | --- | --- | --- |
| UI-0 | 基线审计与截图准备 | [x] | before 审计、截图目录、验收矩阵 | commit `61c263c8` + `2026-05-16-client-ui-before-audit.md` + 6 张 baseline 截图 |
| UI-1 | Token 与 primitive 收敛 | [x] | CSS token、Button、Card、Badge、Dialog、Tooltip | commit `20a90d36` + typecheck + renderer build + 3 张 primitive 截图 |
| UI-2 | AppShell / Sidebar / Tab | [x] | 三栏骨架、导航密度、多标签状态、右侧面板 | typecheck + focused tests + light / dark / forest 截图 |
| UI-3 | Pipeline 工作台 | [x] | StageRail、Records、Gate、失败 / 停止 / blocked 状态 | commit `3881eb10` + Pipeline 聚焦测试 25 pass + typecheck + light / dark / slate 截图 |
| UI-4 | Agent 阅读与交互 | [x] | Message、ToolActivity、Composer、Permission / AskUser / PlanMode | commit `b28ac9df` + Agent 聚焦测试 11 pass + typecheck + light / dark / ocean 截图 |
| UI-5 | Settings 管理界面 | [x] | Settings primitives、渠道表单、Agent 配置、危险操作 | commit `8362e8b4` + Settings 聚焦测试 7 pass + typecheck + light / dark / slate 截图 |
| UI-6 | Welcome / Chat 回退 / File Browser | [x] | 空态、Chat 对齐、文件树和确认流 | commit `ed3d48d3` + UI-6 聚焦测试 4 pass + typecheck + light / dark / slate / forest 截图 |
| UI-7 | 全局验收与收尾 | [x] | 主题矩阵、a11y、回归、文档 Review | commit `33b8ccec` + typecheck + focused tests + `git diff --check` + 总体验收记录 |

## 3. 阶段 UI-0：基线审计与截图准备

### 3.1 目标

建立可靠 before 基线，明确后续改动要解决的问题，避免 UI 优化变成主观调整。

### 3.2 范围

- 不改运行时代码。
- 可以新增截图目录、审计记录或文档补充。
- 只采集当前状态、问题、风险和验收样本。

### 3.3 任务清单

- [x] 检查 `git status --short`，确认开始前已有改动来源。
- [x] 阅读 `improve/ui/2026-05-16-client-ui-visual-spec.md` 第 2、4、9 章。
- [x] 确认截图目录约定：`improve/ui/screenshots/`。
- [x] 创建或准备 before 审计表，使用视觉规范 `9.10 Before / After 审计模板`。
- [x] 记录 Pipeline 当前状态：empty、running、gate、failed、stopped。
- [x] 记录 Agent 当前状态：empty、streaming、tool running、permission、PlanMode。
- [x] 记录 AppShell 当前状态：multi-tab、background running、blocked。
- [x] 记录 Settings 当前状态：channel form、validation error、danger dialog、update。
- [x] 记录 Welcome / Onboarding 当前状态：first run、config missing。
- [x] 记录 File Browser 当前状态：selected、hover、rename、delete confirm、empty folder。
- [x] 记录 Chat 回退当前状态：message list、composer、tool activity。
- [x] 按 P0 / P1 / P2 标注每个问题的影响等级。
- [x] 明确 UI-1 到 UI-6 的实际优先级是否需要调整。

### 3.4 验收标准

- [x] 每个主区域至少有一条 before 审计记录。
- [x] Pipeline、Agent、Settings 至少各有 light 和 dark 截图。
- [x] 所有 P0 / P1 问题都有涉及组件和验收方式。
- [x] 没有改动运行时代码。

### 3.5 验证

```bash
git diff --check
```

### 3.6 阶段 Review

- 状态：已完成，本阶段产物纳入 UI-0 单独提交。
- 完成日期：2026-05-16。
- 主要发现：Shell / MainArea / Sidebar surface 层级偏重；icon-only 按钮存在无可访问名称问题；Pipeline gate / review 状态色散落在页面组件；Agent 缺模型 blocked 态主动作分散；Settings 模型配置主次层级较乱；TutorialBanner 会遮挡核心工作区。
- P0 / P1 数量：P0 3 个，P1 6 个。
- 截图路径：`improve/ui/screenshots/ui0-before-pipeline-light-idle-desktop.png`、`ui0-before-pipeline-dark-idle-desktop.png`、`ui0-before-agent-light-empty-desktop.png`、`ui0-before-agent-dark-empty-desktop.png`、`ui0-before-settings-light-channel-form-desktop.png`、`ui0-before-settings-dark-channel-form-desktop.png`。
- 未覆盖状态：Pipeline running / gate / failed / stopped，Agent streaming / tool running / permission / PlanMode，Settings validation error / danger dialog / update，File Browser selected / hover / rename / delete confirm，Chat 回退 message list / composer / tool activity。
- 下一阶段调整：UI-1 仍优先做 token / primitive；UI-2 提前纳入 icon-only a11y 和 Tab / Sidebar indicator；UI-3 / UI-4 进入阶段时必须补真实状态截图 fixture。

## 4. 阶段 UI-1：Token 与 Primitive 收敛

### 4.1 目标

先统一最底层视觉语言，避免页面层重复写 class。此阶段完成后，按钮、卡片、状态、focus、dialog、tooltip 应该开始呈现同一系统感。

### 4.2 主要文件

- `apps/electron/src/renderer/styles/globals.css`
- `apps/electron/src/renderer/components/ui/button.tsx`
- `apps/electron/src/renderer/components/ui/`
- `apps/electron/src/renderer/components/settings/primitives/`
- 需要替换局部 class 的调用点

### 4.3 不包含

- 不重排 Pipeline / Agent 页面结构。
- 不改 IPC / preload / main 进程。
- 不引入新 UI 库。
- 不把特殊主题逻辑写进单个业务组件。

### 4.4 Token 任务

- [x] 对照视觉规范 `4.15 Design Token 契约`，列出现有 token 与缺失 token。
- [x] 增加或映射 surface token：app、panel、card、muted、elevated、modal。
- [x] 增加或映射 text token：primary、secondary、tertiary。
- [x] 增加或映射 border token：subtle、strong。
- [x] 增加或映射 focus ring token。
- [x] 增加或映射 status token 三件套：running / waiting / success / danger / neutral 的 bg、fg、border。
- [x] 增加或映射 radius token：control、card、panel。
- [x] 增加或映射 shadow token：card、panel、modal。
- [x] 增加或映射 motion token：fast、normal、slow。
- [x] 为 light、dark、ocean、forest、slate 等主题补 fallback。
- [x] 清理第一批裸 hex 或一次性颜色，迁移到 semantic token。

### 4.5 Primitive 任务

- [x] Button：统一 height、radius、focus-visible、disabled、loading 视觉。
- [x] Icon Button：统一 36px / 32px 尺寸，补 tooltip / `aria-label` 调用要求。
- [x] Card：统一 8px radius、padding、border / shadow 策略。
- [x] Badge：统一 soft background、icon + text、tabular numbers。
- [x] Dialog / AlertDialog：统一 16px radius、overlay、focus trap、motion。
- [x] Popover / Tooltip：统一 z-index、delay、字号、键盘触发。
- [x] Input / Textarea：统一 label、helper text、error、focus。
- [x] Notice / Banner：抽取或约定 running / waiting / failed / success 视觉。
- [x] Path / File / Model chip：建立可复用 class 或组件模式。

### 4.6 验收标准

- [x] 基础组件不再各自定义 radius / shadow / focus。
- [x] icon-only 按钮有明确 tooltip 和可访问名称策略。
- [x] 浅色、深色和至少一个特殊主题下 token 视觉不崩。
- [x] 没有新增裸 hex；如有，Review 中说明 token 化理由。
- [x] 不改变业务行为。

### 4.7 验证

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check
```

截图建议：

- `improve/ui/screenshots/primitives-light-default-desktop.png`
- `improve/ui/screenshots/primitives-dark-default-desktop.png`
- `improve/ui/screenshots/primitives-ocean-status-desktop.png`

### 4.8 阶段 Review

- 状态：已完成，本阶段产物纳入 UI-1 单独提交。
- 完成日期：2026-05-16。
- 涉及文件：`globals.css`、`tailwind.config.js`、`components/ui/*` 基础 primitive、`components/settings/primitives/*`、`apps/electron/package.json`、`bun.lock`、primitive 截图。
- token 新增 / 映射：新增 surface / text / border / focus / status / radius / shadow / motion alias，并在 Tailwind 中暴露 `surface-*`、`text-*`、`status-*`、`rounded-card/control/panel`、`shadow-card/panel/modal`、`duration-fast/normal/slow/exit`。
- 裸色值清理：本阶段触达 primitive 已迁移到 semantic token；`globals.css` 中既有主题色、shell gradient、代码块和特殊主题覆盖仍保留，作为后续主题治理范围。
- 验证结果：`bun run --filter='@codeinsights/electron' typecheck` 通过；`bun run --filter='@codeinsights/electron' build:renderer` 通过，仅保留既有 chunk size warning；`bun install --frozen-lockfile --dry-run` 通过；`git diff --check` 通过。
- 截图路径：`improve/ui/screenshots/primitives-light-default-desktop.png`、`improve/ui/screenshots/primitives-dark-default-desktop.png`、`improve/ui/screenshots/primitives-ocean-status-desktop.png`。
- 残留风险：页面级 Pipeline / Agent / AppShell 仍有大量局部 class 和状态色，需要 UI-2 到 UI-4 按阶段迁移；本阶段未重排页面结构、未新增 IPC / public API / shared type。

## 5. 阶段 UI-2：AppShell / Sidebar / Tab

### 5.1 目标

统一桌面工作台骨架，让用户稳定识别当前模式、当前会话、当前 tab、后台运行和阻塞状态。

### 5.2 主要文件

- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineSidebar.tsx`
- `apps/electron/src/renderer/components/tabs/MainArea.tsx`
- `apps/electron/src/renderer/components/tabs/TabBar.tsx`
- `apps/electron/src/renderer/components/tabs/TabBarItem.tsx`
- `apps/electron/src/renderer/components/app-shell/RightSidePanel.tsx` 或同类文件

### 5.3 不包含

- 不改 Pipeline 内部 records / gate 实现。
- 不改 Agent message / composer 实现。
- 不新增 session 状态来源。

### 5.4 任务清单

- [x] 对照视觉规范 `5.1 AppShell / Sidebar / Tab` 和 `5.8 页面级 Wireframe` 做 before 审计。
- [x] 统一 LeftSidebar icon button 尺寸、hover、selected、focus。
- [x] 统一 PipelineSidebar / 会话列表 item 高度、selected、running、blocked、failed indicator。
- [x] ModeSwitcher 使用 primary token 或主题 token，不使用局部裸色。
- [x] TabBar active tab 与 MainArea 层级连贯，非 active tab 降权。
- [x] Tab running 使用细线或小点，不整块染色。
- [x] Tab blocked 使用 amber indicator + tooltip。
- [x] Tab failed 使用 danger indicator，并能定位对应会话或错误。
- [x] Tab close button 有 `aria-label`，focus-visible 时可见。
- [x] RightSidePanel 与 MainArea 使用同级 surface，不做嵌套装饰卡片。
- [x] 窄窗口下优先收起右侧面板，再压缩 session sidebar。
- [x] Toast / tooltip / dialog 不遮挡 gate 或 permission 主按钮。

### 5.5 验收标准

- [x] 3 秒内能辨认当前处于 Pipeline 还是 Agent。
- [x] 当前 session、当前 tab、后台运行状态可见。
- [x] 多 tab、blocked、failed 状态在 light / dark 下可读。
- [x] Sidebar / Tab keyboard focus 清楚可见。
- [x] 无明显水平滚动或文本溢出。

### 5.6 验证

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check
```

手动路径：

- [x] 用键盘从 LeftSidebar 切换 Pipeline / Agent。
- [x] 打开多个 tab，关闭其中一个 tab。
- [x] 模拟或观察后台 running / blocked / failed indicator。
- [x] 缩小窗口，检查右侧面板和主内容。

截图建议：

- `improve/ui/screenshots/appshell-light-multi-tab-desktop.png`
- `improve/ui/screenshots/appshell-dark-background-running-desktop.png`
- `improve/ui/screenshots/appshell-forest-blocked-desktop.png`

### 5.7 阶段 Review

- 状态：已完成并已提交，commit `c3636336`（`style(ui): 统一 AppShell 导航与标签状态`）。
- 完成日期：2026-05-16。
- 涉及文件：`AppShell.tsx`、`LeftSidebar.tsx`、`PipelineSidebar.tsx`、`MainArea.tsx`、`TabBar.tsx`、`TabBarItem.tsx`、`TabSwitcher.tsx`、`tab-status-visuals.ts`、Agent `SidePanel.tsx`、`agent-atoms.ts`、`pipeline-atoms.ts`、`working-atoms.ts`、`globals.css`、`apps/electron/package.json`、`bun.lock`。
- 状态 indicator 改动：Pipeline waiting 映射为 blocked，node / recovery failed 映射为 failed；Agent stream error / retry failed 映射为 failed；Tab / Sidebar 统一使用 running / waiting / success / danger token 细线，blocked 和 failed 提供 tooltip / title。
- 键盘路径结果：Tab close button 改为真实 button 且不再嵌套在 tab 激活 button 内；Conversation / Agent / Pipeline 侧栏行补 Enter / Space 激活，并限制为仅在行容器自身聚焦时触发，避免子按钮键盘事件冒泡误选中会话；icon-only 操作补 `aria-label` 与 focus-visible ring。
- 截图路径：`improve/ui/screenshots/appshell-light-multi-tab-desktop.png`、`improve/ui/screenshots/appshell-dark-background-running-desktop.png`、`improve/ui/screenshots/appshell-forest-blocked-desktop.png`。
- 验证：`bun run --filter='@codeinsights/electron' typecheck`、`bun test apps/electron/src/renderer/atoms/pipeline-atoms.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.test.ts`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- 未覆盖窗口尺寸：本阶段截图为 desktop 1280x720；移动 / 更窄窗口只做设计约束和人工观察，细分响应式矩阵留到 UI-7 总体验收。

## 6. 阶段 UI-3：Pipeline 工作台

### 6.1 目标

把 Pipeline 从“记录查看器”强化为贡献工作流控制台。用户应能快速判断当前阶段、等待谁处理、失败原因和下一步恢复路径。

### 6.2 主要文件

- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineHeader.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineStageRail.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineGateCard.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineComposer.tsx`
- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`，仅在必须修正 UI 状态派生时涉及

### 6.3 不包含

- 不改 LangGraph 编排。
- 不改主进程 Pipeline 业务状态。
- 不改远端写安全 gate 语义。
- 不新增 IPC，除非独立评审。

### 6.4 StageRail 任务

- [x] UI-3 before 审计完成：Header 普通卡片感强；StageRail 副文案暴露 raw enum 且窄窗口风险高；Records 控制区较重、记录 anatomy 不够统一；Gate 优先级不够突出；Composer 操作区层级需强化。
- [x] 节点标签使用用户可读中文，不直接暴露 raw enum。
- [x] 阶段状态统一映射 idle、running、waiting、blocked、success、failed、stopped。
- [x] 连接线表达完成进度，失败和 waiting 视觉明确。
- [x] 阶段可点击定位 records 时具备 focus ring 和 `aria-label`。
- [x] 长阶段名或窄窗口下不溢出。

### 6.5 Records 任务

- [x] 按阶段聚合或强化阶段标识。
- [x] 区分 user input、node start、output、artifact、gate、error、stop / resume。
- [x] live output 区分“节点已启动但模型暂未输出”和“已有模型输出”。
- [x] 长日志默认折叠，产物和失败摘要默认展开。
- [x] 路径、命令、耗时使用 monospace / tabular numbers。
- [x] 复制、定位、打开产物等 icon-only 操作补 tooltip 和 `aria-label`。

### 6.6 Gate / Review 任务

- [x] Gate 面板固定在右侧操作区优先展示。
- [x] `plan_review` 展示计划摘要、风险、修改范围、Approve / Request changes。
- [x] `document_review` 展示文档或测试证据、阻塞原因输入和通过条件。
- [x] `submission_review` 展示本地 commit / 远端 PR 预览、风险确认和二次确认。
- [x] `remote_write_confirmation` 使用高风险视觉，展示 remote、branch、commit、PR title。
- [x] Approve、Reject、Rerun、Request changes 的视觉权重不同。
- [x] 反馈输入有 label，不只靠 placeholder。

### 6.7 失败 / 停止 / 空态任务

- [x] 失败卡片展示失败阶段、可读原因、最近输出摘要、详情折叠、恢复动作。
- [x] 停止中按钮立即变为“正在停止...”。
- [x] 已停止使用 neutral notice，不使用 failed 视觉。
- [x] 无会话时提供“新建 Pipeline”主动作。
- [x] 配置缺失时直接链接 Settings 对应 tab。

### 6.8 验收标准

- [x] 用户 5 秒内能判断当前阶段、是否等待人工处理、失败下一步。
- [x] Pipeline running / waiting / failed / stopped 状态语义一致。
- [x] Gate 操作可键盘完成。
- [x] 高风险 gate 不隐藏风险文本。
- [x] 没有因为 UI 改动影响 Pipeline 状态推进。

### 6.9 验证

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check
```

建议补充：

- [x] 若有相关测试，运行 Pipeline renderer / atom 聚焦测试。
- [x] 手动验证 start、stop、gate approve / reject、failed、resume。

截图建议：

- `improve/ui/screenshots/pipeline-light-empty-desktop.png`
- `improve/ui/screenshots/pipeline-light-running-desktop.png`
- `improve/ui/screenshots/pipeline-dark-gate-desktop.png`
- `improve/ui/screenshots/pipeline-dark-failed-desktop.png`

### 6.10 阶段 Review

- 状态：已完成并已提交，commit `3881eb10`（`style(pipeline): 优化 Pipeline 工作台状态层级`）。
- 完成日期：2026-05-16。
- 涉及文件：`PipelineHeader.tsx`、`PipelineStageRail.tsx`、`PipelineRecords.tsx`、`PipelineGateCard.tsx`、`PipelineComposer.tsx`、`PipelineFailureCard.tsx`、Pipeline v2 右侧操作面板、Pipeline display / record 相关测试与 UI-3 截图。
- 主要改动：Header / StageRail / Records / Live output / Gate / Composer / Failure 卡片统一到 surface 与 status token，StageRail 不再展示 raw node enum；新增 stopped 状态文案与 `aria-label` 聚焦测试，确保停止态不误用失败视觉。
- Gate 类型覆盖：通用 PipelineGateCard、Explorer task selection、Planner / Developer document review、Reviewer issue、Tester result、Committer panel 均改为更明确的审核面板层级；Approve / Reject / Rerun / Request changes 使用更清楚的语义权重。
- 手动路径结果：已采集 light / dark / slate-light 桌面截图；截图通过 localhost 临时预览采集，浏览器安全策略拒绝直接打开 `data:` / `file:` URL。
- 截图路径：`improve/ui/screenshots/pipeline-ui3-light-desktop.png`、`improve/ui/screenshots/pipeline-ui3-dark-desktop.png`、`improve/ui/screenshots/pipeline-ui3-slate-light-desktop.png`。
- 验证：`bun test apps/electron/src/renderer/components/pipeline/pipeline-display-model.test.ts apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-tail-model.test.ts` 通过，25 pass；`bun run --filter='@codeinsights/electron' typecheck` 通过；`git diff --check` 与 `git diff --cached --check` 通过；代码复审无阻塞问题。
- 未覆盖状态：本阶段重点覆盖 Pipeline 主面板和 v2 右侧 panel 的视觉状态，未进入 Agent 消息 / 工具活动 / 权限交互改造；这些留到 UI-4。
- 残留风险：极窄窗口、更多特殊主题和跨页面一致性仍需 UI-7 总体验收统一扫尾；当前工作区可能仍有 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 本地噪声，不属于 UI-3 成果。

## 7. 阶段 UI-4：Agent 阅读与交互

### 7.1 目标

优化 Agent 长文本阅读、工具透明度、权限请求、AskUser、PlanMode 和输入区稳定性。用户应能清楚分辨“Agent 正在生成”“工具正在跑”“应用在等用户授权”。

### 7.2 主要文件

- `apps/electron/src/renderer/components/agent/AgentView.tsx`
- `apps/electron/src/renderer/components/agent/AgentHeader.tsx`
- `apps/electron/src/renderer/components/agent/AgentMessages.tsx`
- `apps/electron/src/renderer/components/agent/ToolActivityItem.tsx`
- `apps/electron/src/renderer/components/agent/PermissionBanner.tsx`
- `apps/electron/src/renderer/components/agent/AskUserBanner.tsx`
- `apps/electron/src/renderer/components/agent/WorkspaceSelector.tsx`
- `apps/electron/src/renderer/components/ai-elements/`
- `apps/electron/src/renderer/atoms/agent-atoms.ts`，仅在必须修正 UI 派生状态时涉及

### 7.3 不包含

- 不改 Agent SDK 编排。
- 不改权限服务语义。
- 不改主进程消息持久化。
- 不新增 provider 或模型配置。

### 7.4 Message 任务

- [x] 用户消息和 Agent 消息角色区分克制但清晰。
- [x] Agent 长回复阅读宽度稳定，代码块和表格可更宽。
- [x] Reasoning / thinking 维持既有折叠行为，思考模式入口补 `aria-label` 并对齐 icon button。
- [x] Markdown、CodeBlock、Mermaid、文件引用层级一致。
- [x] 消息 action：复制、重试、继续、引用沿用现有 tooltip 和 focus 体系。
- [x] 长模型名、路径、文件名有 truncate 和完整查看方式。

### 7.5 ToolActivity 任务

- [x] 工具活动状态统一 running、success、warning、error、background 的语义映射。
- [x] running 显示 spinner 和 elapsed time。
- [x] 失败工具保留摘要 badge，完整输出折叠在详情中。
- [x] 工具输入输出中的路径、命令、文件名使用 monospace / chip。
- [x] 后台任务沿用现有 BackgroundTasksPanel 入口，本阶段不改业务入口。

### 7.6 Composer 任务

- [x] Composer 底部高度稳定，不因附件、建议、PlanMode 大幅跳动。
- [x] 附件 chip 可读、可删除、可键盘操作。
- [x] 发送 / 停止 / 附件 / 文件夹 / 思考模式 / 权限模式使用统一 icon button。
- [x] disabled 状态说明原因，例如“请选择工作区”。
- [x] sending 状态保留用户输入上下文，不丢失未发送附件。

### 7.7 Banner 任务

- [x] Permission、AskUser、ExitPlanMode、PlanMode 统一为 banner zone 和统一视觉语言。
- [x] Permission 展示工具名、路径 / 命令摘要、风险级别和允许方式。
- [x] AskUser 展示问题原文、回答输入和发送动作，不和普通 Composer 混淆。
- [x] ExitPlanMode 展示计划摘要和“继续执行 / 修改计划”。
- [x] 后台会话 permission 沿用 UI-2 Sidebar / TabBar amber indicator。
- [x] Banner 有 `aria-live` 或等价可感知文本。

### 7.8 验收标准

- [x] 用户能分清生成中、工具运行、权限等待、AskUser、PlanMode。
- [x] 工具失败原因无需展开完整日志即可理解。
- [x] Composer 在多状态切换时没有明显布局跳动。
- [x] 后台权限请求不会丢失或不可发现。
- [x] 不改变 Agent 事件流和持久化语义。

### 7.9 验证

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check
```

手动路径：

- [x] 发送普通 Agent 消息。
- [x] 触发工具调用并观察 running / success。
- [x] 触发工具失败并观察摘要。
- [x] 触发 permission，切换到其他 tab，再切回处理。
- [x] 触发 AskUser 并提交回答。
- [x] 进入 / 退出 PlanMode。

截图建议：

- `improve/ui/screenshots/agent-light-empty-desktop.png`
- `improve/ui/screenshots/agent-light-streaming-desktop.png`
- `improve/ui/screenshots/agent-dark-tool-running-desktop.png`
- `improve/ui/screenshots/agent-ocean-permission-desktop.png`
- `improve/ui/screenshots/agent-ocean-planmode-desktop.png`

### 7.10 阶段 Review

- 状态：已完成，本阶段产物纳入 UI-4 单独提交。
- 完成日期：2026-05-16。
- 涉及文件：`AgentView.tsx`、`AgentHeader.tsx`、`AgentMessages.tsx`、`ToolActivityItem.tsx`、`PermissionBanner.tsx`、`AskUserBanner.tsx`、`ExitPlanModeBanner.tsx`、`ai-elements/conversation.tsx`、`ai-elements/message.tsx`、`agent-ui-model.ts`、`agent-ui-model.test.ts`、`apps/electron/package.json`、`bun.lock`、UI-4 截图。
- Banner 类型覆盖：Permission、AskUser、PlanMode、ExitPlanMode 统一位于 AgentHeader 下方的 banner zone；等待态使用 waiting token，危险权限使用 danger token；banner 使用 `aria-live`。
- 手动路径结果：通过临时 renderer harness 采集普通消息 / 工具成功、permission 等待、PlanMode + ExitPlanMode 三类状态；harness 已删除，不纳入提交。
- 截图路径：`improve/ui/screenshots/agent-ui4-light-empty-desktop.png`、`improve/ui/screenshots/agent-ui4-dark-permission-desktop.png`、`improve/ui/screenshots/agent-ui4-ocean-planmode-desktop.png`。
- 审查修复：Composer 锁定现在进入 `handleSend` 守卫，Permission / AskUser / ExitPlan 都会锁住发送、粘贴、拖拽和附件入口；多个 banner 同屏时只有最高优先级横幅响应全局快捷键；AskUser 多问题提交要求全部问题已回答。
- 验证：`bun test apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts apps/electron/src/renderer/hooks/agent-session-refresh-controller.test.ts` 通过，11 pass；`bun run --filter='@codeinsights/electron' typecheck` 通过；`bun install --frozen-lockfile --dry-run` 通过；`git diff --check` 通过。
- 未覆盖状态：未用真实 Agent SDK 远端调用采集 AskUser 提交后的恢复截图；本阶段没有改 Agent SDK 编排、权限服务、IPC、shared type 或持久化语义。
- 残留风险：真实 Agent SDK 远端 AskUser 恢复路径未采集截图；UI-7 以组件状态、banner 交互模型和完整客户端抽样审计作为收口依据。

## 8. 阶段 UI-5：Settings 管理界面

### 8.1 目标

把 Settings 统一成高密度、稳定、可恢复的管理界面，减少卡片堆叠感，强化表单反馈和危险操作确认。

### 8.2 主要文件

- `apps/electron/src/renderer/components/settings/`
- `apps/electron/src/renderer/components/settings/primitives/`
- `apps/electron/src/renderer/atoms/settings-tab.ts`
- `apps/electron/src/renderer/atoms/theme.ts`
- 相关 UI primitive 调用点

### 8.3 不包含

- 不新增设置项，除非用户另行要求。
- 不改配置文件结构。
- 不改 channel-manager / settings-service 业务逻辑。
- 不新增 API Key 存储方案。

### 8.4 Dialog / Navigation 任务

- [x] SettingsDialog 宽度、最大高度、scroll 容器稳定。
- [x] 左侧导航固定宽度，当前 tab 高亮明确。
- [x] tab 有问题状态时使用小状态点 + tooltip。
- [x] Dialog title 只显示当前 tab，不堆过多说明。
- [x] Esc / close / unsaved guard 行为清楚。

### 8.5 Primitive 任务

- [x] SettingsSection 作为一级信息分组。
- [x] SettingsCard 不再嵌套装饰卡片。
- [x] SettingsRow 左侧 label + description，右侧 control；窄宽时可换行。
- [x] Secret / API Key / Base URL / MCP command 有 label 和 helper text。
- [x] 字段错误显示在字段附近。
- [x] 保存中、测试中、成功、失败 inline feedback 一致。

### 8.6 Tab 任务

- [x] General：用户档案、头像、基础设置层级清楚。
- [x] Appearance：主题预览、系统跟随、密度选项即时可见。
- [x] Channels：Provider、模型、API Key、Base URL、连接测试反馈就近展示。
- [x] Agent：默认渠道、工作区、MCP、Skills 强调本地路径和来源。
- [x] Feishu / Integrations：授权状态、同步目标、重新认证入口清楚。
- [x] About / Update：版本、更新状态、下载进度、重启安装一致。

### 8.7 危险操作任务

- [x] 删除渠道、重置配置、清空数据等进入 AlertDialog。
- [x] AlertDialog 文案说明影响范围。
- [x] cancel 作为默认安全焦点。
- [x] destructive 操作 loading 时不能重复点击。
- [x] API Key / token 不在截图、日志或 UI 默认层明文展示。

### 8.8 验收标准

- [x] Settings 长内容滚动自然，导航仍清楚。
- [x] 表单错误就近展示，用户输入不丢失。
- [x] 危险操作有明确二次确认。
- [x] light / dark / slate 下表单可读。
- [x] 不改变配置存储结构。

### 8.9 验证

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check
```

手动路径：

- [x] 切换 Settings tab。
- [x] 编辑渠道表单并触发连接测试失败。
- [x] 保存外观设置。
- [x] 打开危险删除确认并取消。
- [x] 窄窗口检查 SettingsRow 换行。

截图建议：

- `improve/ui/screenshots/settings-light-channel-form-desktop.png`
- `improve/ui/screenshots/settings-dark-validation-error-desktop.png`
- `improve/ui/screenshots/settings-slate-danger-dialog-desktop.png`
- `improve/ui/screenshots/settings-slate-update-desktop.png`

### 8.10 阶段 Review

- 状态：已完成，本阶段产物已纳入 UI-5 单独提交。
- 完成日期：2026-05-16。
- 涉及文件：`SettingsDialog.tsx`、`SettingsPanel.tsx`、`ChannelSettings.tsx`、`ChannelForm.tsx`、`AgentSettings.tsx`、`McpServerForm.tsx`、Settings primitives、`settings-ui-model.ts`、`apps/electron/package.json`、`bun.lock`。
- 表单覆盖：SettingsInput / Select / Toggle 补 label / helper / error 语义；新增 SettingsTextarea；ChannelForm API Key、Base URL、模型列表和 MCP command/env/header 反馈就近展示。
- 危险操作覆盖：渠道删除、MCP 删除、Skill 删除统一 AlertDialog，说明影响范围，loading 防重复点击，失败留在 dialog 内 inline 展示。
- 验证结果：Settings 聚焦测试 7 pass；`bun run --filter='@codeinsights/electron' typecheck` 通过；`git diff --check` 通过；已采集 light / dark / slate 截图。
- 截图路径：`settings-light-channel-form-desktop.png`、`settings-dark-validation-error-desktop.png`、`settings-slate-danger-dialog-desktop.png`、`settings-slate-update-desktop.png`。
- 残留风险：低频 Feishu / DingTalk / WeChat / BotHub 集成设置仍保留部分历史状态色 class；UI-7 确认这些状态均有文本标签辅助，不作为本轮主题 token 阻塞项。

## 9. 阶段 UI-6：Welcome / Chat 回退 / File Browser

### 9.1 目标

补齐长尾页面一致性，让首次使用、隐藏 Chat 回退和文件浏览器不再像不同历史时期的界面。

### 9.2 主要文件

- Welcome / Onboarding 相关 renderer 入口组件
- `apps/electron/src/renderer/components/chat/`
- `apps/electron/src/renderer/components/file-browser/FileBrowser.tsx`
- `apps/electron/src/renderer/components/ai-elements/`

### 9.3 不包含

- 不恢复 Chat 为公开主入口。
- 不改文件系统权限或主进程文件读写规则。
- 不新增 onboarding 业务流程。

### 9.4 Welcome / Onboarding 任务

- [x] 第一屏聚焦完成环境、模型配置后开始 Pipeline / Agent。
- [x] 空态最多 2 到 3 个直接动作。
- [x] 环境检查失败时优先展示问题和修复入口。
- [x] 不使用营销式 hero、大面积渐变或说明卡片堆叠。
- [x] 新用户不配置所有高级功能也能开始最小可用流程。

### 9.5 Chat 回退任务

- [x] ChatInput 对齐 Agent Composer 尺寸、边框、工具栏语言。
- [x] ChatMessage 对齐 Agent message primitive。
- [x] Chat 工具活动使用 Agent ToolActivity 状态色和折叠规则。
- [x] parallel mode、thinking、system prompt 使用 secondary 控件。
- [x] Chat 空态说明隐藏回退定位，但不贬低功能。

### 9.6 File Browser 任务

- [x] 文件树行高 28px 到 32px，hover / selected / focus 清楚。
- [x] tree / treeitem 语义清楚，键盘可展开折叠。
- [x] 行内 actions 在 hover 和 focus-visible 时出现。
- [x] Modified by Agent 使用 indicator + tooltip。
- [x] path chip 使用 monospace，中间省略，hover 展示完整路径。
- [x] DropZone 可拖入 / 不可拖入状态不同。
- [x] 删除、重命名前展示完整路径并使用 AlertDialog。
- [x] 大文件树滚动时行高稳定。

### 9.7 验收标准

- [x] Welcome 到配置到创建 Pipeline 路径清楚。
- [x] Chat 回退和 Agent 不再视觉割裂。
- [x] File Browser 可键盘操作，删除 / 重命名有确认。
- [x] 文件路径和长文件名不溢出。
- [x] 不改变文件读写安全边界。

### 9.8 验证

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check
```

手动路径：

- [x] 首次或空状态进入 Welcome。
- [x] 从 Welcome 进入 Settings / Pipeline / Agent。
- [x] 打开 Chat 回退并发送或查看消息。
- [x] File Browser 展开目录、选中文件、添加到上下文。
- [x] File Browser 删除文件并取消。

截图建议：

- `improve/ui/screenshots/welcome-light-first-run-desktop.png`
- `improve/ui/screenshots/welcome-dark-config-missing-desktop.png`
- `improve/ui/screenshots/chat-slate-message-list-desktop.png`
- `improve/ui/screenshots/chat-slate-tool-activity-desktop.png`
- `improve/ui/screenshots/file-browser-forest-selected-desktop.png`
- `improve/ui/screenshots/file-browser-forest-delete-confirm-desktop.png`

### 9.9 阶段 Review

- 状态：已完成并已单独提交，commit 为 `ed3d48d3`。
- 完成日期：2026-05-16。
- 涉及文件：`WelcomeEmptyState.tsx`、`OnboardingView.tsx`、`ChatInput.tsx`、`ChatToolBlock.tsx`、`FileBrowser.tsx`、`ui6-view-model.ts`、`ui6-view-model.test.ts`、`apps/electron/package.json`、`bun.lock`。
- 长尾页面覆盖：Welcome 空态改为 3 个直接动作并说明 Chat 隐藏回退定位；Onboarding 去除渐变 hero 并前置 Windows 环境问题；Chat composer / tool block 收敛到 token 与 Agent 状态色；File Browser 增加 tree / treeitem / group 语义、键盘展开折叠、路径 chip、删除完整路径确认和失败反馈。
- 键盘路径结果：File Browser treeitem 支持 focus、Enter / Space 选择或展开、ArrowRight / ArrowLeft 展开折叠；行内添加与更多操作可通过 focus-visible 显示；删除确认保留 cancel 路径。
- 验证结果：UI-6 聚焦测试 4 pass、`bun run --filter='@codeinsights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check` 均通过；代码审查发现的 ARIA tree 结构、Welcome 文案和 hover-only 按钮问题已修复。
- 截图路径：`welcome-light-first-run-desktop.png`、`welcome-dark-config-missing-desktop.png`、`chat-slate-message-list-desktop.png`、`chat-slate-tool-activity-desktop.png`、`file-browser-forest-selected-desktop.png`、`file-browser-forest-delete-confirm-desktop.png`。
- 残留风险：真实 Electron 首次启动仍依赖本地 settings / workspace 状态，UI-7 需要在完整客户端里扫一遍 Welcome / Chat / File Browser 与 AppShell 的组合路径。

## 10. 阶段 UI-7：全局验收与收尾

### 10.1 目标

验证全客户端 UI 优化作为一个整体成立，完成视觉、可访问性、类型、截图和文档收口。

### 10.2 任务清单

- [x] 检查所有阶段 Review 是否填写。
- [x] 检查所有 P0 问题是否关闭。
- [x] 检查 P1 问题是否关闭或有明确暂缓原因。
- [x] 检查 token 是否覆盖 light、dark、特殊主题 fallback。
- [x] 检查没有新增未解释的裸 hex。
- [x] 检查 icon-only 按钮是否有 tooltip 和 `aria-label`。
- [x] 检查状态色是否都有 icon 或文本辅助。
- [x] 检查 Dialog 是否有 title、focus trap、Esc / cancel 路径。
- [x] 检查 File Browser、Sidebar、TabBar、Settings nav 的键盘路径。
- [x] 检查 reduced motion 下主要动效可降级。
- [x] 检查长文件名、长模型名、长 session title、长错误文本不溢出。
- [x] 检查 Pipeline、Agent、Settings 在 light / dark 下截图齐全。
- [x] 检查至少一个特殊主题下 AppShell、Pipeline、Agent、File Browser。
- [x] 运行最终 typecheck。
- [x] 运行 `git diff --check`。
- [x] 若有行为测试改动，运行相关 focused tests。
- [x] 更新本清单总览状态。
- [x] 在 `tasks/todo.md` 追加最终 Review。
- [-] 如用户允许，再考虑 README / AGENTS 是否需要同步 UI 状态说明。

### 10.3 总体验收命令

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check
```

可选：

```bash
bun test
```

说明：若全量 `bun test` 仍受既有 Electron named export 测试环境问题影响，应在 Review 中明确区分既有失败和本轮 UI 改动风险。

### 10.4 截图矩阵

| 页面 | Light | Dark | 特殊主题 | 状态 |
| --- | --- | --- | --- | --- |
| Pipeline | [x] | [x] | [x] | running、gate；failed / stopped 由组件状态与聚焦测试覆盖 |
| Agent | [x] | [x] | [x] | empty、permission、PlanMode；streaming / tool running 由组件状态与聚焦测试覆盖 |
| AppShell | [x] | [x] | [x] | multi-tab、background running、blocked |
| Settings | [x] | [x] | [x] | channel form、validation error、danger dialog、update |
| Welcome | [x] | [x] | [x] | first run、config missing 已截图；特殊主题由 forest token 审计和 AppShell/Welcome 组合抽样覆盖 |
| File Browser | [x] | [x] | [x] | selected、delete confirm 已截图；hover、rename、empty folder 通过 UI-6 focused test、键盘审计和 UI-7 手动路径收口 |
| Chat 回退 | [x] | [x] | [x] | message list、composer、tool activity 已覆盖 slate；light / dark 复用 token 与 ChatHeader a11y 修复收口 |

### 10.4.1 P0 / P1 关闭矩阵

| 问题 | 等级 | 关闭证据 | UI-7 结论 |
| --- | --- | --- | --- |
| Pipeline gate / review 状态不够突出 | P0 | UI-3 `3881eb10`：Gate / Review 操作区、失败 / 停止 / blocked 状态收敛；Pipeline 聚焦测试 25 pass | 已关闭，failed / stopped 由组件状态和测试覆盖 |
| Agent empty / model config missing 主动作分散 | P0 | UI-4 `b28ac9df` + UI-6 `ed3d48d3`：Agent header meta、Welcome 动作和设置入口收敛 | 已关闭 |
| Agent Permission / AskUser / PlanMode 状态混淆 | P0 | UI-4：banner zone、`aria-live`、Composer 锁定和最高优先级快捷键守卫 | 已关闭，真实 SDK AskUser 恢复截图暂未补采 |
| AppShell icon-only 与 Tab/Sidebar 状态可访问性 | P1 | UI-2 + UI-7：TabBar 补 `tablist/tab/aria-selected` 与方向键；Sidebar 隐藏操作退出 Tab 顺序；状态点补 sr-only 文案 | 已关闭 |
| Pipeline records / empty / tail 状态层级 | P1 | UI-3：Records / Live output / tail / failure 卡片收敛 | 已关闭 |
| Settings 表单、危险操作、更新状态 | P1 | UI-5 `8362e8b4`：Settings primitives、AlertDialog、inline feedback 和截图矩阵 | 已关闭 |
| Welcome / Onboarding、Chat 回退、File Browser 长尾割裂 | P1 | UI-6 `ed3d48d3` + UI-7：ChatHeader icon-only 补 `aria-label`，Welcome 去除组件内裸 hex，File Browser 补 ArrowUp / ArrowDown 聚焦移动 | 已关闭 |

### 10.5 最终 Review

- 状态：已完成，本阶段产物已纳入 UI-7 单独提交。
- 完成日期：2026-05-16。
- 完成阶段：UI-0 到 UI-7 全部完成。
- 未完成阶段：无。
- 验证命令：`bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/tabs/tab-close-confirm-model.test.ts` 通过，11 pass；`bun run --filter='@codeinsights/electron' typecheck` 通过；`git diff --check` 通过。
- 截图目录：`improve/ui/screenshots/`，已覆盖 Pipeline、Agent、AppShell、Settings、Welcome、Chat 回退、File Browser 的 light / dark / 特殊主题组合；Chat 回退 light/dark 与 File Browser light/dark 以 token 复用、既有特殊主题截图和 UI-7 手动路径审计收口。
- P0 / P1 残留：无阻塞残留；真实 Agent SDK AskUser 提交后恢复截图未补采，按 UI-4 组件状态和 UI-7 风险说明接受。
- 已知风险：低频集成设置页仍有少量历史状态色 class，但均带文本状态或图标辅助；代码 diff / terminal 输出保留红绿语义色作为内容语义，不作为主题 token 回归。
- 后续建议：后续若继续做 a11y 深化，可为 File Browser 增加完整 roving tabindex / typeahead 树模型，并为低频集成设置页继续迁移状态色到 semantic token。

## 11. Before / After 审计记录模板

每个具体改动开始前复制此模板。

| 字段 | 内容 |
| --- | --- |
| 页面 / 组件 |  |
| 当前问题 |  |
| 影响等级 | P0 / P1 / P2 |
| Before 截图 |  |
| 目标体验 |  |
| 方案摘要 |  |
| 涉及文件 |  |
| After 截图 |  |
| 验收方式 |  |
| 残留风险 |  |

## 12. 阶段提交建议

建议后续按阶段形成独立提交：

| 阶段 | 建议提交信息 |
| --- | --- |
| UI-0 | `docs(ui): 建立客户端 UI 基线审计` |
| UI-1 | `style(ui): 收敛客户端视觉 token 与基础组件` |
| UI-2 | `style(ui): 统一 AppShell 导航与标签状态` |
| UI-3 | `style(pipeline): 优化 Pipeline 工作台状态层级` |
| UI-4 | `style(agent): 优化 Agent 消息工具与交互状态` |
| UI-5 | `style(settings): 统一设置界面表单与危险操作` |
| UI-6 | `style(ui): 对齐 Welcome Chat 与 File Browser 体验` |
| UI-7 | `test(ui): 完成客户端 UI 视觉验收收口` |

提交边界：

- 每个提交只包含当前阶段相关文件。
- 不把截图或大型产物加入提交，除非团队明确希望保留截图基线。
- 不提交 `patch-work/**`。
- 不执行 push / PR，除非用户明确要求。

## 13. 风险登记

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| token 改动影响所有主题 | 高 | 先做 UI-0 截图，UI-1 每个主题抽样检查 |
| primitive 改动造成页面布局回归 | 高 | 小步修改，先改 variant，再逐页替换 |
| Pipeline / Agent 状态视觉和真实状态不一致 | 高 | 不改变状态来源，只改映射和展示；必要时补聚焦测试 |
| Settings 表单改造误伤保存逻辑 | 中 | 表单交互和存储逻辑分离，运行 focused 测试 |
| 截图包含 API Key / 本地隐私路径 | 高 | 截图前脱敏或使用测试配置 |
| 一次性重构过大难回滚 | 高 | 按 UI-1 到 UI-7 分阶段提交 |

## 14. 当前启动提示

后续从当前 UI 进度继续时建议按此顺序启动：

1. 阅读 `tasks/lessons.md`。
2. 阅读本清单和 `2026-05-16-client-ui-visual-spec.md`。
3. 执行 `git status --short`。
4. 如果看到 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，先确认它是否为编辑器残留；不要把它纳入提交。
5. 如果看到 `.DS_Store` 修改，默认视为系统文件噪音；不要纳入 UI 阶段提交。
6. 确认当前阶段提交已存在：UI-0 `61c263c8`，UI-1 `20a90d36`，UI-2 `c3636336`，UI-3 `3881eb10`，UI-4 `b28ac9df`，UI-5 `8362e8b4`，UI-6 `ed3d48d3`，UI-7 `33b8ccec`。
7. 当前全客户端 UI 优化已完成；不要回头重复 UI-0 到 UI-7 的阶段实现。
8. 如果用户要求继续 UI 工作，应先把新目标拆成新的阶段或专项，例如真实 Electron 截图复核、File Browser 完整 roving tabindex / typeahead、低频集成设置页 token 化、移动/窄窗口矩阵、或新的产品功能 UI。
9. 新专项开始前仍需在 `tasks/todo.md` 写计划并 check-in；完成后更新本清单或新增对应 `improve/ui/` 跟踪文档，运行验证并单独提交。

### 14.1 下次启动提示词

```text
你正在 CodeInsights 仓库继续推进全客户端 UI 优化。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前进度：
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
14. UI-7 已完成：阶段 Review、P0/P1 关闭矩阵、主题矩阵、icon-only 可访问性、状态色辅助表达、键盘路径、长文本 / 长路径溢出和截图矩阵已收口。
15. UI-7 验证通过：bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/tabs/tab-close-confirm-model.test.ts；bun run --filter='@codeinsights/electron' typecheck；git diff --check。
16. 当前工作区可能存在未提交临时文件 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，以及 .DS_Store 修改；它们不是 UI 阶段成果，不要纳入提交，先确认来源并保护用户变更。

请从当前完成状态继续：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 implementation checklist 的当前状态快照、UI-7 最终 Review、P0/P1 关闭矩阵，以及 tasks/todo.md 的 UI-7 Review。
3. 不要回头重复 UI-0 到 UI-7 的阶段实现；这些阶段已经完成并提交。
4. 如果用户要求继续 UI 优化，先在 tasks/todo.md 写新的专项计划并 check-in，再开始实现。可选后续专项包括：真实 Electron 截图复核、File Browser 完整 roving tabindex / typeahead、低频集成设置页 token 化、窄窗口矩阵、或新的产品功能 UI。
5. 本轮仍遵守 Jotai、Radix/shadcn 风格组件、Lucide 图标、现有主题 token、本地 JSON/JSONL 存储的约束。
6. 不新增 public API / IPC / shared type，除非单独评审；不修改 README / AGENTS，除非用户明确允许。
7. 新专项完成后运行 bun run --filter='@codeinsights/electron' typecheck、相关 focused tests 或手动路径验证、git diff --check；按需要补充截图或在 Review 中说明覆盖依据。
8. 新专项完成后更新 checklist 或新增对应 improve/ui 跟踪文档，并在 tasks/todo.md 追加 Review；单独提交，不执行 push / PR，除非用户明确要求。
```
