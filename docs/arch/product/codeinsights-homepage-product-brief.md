# CodeInsights 产品主页 Brief

> 面向对象：开源贡献者、AI coding agent 用户、维护者、希望把 AI 引入真实工程流程的团队。
> 主页目标：在首屏内讲清 CodeInsights 不是通用 Agent 内核，而是一站式 AI 开源贡献平台。

## 1. 产品定位

CodeInsights 是一个本地优先的 AI 开源贡献平台。它把成熟 coding agent 的完整运行时接入到桌面应用中，并用人类工程经验设计 Pipeline，让 AI 负责阶段内执行，人类负责方向、质量和最终决策。

一句话定位：

> 让 Claude Agent SDK、Codex 等专业运行时进入一条可审计的开源贡献流水线。

更产品化的表达：

> CodeInsights 不重写通用 Agent 内核。它接入已经成熟的 coding agent 运行时，把它们放进探索、规划、开发、审核、测试和提交材料准备的开源贡献流程中，在已接入运行时范围内优先继承上游能力升级。

## 2. 首页主张

### 核心主张

人类工程经验负责“流程、边界、质量门禁”，AI 负责“执行、搜索、修改、验证”。CodeInsights 的价值不在于把所有能力塞进一个新的通用 Agent，而在于把专业 agent 放到正确的工程流程里。

### 支撑理由

| 主张 | 解释 | 首页表达方式 |
|------|------|--------------|
| 人类工程经验 + AI 极致融合 | 贡献流程由人类工程经验拆解，节点内部交给 AI 执行 | Hero、Pipeline section、gate 交互图 |
| 通用 Agent 内核和 skills 堆叠不稳定 | 自研通用内核容易追不上 agent 运行时变化，skills 也会随模型和工具语义漂移 | Problem section、对比表 |
| 一站式 AI 开源贡献平台 | 从任务发现到最终验证，状态、产物、checkpoint、工作区都在一处管理 | Platform section |
| 不实现通用 Agent 内核 | CodeInsights 是运行时接入层和工程工作流层 | Core Thesis section |
| Agent 模式继承完整运行时 | 当前基于 Claude Agent SDK / Anthropic 兼容渠道，产品方向是逐步接入更多 coding agent 运行时 | Agent Mode section |
| Pipeline 模式沉淀工程经验 | 探索、规划、开发、审核、测试形成五阶段主线，关键阶段有结构化产物和人工 gate | Pipeline Mode section |

## 3. 受众与关键痛点

### 个人开源贡献者

痛点：

- 不知道从哪里找到合适贡献点。
- AI 能写代码，但一次性长任务容易跑偏。
- 需要在 IDE、终端、网页、Issue、PR、测试之间频繁切换。

主页对应承诺：

- CodeInsights 把贡献流程拆成可见阶段。
- 每个阶段都有产物、审核点和恢复能力。
- Agent 负责执行，人类负责判断。

### 项目维护者

痛点：

- AI 生成的 patch 质量不稳定。
- 缺少 review、验证和返工闭环。
- 难以追踪 AI 为什么做出某个改动。

主页对应承诺：

- Pipeline 记录探索依据、计划、diff、review 和测试结果。
- Reviewer / Tester 节点让质量检查成为流程默认值。
- 本地 JSONL 和 artifacts 让过程可追溯。

### AI coding agent 重度用户

痛点：

- Claude Code、Codex 等 agent 各自强大，但缺少统一工作流外壳。
- 每个工具升级很快，自研 wrapper 容易变成适配负担。
- Skills 和 prompt 模板在不同任务中稳定性有限。

主页对应承诺：

- CodeInsights 直接接入完整运行时，不把能力降级成一层薄 prompt。
- 上游 agent 升级后，已接入运行时范围内尽量优先受益，减少二次封装适配成本。
- Skills 是增强层，不是稳定性的唯一来源。

## 4. 差异化表达

### 不推荐的表达

- “CodeInsights 是最强通用 Agent 内核”
- “用 Skills 解决所有任务”
- “完全自动化开源贡献”
- “替代工程师完成贡献”

### 推荐的表达

- “接入成熟 agent，组织真实工程流程”
- “人类设计工作流，AI 完成节点内工作”
- “把开源贡献变成可审计 Pipeline”
- “不重写 coding agent 的能力，继承它”
- “从任务探索到验证结果的一站式贡献工作台”

## 5. 叙事原则

1. 首页先讲清“为什么不是通用 Agent 内核”，再讲功能。
2. Agent 模式突出“完整运行时接入”，不要只讲聊天或工具调用。
3. Pipeline 模式突出“工程经验结构化”，不要讲成多 agent 炫技。
4. 对 Skills 的表达要克制：它是上下文和能力扩展，不是核心稳定性保证。
5. 所有“自动”相关措辞都要配合“人工 gate / review / test / local artifacts”，避免过度承诺。

## 6. 首屏信息优先级

1. 产品名：CodeInsights
2. 主标题：AI 开源贡献工作台
3. 核心差异：不自研通用内核，按模式接入 Claude Agent SDK、Codex 等专业运行时
4. 关键工作流：探索 -> 规划 -> 开发 -> 审核 -> 测试，验证后汇总提交材料
5. 信任机制：本地优先、人工 gate、阶段产物、可恢复 checkpoint

## 7. 可上线版本声明建议

如果首页要用于公开发布，建议在能力表中区分：

| 能力 | 建议状态文案 |
|------|--------------|
| Pipeline 五阶段贡献流 | 当前主线能力 |
| Claude Agent SDK 接入 | 当前主线能力 |
| Codex Developer / Reviewer 节点 | 当前主线能力 |
| 多 coding agent 运行时自由切换 | 支持接入方向，按版本标注已支持运行时 |
| Skills / MCP 工作区能力 | 当前主线能力 |
| 提交 PR 自动化 | 可作为后续路线图，避免在未完成前写成已实现 |

## 8. 当前事实与目标态边界

首页可以把“接入多种 coding agent 运行时”作为产品方向，但公开落地文案需要按版本标注当前已支持的运行时。当前 README 中稳定事实是：Pipeline 的 Explorer、Planner、Tester 使用 Claude Agent SDK，Developer、Reviewer 使用 Codex SDK / CLI fallback；Agent 兼容供应商限定为 Anthropic 协议兼容集合。不要把目标态写成当前所有 Agent 模式都已经支持任意 Provider。
