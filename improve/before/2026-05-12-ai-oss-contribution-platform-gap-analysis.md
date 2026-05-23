# CodeInsights 距离“AI 辅助开源贡献平台”还缺什么

> 分析日期：2026-05-12  
> 目标视角：零经验用户第一次做开源贡献  
> 分析范围：只看当前仓库真实实现，不假设未来能力已存在  
> 文档目标：指出当前功能不足，并给出可落地的新功能、数据模型、UI 形态和阶段路线图

## 结论先行

CodeInsights 现在已经是一个很强的本地 Agent / Pipeline 工作台，但还不是完整的“AI 辅助开源贡献平台”。

它已经具备“让 AI 在本地仓库中完成任务”的执行底座：

- `Pipeline | Agent` 双入口
- 工作区、Skills、MCP、附件、文件浏览
- 权限确认、AskUser、ExitPlan
- 结构化 Pipeline、人工 gate、checkpoint、恢复
- 本地优先的 JSON / JSONL / checkpoint 持久化
- Git、Node、Bun、Shell 运行时检测
- Git 仓库状态检测
- 飞书 Bridge 远程触发会话

但它还缺少一层更高的产品对象：

> 从“找到一个 issue”到“生成一个可合并 PR”，中间这条零经验用户可走通的贡献路径。

换句话说，当前系统更像“能干活的 Agent IDE”，不是“能带新手完成第一次开源贡献的平台”。

最重要的改进方向不是继续堆更多模型，而是增加一个 `Contribution` 领域层，把 `repository / issue / branch / diff / test evidence / PR / review feedback` 产品化，并让 Agent 与 Pipeline 围绕这个领域对象协作。

## 零经验用户真正需要什么

这里的“零经验用户”不是不会打字，而是不了解开源协作流程。他们通常会卡在这些问题上：

- 不知道应该选哪个仓库、哪个 issue、哪个标签。
- 不知道 `fork / clone / branch / commit / PR / review` 分别是什么。
- 不知道本地环境是否能跑项目，也不知道失败时该修什么。
- 不知道 AI 改了什么、为什么这样改、是否会破坏项目。
- 不知道哪些测试必须跑，测试失败是否意味着不能提交。
- 不知道 PR 标题、正文、关联 issue、验证说明应该怎么写。
- 不知道 maintainer review comment 到底要求自己做什么。

因此，一个面向零经验用户的 AI 辅助开源贡献平台，至少要提供四类支撑：

| 支撑类型 | 用户需要看到什么 | 当前 CodeInsights 状态 |
| --- | --- | --- |
| 任务选择 | 哪些 issue 适合我，为什么适合 | 基本缺失 |
| 过程引导 | 下一步该做什么，做完如何判断 | Pipeline 有阶段，但不是贡献语义 |
| 安全解释 | AI 要做什么、风险是什么、能否回退 | 有权限系统，但解释不够新手化 |
| 交付包装 | commit、PR、测试证据、review 回复 | 基本缺失 |

## 依据

下面这些文件最能反映当前真实能力：

- [README.md](</Users/zq/Desktop/ai-projs/posp/CodeInsights/README.md>)
- [AGENTS.md](</Users/zq/Desktop/ai-projs/posp/CodeInsights/AGENTS.md>)
- [tutorial/tutorial.md](</Users/zq/Desktop/ai-projs/posp/CodeInsights/tutorial/tutorial.md>)
- [apps/electron/src/renderer/components/onboarding/OnboardingView.tsx](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/onboarding/OnboardingView.tsx>)
- [apps/electron/src/renderer/components/pipeline/PipelineView.tsx](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/pipeline/PipelineView.tsx>)
- [apps/electron/src/renderer/components/agent/AgentView.tsx](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/agent/AgentView.tsx>)
- [apps/electron/src/renderer/components/agent/SidePanel.tsx](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/agent/SidePanel.tsx>)
- [apps/electron/src/main/lib/git-detector.ts](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/git-detector.ts>)
- [apps/electron/src/main/lib/github-release-service.ts](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/github-release-service.ts>)
- [apps/electron/src/main/lib/pipeline-graph.ts](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/pipeline-graph.ts>)
- [apps/electron/src/main/lib/pipeline-node-router.ts](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/pipeline-node-router.ts>)
- [apps/electron/src/main/lib/codex-pipeline-node-runner.ts](</Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/codex-pipeline-node-runner.ts>)
- [packages/shared/src/types/pipeline.ts](</Users/zq/Desktop/ai-projs/posp/CodeInsights/packages/shared/src/types/pipeline.ts>)
- [packages/shared/src/types/runtime.ts](</Users/zq/Desktop/ai-projs/posp/CodeInsights/packages/shared/src/types/runtime.ts>)
- [packages/shared/src/constants/permission-rules.ts](</Users/zq/Desktop/ai-projs/posp/CodeInsights/packages/shared/src/constants/permission-rules.ts>)

## 当前能力矩阵

| 能力 | 当前实现 | 对开源贡献的价值 | 当前不足 |
| --- | --- | --- | --- |
| 首次引导 | `OnboardingView` 只有欢迎页、教程入口和 Windows Shell 检测 | 可以承担环境提醒入口 | 没有仓库、issue、贡献任务、术语解释和第一步任务生成 |
| Pipeline | 固定 `explorer -> planner -> developer -> reviewer -> tester`，有人工 gate 和 checkpoint | 适合把贡献任务拆成阶段执行 | 阶段是通用研发语义，不知道当前 issue、PR、branch、review thread |
| Agent | 通用工作区 Agent，支持文件、权限、AskUser、工具调用 | 能实际读写代码、调试、验证 | 对“贡献”没有专属上下文，用户仍要自己组织任务 |
| 文件侧栏 | `SidePanel` 展示会话文件、工作区文件、附加目录和待发送文件 | 能让用户查看文件上下文 | 不是贡献工作台，看不到 diff、测试证据、PR 准备度 |
| Git 检测 | `GitRepoStatus` 只包含 `isRepo / branch / hasChanges / remoteUrl` | 能判断目录是否为 Git 仓库 | 不含 staged / unstaged、upstream、默认分支、分支差异、commit 草稿、PR 关联 |
| Runtime 检测 | 覆盖 Git、Node、Bun、Windows Git Bash / WSL | 能做基础环境预检 | 不会识别项目依赖安装状态、测试命令、构建命令、贡献指南要求 |
| 权限系统 | 安全工具白名单、只读 Bash 模式、危险命令标记 | 能限制 AI 误操作 | 展示仍偏工程视角，缺少“为什么执行、影响什么、如何回退” |
| GitHub 能力 | `github-release-service` 只拉取 CodeInsights 自身 release | 可复用 GitHub API 调用模式 | 没有 repo / issue / PR / review comment 导入 |
| 本地存储 | JSON / JSONL / checkpoint，本地优先 | 适合开源桌面工具，可迁移、可审计 | 还没有 contribution 领域的索引和事件日志 |

这个矩阵说明：CodeInsights 的执行底座已经足够强，真正缺的是贡献流程和贡献对象，而不是再造一个通用聊天入口。

## 核心缺口

### 1. 缺少“零经验用户入口”

现在的首次启动流程只是欢迎页、教程入口和 Windows 环境检查。它没有引导用户完成真正的第一步：

- 选择一个仓库
- 选择一个 issue
- 判断难度
- 建立工作区
- 解释术语
- 创建分支
- 生成第一份贡献计划

对新手来说，这就是最大缺口。没有这个入口，用户进入产品后会看到 Agent / Pipeline 两种能力，但不知道应该把“第一次开源贡献”拆成哪些具体动作。

### 2. 缺少“贡献对象模型”

当前系统的核心对象是：

- conversation
- agent session
- pipeline session
- workspace

但“开源贡献平台”还需要这些对象：

- repository
- issue
- branch
- pull request
- patch / diff
- test evidence
- review feedback
- contribution history

也就是说，现在是“会话中心”，还不是“贡献中心”。这会导致一个问题：同一个贡献任务的 issue 摘要、分支状态、Pipeline 记录、Agent 会话、测试结果、PR 草稿之间没有统一归属。

### 3. 缺少从 issue 到 PR 的闭环

目前有执行和验证，但没有完整交付包装：

- 没有 issue 导入
- 没有仓库导入
- 没有 branch / fork / remote 状态追踪
- 没有 commit 草稿
- 没有 PR 草稿
- 没有测试证据整理
- 没有 maintainer review comment 导入和处理

用户可以让 AI 修改代码，但很难自然地把结果变成一个可提交、可解释、可复审的 PR。

### 4. 缺少“新手可理解的安全边界”

权限系统已经存在，但表达方式仍偏工程视角。新手更需要知道：

- 为什么要执行这条命令
- 这条命令是读取信息、修改文件，还是会影响远端
- 会改哪些文件
- 有没有风险
- 能不能先 dry-run
- 出错后怎么回滚

当前系统能控制权限，但还没有把“可放心交给 AI”的理由讲清楚。

### 5. 缺少“贡献工作台”

`SidePanel` 和 `FileBrowser` 很强，但它们展示的是文件，不是贡献过程。

开源贡献平台需要一个更高层的工作台，持续展示：

- 当前仓库
- 当前 issue
- 当前分支
- 当前阶段
- 变更文件
- 未解决风险
- 已跑测试
- PR 准备度
- review 待办

这个工作台应该把用户从“看文件树”提升到“看贡献状态”。

### 6. 缺少新手学习闭环

当前系统对“会用的人”非常友好，但对“第一次来的人”不够友好。

它没有告诉用户：

- 这个项目最常见的贡献类型是什么
- 适合新手的 issue 在哪里
- 当前任务为什么适合或不适合新手
- 这次失败的原因是什么
- 下次可以怎么做得更好
- 哪些经验可以沉淀为下一次任务模板

这会让新手每次都从零开始。

### 7. 文档和现实实现有轻微分叉

`tutorial/tutorial.md` 里仍有“Pipeline 节点统一走 Claude Agent SDK 兼容链路”的旧口径，但当前 README 与代码已经是混合路由：`developer` / `reviewer` 走 Codex，`explorer` / `planner` / `tester` 走 Claude。

这不是核心功能 bug，但对零经验用户是实打实的认知成本。后续引入 Contribution 入口时，教程应同步改成三层结构：

- 新手贡献流程教程
- Pipeline / Agent 能力教程
- 模型渠道与工作区配置教程

## 从新手旅程看，哪里断了

| 阶段 | 新手想完成的动作 | 当前支持 | 主要断点 | 应补能力 |
| --- | --- | --- | --- | --- |
| 发现任务 | 找到适合自己的 issue | 基本无 | 用户必须自己去 GitHub 搜索和判断 | repo / issue 浏览、good first issue 推荐、难度评分 |
| 理解任务 | 看懂 issue、贡献指南和代码位置 | Agent 可读文件 | 没有自动汇总 issue、README、CONTRIBUTING、相关模块 | issue 摘要、贡献指南摘要、相关文件定位 |
| 准备环境 | clone / open repo，安装依赖，建分支 | Runtime / Git 基础检测 | 不知道项目命令、不知道分支是否干净、不知道依赖是否可用 | repo preflight、依赖检查、测试命令发现、分支建议 |
| 实际修改 | 让 AI 修改代码并看懂改动 | Agent / Pipeline 可执行 | 缺少贡献模板、diff 预览、变更风险解释 | 任务模板、变更计划、diff 面板、风险摘要 |
| 验证结果 | 跑测试并判断是否能交付 | Agent 可执行命令，Pipeline 有 tester | 测试证据不会自动归档，失败解释不面向 PR | test evidence、失败归因、验证结论 |
| 交付 PR | 写 commit、PR 标题、PR 正文 | 基本无 | 用户需要离开产品手动组织交付材料 | commit 草稿、PR 草稿、关联 issue、验证说明 |
| 接住 review | 处理 maintainer feedback | Pipeline reviewer 是内部自审 | 没有导入真实 review comment，也没有多轮修复追踪 | review inbox、comment 归类、修复计划、回复草稿 |
| 复盘学习 | 记住这次经验，下次更顺 | memory 有通用能力 | 没有贡献履历、贡献模板和失败模式沉淀 | contribution history、学习卡片、任务推荐 |

## 应该新增什么功能

### P0：贡献向导

贡献向导是最关键的新入口。它应该显式命名为“开始贡献”或“新建贡献任务”，而不是让用户从 Agent / Pipeline 自己拼流程。

建议流程：

1. 粘贴 GitHub repo URL、issue URL，或选择本地仓库。
2. 自动识别仓库名、默认分支、当前本地路径、远端地址。
3. 检查本机 Git、Node、Bun、Shell 和项目脚本。
4. 读取 README、CONTRIBUTING、package scripts 和 issue 正文。
5. 生成“任务理解”：问题是什么、改哪里、风险是什么、需要跑什么测试。
6. 建议分支名，例如 `fix/issue-123-login-error`。
7. 选择执行方式：安全计划模式、Pipeline 模式、Agent 模式。
8. 创建 `ContributionTask` 并进入贡献工作台。

验收标准：

- 新手只粘贴一个 public issue URL，就能得到一份可读的任务简报。
- 如果本地不是 Git 仓库，向导能提示 clone 或选择目录。
- 如果本地有未提交改动，向导能阻止覆盖风险并解释原因。
- 用户能在不理解 Pipeline 内部节点的情况下进入贡献流程。

### P0：仓库 / issue 导入

这是从“AI 工具”升级到“开源贡献平台”的关键一步。

应支持的输入：

- GitHub repo URL
- GitHub issue URL
- GitHub PR URL
- 本地仓库路径
- 仅有仓库名时的搜索结果

导入后应生成：

- repo 摘要：语言、包管理器、测试命令、贡献指南位置
- issue 摘要：目标、复现步骤、预期行为、验收标准
- 难度判断：文档改动、测试补充、小 bug、跨模块变更、架构变更
- 相关文件候选：README、CONTRIBUTING、package 配置、可能涉及的源码
- 风险判断：需要外部服务、需要凭证、需要数据库、需要 UI 验证、测试成本较高

实现上可以先复用现有 GitHub API 调用风格，但不要把 `github-release-service` 扩成大杂烩。建议新增独立的 `contribution-issue-importer.ts`，避免 release 更新能力和贡献导入能力混在一起。

### P0：贡献工作台

贡献工作台应是新的主视图或 Pipeline / Agent 之上的任务视图。它不是文件浏览器，也不是普通聊天记录，而是“一次贡献”的状态面板。

建议核心区块：

| 区块 | 展示内容 | 用户要能做什么 |
| --- | --- | --- |
| 任务概要 | issue 标题、链接、目标、验收标准 | 重新生成摘要、标记理解完成 |
| 仓库状态 | local path、branch、remote、dirty state | 创建分支、刷新状态、查看风险 |
| 阶段进度 | 理解、计划、修改、验证、PR、review | 进入下一步、回退、重跑 |
| 改动文件 | added / modified / deleted 文件 | 查看 diff、加入 PR 摘要 |
| 验证证据 | 测试命令、结果、失败原因 | 重跑测试、标记未运行原因 |
| PR 准备度 | 标题、正文、关联 issue、checklist | 生成草稿、复制/打开 PR |
| review 待办 | 未解决评论、建议回复 | 生成修复计划、标记 resolved |

验收标准：

- 用户打开一个贡献任务后，不需要翻多个 session 才知道当前做到哪一步。
- 工作台能清楚展示“现在还不能提交 PR 的原因”。
- 工作台能把 Pipeline records、Agent 会话、Git 状态和测试结果汇总到同一个任务下。

### P1：任务模板化

自由文本适合专家，不适合零经验用户。建议把贡献任务模板化。

第一批模板：

- 修 bug
- 复现 issue
- 加测试
- 改文档
- 小型重构
- 回复 review

每个模板应定义：

- 必填输入：issue、目标文件、复现方式、期望行为
- 默认 Pipeline 策略：是否必须先 explorer / planner，是否必须 reviewer gate
- 默认验证策略：需要 unit test、typecheck、build、截图还是手工说明
- 默认 PR 结构：标题格式、body 小节、验证说明
- 风险提醒：是否可能触碰 public API、配置文件、迁移、依赖变更

这样用户不是写“帮我修一下”，而是在平台内选择一种有结构的贡献类型。

### P1：Diff / Test / PR 三联面板

这是交付闭环必须有的 UI。

三联面板建议固定展示：

| 面板 | 目的 | 关键能力 |
| --- | --- | --- |
| Diff | 让用户理解 AI 改了什么 | 文件列表、行级 diff、变更摘要、风险标记 |
| Test | 让用户知道是否能交付 | 测试命令、结果、失败日志、未运行原因 |
| PR | 让用户完成外部协作 | PR 标题、正文、关联 issue、验证证据、风险声明 |

PR 草稿建议包含：

- Summary
- Changes
- Tests
- Risks
- Related issue
- Screenshots / logs if applicable

验收标准：

- 用户能从同一屏幕看到“改了什么、验证了什么、准备怎么提交”。
- PR body 自动引用实际测试结果，而不是只写笼统描述。
- 如果测试失败，PR 面板应提示“当前不建议提交”并说明阻塞点。

### P1：权限解释升级

保留现有权限机制，但把权限请求变成新手能理解的决策。

每次权限请求应展示：

- 命令或工具名称
- 目的：为什么现在需要执行
- 类型：只读 / 写文件 / 安装依赖 / Git 状态变更 / 远端操作
- 影响范围：可能读取或修改哪些路径
- 风险等级：低 / 中 / 高
- 可回退方式：例如 `git diff` 查看、`git restore` 回退
- 推荐动作：允许一次、拒绝、改为 dry-run、切到计划模式

当前 `SAFE_BASH_PATTERNS` 已经能区分 `git status / git diff / git log` 这类只读命令，这是很好的基础。下一步应该把“安全判定”转成用户可读解释，而不是只做内部允许或询问。

### P1：review 回路

AI 辅助开源贡献不是“写完就完了”。真实贡献通常会经历 maintainer review。

建议支持：

- 导入 PR review comments
- 按文件、行号、主题归类评论
- 判断 comment 是必须修改、建议优化、问题澄清还是已解决
- 生成修复计划
- 将修复任务重新送入 Pipeline 或 Agent
- 生成 maintainer 回复草稿
- 记录多轮 review 历史

这可以复用当前 Pipeline 的 `reviewer` 概念，但要注意两者语义不同：

- Pipeline reviewer 是内部自审。
- Maintainer review 是外部协作反馈。

产品上应把两者区分清楚，否则用户会误以为内部 reviewer 通过就等于 PR 可合并。

### P2：社区层能力

社区层能力不是第一阶段必须，但它决定平台能否真正服务“开源贡献”。

建议逐步支持：

- good first issue 推荐
- help wanted / documentation / test-needed 等标签识别
- repo 难度分级
- 贡献许可、CLA、DCO、签名提交提示
- stale issue、已被认领 issue、重复 issue 提醒
- issue / PR 状态同步
- release note 与 changelog 关联

推荐评分维度：

- issue 是否有明确复现步骤
- 是否有 maintainer 回复
- 涉及文件数量是否可控
- 是否需要外部服务或私有凭证
- 是否已有失败测试或最小复现
- 是否适合文档、测试、样例这类低风险贡献

### P2：学习层能力

新手完成一次贡献后，平台应把经验沉淀下来。

建议支持：

- 个人贡献履历
- 常用修复模式
- 常见失败原因
- 已学会的项目命令
- 可复用任务模板
- review feedback 处理记录
- 下一次推荐任务

这里可以复用现有 memory 思路，但不要只做“聊天记忆”。Contribution memory 应围绕任务结果、项目规则、用户能力变化和贡献模式组织。

## MVP 纵切方案

前面的 P0 / P1 / P2 是完整产品方向，但第一版不应该一次做全。最合理的 MVP 是做一条足够短、但真实可用的纵切闭环：

> 手动创建贡献任务 -> 绑定本地仓库 -> 生成任务简报 -> 启动 Pipeline -> 汇总 diff / test / PR 草稿

这个 MVP 的关键价值是先把 Contribution 领域层立住，并验证它能把现有 Agent / Pipeline / Workspace 串起来。

### MVP 明确不做什么

第一版建议先不做这些能力：

- 不做 GitHub OAuth。
- 不做自动 push。
- 不做自动创建 PR。
- 不做复杂 issue 推荐。
- 不做 maintainer review comment 导入。
- 不做跨平台 Git GUI 的完整替代。
- 不做社区排行榜、贡献成就或社交能力。

这些能力后续重要，但它们不是“第一次贡献闭环”的最短路径。

### MVP 用户流程

第一版用户流程建议固定为 8 步：

1. 用户点击“新建贡献任务”。
2. 输入 repo URL、issue URL 和本地仓库路径，或者只选择本地仓库后手动填写任务标题。
3. 系统读取 Git 仓库状态，检查是否为 repo、当前分支、远端地址和是否有未提交改动。
4. 系统读取 README、CONTRIBUTING、package scripts，生成任务简报。
5. 用户确认任务简报，选择是否创建新分支。
6. 系统创建 `ContributionTask`，并关联一个 Pipeline session。
7. 用户从贡献工作台启动 Pipeline，执行理解、计划、修改、验证。
8. 系统汇总 changed files、测试证据和 PR 草稿，标记是否达到 `pr_ready`。

这条流程里，用户仍然可以在外部 GitHub 手动打开 PR。MVP 的目标不是替代 GitHub，而是把 PR 前的准备工作产品化。

### MVP 系统流程

系统内部流程建议如下：

```text
ContributionWizard
  -> contribution:create-task
  -> contribution:get-git-state
  -> contribution:generate-task-brief
  -> pipeline:create-session / startPipeline
  -> Pipeline records append
  -> contribution:collect-artifacts
  -> contribution:generate-pr-draft
  -> ContributionWorkbench refresh
```

其中 `Pipeline` 仍负责执行，`Contribution` 只负责组织上下文和沉淀结果。不要让 Contribution service 直接变成另一个 Agent runner。

### MVP 页面结构

第一版 UI 可以很克制，避免一次设计过重。

建议三个页面或视图：

| 视图 | 作用 | 必须能力 |
| --- | --- | --- |
| 贡献任务列表 | 找到当前进行中的贡献任务 | 创建任务、按状态过滤、恢复任务 |
| 贡献向导 | 把 repo / issue / local path 变成任务 | 输入 URL、选择本地目录、运行 Git preflight、生成简报 |
| 贡献工作台 | 展示一次贡献的当前状态 | 任务简报、Git 状态、Pipeline 入口、diff 摘要、test 证据、PR 草稿 |

第一版不需要复杂拖拽布局，也不需要替代现有 Pipeline records。贡献工作台可以用链接或内嵌摘要方式引用 Pipeline session。

### MVP 成功标准

MVP 至少要满足这些验收标准：

- 用户可以创建一个 `ContributionTask`，并在重启后恢复。
- 任务能关联本地仓库、issue URL、分支名、Pipeline session。
- 如果本地目录不是 Git 仓库，系统能阻止继续并说明原因。
- 如果本地有未提交改动，系统能提示风险，并允许用户选择继续或返回处理。
- Pipeline 执行完成后，工作台能展示 changed files、测试命令和 PR 草稿。
- PR 草稿必须区分“已运行测试”和“未运行测试”，不能把未验证内容写成已验证。

### MVP BDD 场景

建议用这些行为场景约束第一版：

```gherkin
Feature: 新手创建贡献任务

  Scenario: 从本地 Git 仓库创建任务
    Given 用户选择了一个包含 .git 的本地目录
    And 用户填写了 issue URL
    When 用户点击创建贡献任务
    Then 系统应保存 ContributionTask
    And 工作台应显示当前分支、远端地址和任务简报

  Scenario: 非 Git 目录不能直接进入贡献流程
    Given 用户选择了一个不包含 Git 仓库的目录
    When 用户点击创建贡献任务
    Then 系统应显示“当前目录不是 Git 仓库”
    And 不应创建 Pipeline session

  Scenario: 测试失败时不能标记为 PR Ready
    Given 贡献任务已经有代码改动
    And 最近一次测试结果为 failed
    When 系统生成 PR 草稿
    Then PR 准备状态应为 blocked
    And PR 草稿应包含失败测试和阻塞原因
```

## ContributionTask 状态机

贡献任务需要明确状态机，否则 UI、Pipeline、Agent 和 Git 状态会互相打架。建议第一版使用较少但语义明确的状态。

### 状态定义

| 状态 | 含义 | 用户看到的提示 | 允许动作 |
| --- | --- | --- | --- |
| `draft` | 任务刚创建，信息不完整 | 需要补充仓库、issue 或本地路径 | 编辑任务、运行 preflight、删除 |
| `ready` | 任务信息完整，可开始执行 | 可以开始计划或启动 Pipeline | 创建分支、生成简报、启动 Pipeline |
| `planning` | 正在理解任务和生成计划 | AI 正在分析 issue、代码和风险 | 查看输出、停止、等待 gate |
| `implementing` | 正在修改代码 | AI 正在进行代码或文档变更 | 查看 diff、停止、请求人工确认 |
| `verifying` | 正在运行或整理验证 | 正在跑测试或收集证据 | 查看日志、重跑测试、标记未运行原因 |
| `pr_ready` | 已具备 PR 草稿和验证说明 | 可以去 GitHub 创建 PR | 查看 PR 草稿、复制内容、打开 issue |
| `review_waiting` | PR 已提交，等待外部 review | 等待 maintainer 回复 | 记录 PR 链接、刷新状态、导入评论 |
| `revising` | 正在处理 review feedback | 正在根据 review 修改 | 生成修复计划、启动修复 Pipeline |
| `blocked` | 当前任务被阻塞 | 需要用户处理阻塞原因 | 查看阻塞、编辑任务、重试 |
| `completed` | 贡献已完成或被合并 | 本次贡献结束 | 查看复盘、创建学习记录 |
| `abandoned` | 用户放弃该任务 | 任务已归档 | 恢复、删除 |

### 状态流转

建议第一版允许这些主路径：

```text
draft
  -> ready
  -> planning
  -> implementing
  -> verifying
  -> pr_ready
  -> review_waiting
  -> revising
  -> verifying
  -> pr_ready
  -> completed
```

异常路径：

```text
draft / ready / planning / implementing / verifying -> blocked
blocked -> ready / planning / implementing / verifying
draft / ready / blocked -> abandoned
pr_ready / review_waiting -> completed
```

### 状态触发来源

| 触发来源 | 示例 | 状态影响 |
| --- | --- | --- |
| 用户操作 | 创建任务、确认简报、标记 PR 已创建 | `draft -> ready`、`pr_ready -> review_waiting` |
| Git 检测 | 非 Git 仓库、脏工作区、分支创建成功 | 进入 `blocked` 或更新 branch state |
| Pipeline 事件 | explorer 完成、developer 完成、tester 完成 | 推进到 `planning / implementing / verifying` |
| 测试证据 | 测试通过、测试失败、测试未运行 | 决定是否允许 `pr_ready` |
| Review 导入 | 有未解决评论 | `review_waiting -> revising` |

### 关键不变量

为了避免 AI 辅助贡献变成不可控的 Git 状态，建议定义这些不变量：

- `ready` 之前必须有 `projectId` 和 `localPath`。
- `planning` 之前必须通过 Git preflight。
- `implementing` 之前如果工作区有未提交改动，必须由用户确认。
- `pr_ready` 必须有 `prDraft`，并且至少有一条 `testEvidence` 或明确的 `testSkippedReason`。
- `completed` 必须由用户手动确认，不能由 AI 自动标记。
- `review_waiting` 必须有 `prUrl` 或用户手动标记为“外部已提交”。
- 任何远端写操作，例如 `git push` 或创建 PR，都必须由用户显式确认。

### 与 Pipeline 节点的映射

当前 Pipeline 节点可以这样映射到 Contribution 状态：

| Pipeline 节点 | Contribution 状态 | 写入的贡献产物 |
| --- | --- | --- |
| `explorer` | `planning` | 任务理解、相关文件、风险点 |
| `planner` | `planning` | 实施步骤、验证计划 |
| `developer` | `implementing` | 变更摘要、changed files、潜在风险 |
| `reviewer` | `implementing` 或 `blocked` | 内部审查结论、需返工问题 |
| `tester` | `verifying` | 测试命令、测试结果、阻塞原因 |

这个映射很重要：Contribution 不需要重写 Pipeline，只需要订阅或读取 Pipeline records，把节点产物归档到任务对象里。

## 数据契约草案

下面是第一版可以采用的数据契约草案。它的目标不是一次定死所有字段，而是给实现提供足够稳定的边界。

### TypeScript 类型草案

建议放在 `packages/shared/src/types/contribution.ts`。

```ts
export type ContributionProvider = 'github' | 'manual'

export type ContributionTaskType =
  | 'bugfix'
  | 'reproduction'
  | 'test'
  | 'docs'
  | 'refactor'
  | 'review-response'
  | 'manual'

export type ContributionTaskStatus =
  | 'draft'
  | 'ready'
  | 'planning'
  | 'implementing'
  | 'verifying'
  | 'pr_ready'
  | 'review_waiting'
  | 'revising'
  | 'blocked'
  | 'completed'
  | 'abandoned'

export interface ContributionProject {
  id: string
  provider: ContributionProvider
  repoUrl?: string
  owner?: string
  repo?: string
  localPath: string
  defaultBranch?: string
  packageManager?: 'bun' | 'npm' | 'pnpm' | 'yarn' | 'unknown'
  installCommands: string[]
  testCommands: string[]
  buildCommands: string[]
  contributingPath?: string
  readmePath?: string
  createdAt: number
  updatedAt: number
}

export interface ContributionIssue {
  id: string
  provider: ContributionProvider
  projectId: string
  url?: string
  number?: number
  title: string
  labels: string[]
  bodySummary?: string
  acceptanceCriteria: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'unknown'
  importedAt?: number
  updatedAt: number
}

export interface ContributionTask {
  id: string
  projectId: string
  issueId?: string
  type: ContributionTaskType
  status: ContributionTaskStatus
  title: string
  branchName?: string
  baseBranch?: string
  prUrl?: string
  pipelineSessionId?: string
  agentSessionIds: string[]
  blockedReason?: string
  testSkippedReason?: string
  createdAt: number
  updatedAt: number
}

export interface ContributionBranchState {
  taskId: string
  isRepo: boolean
  branch: string | null
  baseBranch?: string
  remoteUrl: string | null
  hasChanges: boolean
  stagedFiles: string[]
  unstagedFiles: string[]
  untrackedFiles: string[]
  ahead?: number
  behind?: number
  updatedAt: number
}

export interface ContributionTestEvidence {
  id: string
  taskId: string
  command: string
  status: 'passed' | 'failed' | 'skipped'
  summary: string
  logRef?: string
  createdAt: number
}

export interface ContributionPrDraft {
  taskId: string
  title: string
  body: string
  relatedIssueUrl?: string
  includesFailingTests: boolean
  updatedAt: number
}

export interface ContributionArtifact {
  taskId: string
  brief?: string
  changedFiles: string[]
  diffSummary?: string
  testEvidence: ContributionTestEvidence[]
  prDraft?: ContributionPrDraft
  updatedAt: number
}
```

### JSON 文件结构

建议索引文件保持轻量：

```json
{
  "version": 1,
  "projects": [
    {
      "id": "project-1",
      "provider": "github",
      "repoUrl": "https://github.com/example/repo",
      "localPath": "/Users/me/dev/repo",
      "defaultBranch": "main",
      "packageManager": "bun",
      "testCommands": ["bun test"],
      "createdAt": 1778515200000,
      "updatedAt": 1778515200000
    }
  ]
}
```

任务索引：

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "task-1",
      "projectId": "project-1",
      "issueId": "issue-123",
      "type": "bugfix",
      "status": "ready",
      "title": "Fix login redirect error",
      "branchName": "fix/issue-123-login-redirect",
      "agentSessionIds": [],
      "createdAt": 1778515200000,
      "updatedAt": 1778515200000
    }
  ]
}
```

### JSONL 事件契约

每个 task 建议有独立事件日志：

- `~/.codeinsights/contribution-tasks/{taskId}.jsonl`

第一版事件类型可以控制在这些：

| 事件 | 触发时机 | 关键字段 |
| --- | --- | --- |
| `task_created` | 创建任务 | `taskId / projectId / title / type` |
| `issue_imported` | 导入 issue 或手动填写 issue 信息 | `issueId / url / title / labels / summary` |
| `git_state_checked` | 刷新 Git 状态 | `branch / hasChanges / stagedFiles / unstagedFiles` |
| `branch_created` | 创建贡献分支 | `branchName / baseBranch` |
| `brief_generated` | 生成任务简报 | `brief / risks / acceptanceCriteria` |
| `pipeline_linked` | 关联 Pipeline session | `pipelineSessionId` |
| `pipeline_stage_recorded` | 归档 Pipeline 阶段产物 | `node / summary / artifactRef` |
| `test_recorded` | 记录测试证据 | `command / status / summary / logRef` |
| `pr_draft_generated` | 生成 PR 草稿 | `title / body / includesFailingTests` |
| `status_changed` | 状态变更 | `from / to / reason` |
| `blocked` | 任务被阻塞 | `reason / source` |
| `review_comment_imported` | 导入 review comment | `sourceUrl / filePath / line / body` |
| `task_completed` | 用户标记完成 | `outcome / prUrl` |

事件示例：

```json
{"type":"status_changed","taskId":"task-1","from":"verifying","to":"pr_ready","reason":"tests passed and PR draft generated","createdAt":1778515200000}
```

```json
{"type":"test_recorded","taskId":"task-1","command":"bun test","status":"failed","summary":"2 tests failed in auth redirect flow","logRef":"contribution-artifacts/task-1/test-bun-test.log","createdAt":1778515200000}
```

### IPC 契约草案

第一版 IPC 不要过多，先支持 MVP 闭环：

| IPC | 输入 | 输出 |
| --- | --- | --- |
| `contribution:list-tasks` | `{ status?: ContributionTaskStatus }` | `ContributionTask[]` |
| `contribution:create-task` | `{ repoUrl?, issueUrl?, localPath, title?, type }` | `{ task, project, issue? }` |
| `contribution:get-task` | `{ taskId }` | `{ task, project, issue?, artifact? }` |
| `contribution:get-git-state` | `{ taskId }` | `ContributionBranchState` |
| `contribution:generate-brief` | `{ taskId }` | `{ brief, risks, acceptanceCriteria }` |
| `contribution:link-pipeline-session` | `{ taskId, pipelineSessionId }` | `ContributionTask` |
| `contribution:collect-artifacts` | `{ taskId }` | `ContributionArtifact` |
| `contribution:generate-pr-draft` | `{ taskId }` | `ContributionPrDraft` |
| `contribution:update-task-status` | `{ taskId, status, reason? }` | `ContributionTask` |

实现时仍要遵循当前 IPC 模式：shared 类型与通道常量、main handler、preload bridge、renderer atoms 四处同步。

### 与 Agent / Pipeline 的关联规则

建议采用引用关系，而不是复制大块会话内容：

- `ContributionTask.pipelineSessionId` 指向一个 Pipeline session。
- `ContributionTask.agentSessionIds` 记录与该任务相关的 Agent 会话。
- Pipeline records 仍保留在 `pipeline-sessions/{sessionId}.jsonl`。
- Contribution 只在自己的 JSONL 中记录阶段摘要和 artifact 引用。
- PR 草稿、测试日志、diff 摘要放入 `contribution-artifacts/{taskId}/`。

这样可以避免多份会话内容互相不同步，也符合当前本地存储设计。

## 推荐的产品分层

最合适的分层不是再加一个聊天模式，而是加一个“贡献域”。

### 现有层

- `Agent`：通用执行器，负责开放式读写、命令执行、工具调用。
- `Pipeline`：结构化执行器，负责分阶段推进、人工审核、checkpoint 和恢复。
- `Workspace`：本地文件与工具上下文，负责 cwd、MCP、Skills、附加目录。

### 新增层

- `Contribution`：开源贡献对象层，负责把仓库、issue、分支、PR、diff、测试证据和 review feedback 串起来。

`Contribution` 不应该替代 Agent 或 Pipeline。它应该回答三个问题：

- 做什么：当前贡献任务是什么，目标和验收标准是什么。
- 怎么做：使用 Agent 还是 Pipeline，当前处于哪个阶段。
- 交付什么：最终要提交什么 diff、测试证据和 PR 说明。

### 建议领域对象

| 对象 | 作用 | 关键字段 |
| --- | --- | --- |
| `ContributionProject` | 一个开源仓库的贡献上下文 | `id / repoUrl / localPath / defaultBranch / packageManager / testCommands / contributingPath` |
| `ContributionIssue` | 外部 issue 或 discussion 的本地镜像 | `id / provider / url / number / title / labels / bodySummary / acceptanceCriteria / difficulty` |
| `ContributionTask` | 一次可执行贡献任务 | `id / projectId / issueId / type / status / branchName / pipelineSessionId / agentSessionIds` |
| `ContributionBranchState` | 当前 Git 状态快照 | `branch / remoteUrl / hasChanges / stagedFiles / unstagedFiles / aheadBehind / baseBranch` |
| `ContributionArtifact` | 可交付产物 | `diffSummary / changedFiles / testEvidence / prDraft / screenshots / logs` |
| `ContributionReviewThread` | maintainer review 回路 | `sourceUrl / filePath / line / body / category / status / replyDraft` |
| `ContributionLearningRecord` | 用户成长记录 | `taskType / repo / outcome / failures / reusablePatterns / createdAt` |

## 推荐的实现落点

仍然保持本项目 local-first 风格，不引入本地数据库。

### Shared 类型

建议新增：

- `packages/shared/src/types/contribution.ts`
- `CONTRIBUTION_IPC_CHANNELS`
- `ContributionProject`
- `ContributionIssue`
- `ContributionTask`
- `ContributionArtifact`
- `ContributionReviewThread`

### 主进程服务

建议新增：

- `apps/electron/src/main/lib/contribution-project-manager.ts`
- `apps/electron/src/main/lib/contribution-task-manager.ts`
- `apps/electron/src/main/lib/contribution-issue-importer.ts`
- `apps/electron/src/main/lib/contribution-git-service.ts`
- `apps/electron/src/main/lib/contribution-pr-draft-service.ts`
- `apps/electron/src/main/lib/contribution-review-service.ts`

职责拆分建议：

| 服务 | 职责 |
| --- | --- |
| `contribution-project-manager` | 管理仓库级索引、local path、贡献指南、项目脚本 |
| `contribution-task-manager` | 管理任务生命周期、状态机、关联 Pipeline / Agent 会话 |
| `contribution-issue-importer` | 导入 GitHub issue / PR / discussion，并生成本地摘要 |
| `contribution-git-service` | 扩展 Git 状态、分支创建、diff 摘要、commit 草稿 |
| `contribution-pr-draft-service` | 生成 PR 标题、正文、验证说明、风险声明 |
| `contribution-review-service` | 导入 review comment、归类、生成修复计划和回复草稿 |

### Renderer 状态和组件

建议新增：

- `apps/electron/src/renderer/atoms/contribution-atoms.ts`
- `apps/electron/src/renderer/components/contribution/ContributionWizard.tsx`
- `apps/electron/src/renderer/components/contribution/ContributionWorkbench.tsx`
- `apps/electron/src/renderer/components/contribution/ContributionTaskBrief.tsx`
- `apps/electron/src/renderer/components/contribution/ContributionRepoStatus.tsx`
- `apps/electron/src/renderer/components/contribution/ContributionDiffPanel.tsx`
- `apps/electron/src/renderer/components/contribution/ContributionTestPanel.tsx`
- `apps/electron/src/renderer/components/contribution/ContributionPrPanel.tsx`
- `apps/electron/src/renderer/components/contribution/ContributionReviewInbox.tsx`

状态管理继续用 Jotai。Contribution atoms 不应把所有 Pipeline / Agent 状态复制一份，而应保存引用关系和必要的本地快照。

### 本地存储

建议继续使用 JSON / JSONL：

- `~/.codeinsights/contribution-projects.json`
- `~/.codeinsights/contribution-projects/{projectId}.jsonl`
- `~/.codeinsights/contribution-tasks.json`
- `~/.codeinsights/contribution-tasks/{taskId}.jsonl`
- `~/.codeinsights/contribution-artifacts/{taskId}/`
- `~/.codeinsights/contribution-reviews/{taskId}.jsonl`

推荐写入规则：

- 索引用 JSON，便于列表读取。
- 事件和历史用 JSONL，便于追加、审计和恢复。
- 大型日志、截图、PR 草稿、diff 摘要放 artifact 目录。
- 不把 provider token 或 GitHub credential 写入 contribution 文件。

### IPC 方向

新增 IPC 可以按能力分组：

- `contribution:list-projects`
- `contribution:create-project`
- `contribution:import-issue`
- `contribution:create-task`
- `contribution:get-task`
- `contribution:update-task-status`
- `contribution:get-git-state`
- `contribution:create-branch`
- `contribution:generate-pr-draft`
- `contribution:import-review-comments`

添加 IPC 时仍遵循当前架构：shared 类型与通道常量、main handler、preload bridge、renderer atoms 同步修改。

## 分阶段路线图

### Phase 0：贡献域骨架

目标：先让系统有 contribution 领域对象，但不急着做完整 GitHub 集成。

交付：

- 新增 shared contribution 类型。
- 新增本地 JSON / JSONL manager。
- 让一个 ContributionTask 能关联现有 workspace、Pipeline session 和 Agent session。
- 在 UI 中能看到“贡献任务列表”和“任务详情”。

验收：

- 用户可以手动创建一个贡献任务。
- 任务能保存 repo URL、local path、issue URL、branchName、当前状态。
- 重启应用后任务仍能恢复。

### Phase 1：贡献向导和 issue 导入

目标：让零经验用户能从一个 issue URL 开始。

交付：

- 贡献向导。
- GitHub issue / repo 导入。
- README / CONTRIBUTING / package scripts 摘要。
- Git 基础状态检查。
- 任务简报生成。

验收：

- 粘贴 public issue URL 后能生成任务简报。
- 本地仓库缺失时能提示 clone / open local repo。
- 本地有未提交改动时能提示风险。
- 可以从任务简报启动 Pipeline。

### Phase 2：贡献工作台和交付闭环

目标：让用户能从修改走到 PR 草稿。

交付：

- 贡献工作台。
- Diff / Test / PR 三联面板。
- 测试证据归档。
- PR 标题和正文生成。
- branch / dirty state / changed files 展示。

验收：

- 用户能看到当前 diff、测试结果和 PR 草稿。
- PR 草稿能引用实际测试命令和结果。
- 如果测试失败或工作区不干净，工作台能说明阻塞原因。

### Phase 3：review 和学习闭环

目标：让用户能处理 maintainer feedback，并沉淀经验。

交付：

- PR review comment 导入。
- review inbox。
- comment 分类和修复计划。
- 回复草稿。
- 贡献历史和学习记录。

验收：

- 用户能把一轮 review comment 转成修复任务。
- 多轮 review 后仍能追踪哪些 comment 已解决。
- 完成任务后能生成贡献复盘和下次任务建议。

## 风险与边界

### 不建议先做的事

- 不建议先做大型社区平台或排行榜。当前最缺的是单个用户的第一次贡献闭环。
- 不建议先引入本地数据库。当前项目已经形成 JSON / JSONL 存储哲学，继续沿用更一致。
- 不建议把 Contribution 做成第三个独立聊天模式。它应该是任务对象层，复用 Agent / Pipeline。
- 不建议第一阶段就做复杂 GitHub OAuth。public issue / repo 导入可以先跑通，后续再补认证能力。

### 需要注意的风险

- Git 命令必须清楚区分只读、本地写入和远端写入。
- PR 草稿不能夸大测试结果，未运行的测试必须明确写“未运行”。
- AI 生成的贡献建议必须保留用户审核点，尤其是 commit、push、PR 创建。
- Review feedback 不应和内部 reviewer 自审混淆。
- 对新手解释不能只靠教程，关键状态必须在工作台内可见。

## 最后判断

CodeInsights 的底子已经够强了，缺的不是更多模型，而是“面向零经验用户的贡献路径设计”。

最值得补的是这条链路：

> 找到任务 -> 看懂任务 -> 准备环境 -> 安全修改 -> 验证结果 -> 生成 PR -> 接住 review -> 沉淀经验

这条链路一旦闭合，CodeInsights 才真正配得上“AI 辅助开源贡献平台”这个目标。
