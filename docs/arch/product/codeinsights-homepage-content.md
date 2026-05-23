# CodeInsights 产品主页文案

> 用途：给产品主页实现直接使用。文案默认中文，可后续抽取为 i18n key。

## 1. Hero

### Eyebrow

本地优先的 AI 开源贡献平台

### H1

把成熟 coding agent 接进真实开源贡献流程

### 副标题

CodeInsights 不重写一个通用 Agent 内核。它按模式接入 Claude Agent SDK、Codex 等完整运行时，并用人类工程经验设计 Pipeline，把探索、规划、开发、审核、测试和提交材料准备变成可审计的 AI 协作流程。

### CTA

- 主按钮：开始一次贡献
- 次按钮：查看工作流

### 首屏信任点

- 复用完整 agent 运行时
- Pipeline 人工 gate
- 本地 JSON / JSONL 持久化
- 阶段产物和 checkpoint

### Hero 视觉文案

```text
User Goal
  -> Explorer
  -> Planner
  -> Developer
  -> Reviewer
  -> Tester
  -> Contribution Ready
```

## 2. Problem

### 标题

通用 Agent 很强，但真实工程不只是一条 prompt

### 正文

AI 已经能读代码、改文件、跑测试，但开源贡献的难点从来不只是“让模型动手”。真正困难的是：找到合适贡献点，拆解可执行方案，控制返工成本，审查质量，证明 patch 真的可用。

自研通用 Agent 内核和不断堆叠的 skills 很容易变成新的不稳定层。模型、工具协议、CLI 运行时和上下文语义都在快速变化，薄封装往往追不上底层 agent 的能力升级。

### 三个问题卡片

| 标题 | 文案 |
|------|------|
| 内核追不上运行时 | Claude Code、Codex 等 coding agent 的能力持续升级，自研通用内核很容易变成适配负担。 |
| Skills 会漂移 | Skills 能提供上下文和操作约束，但它们依赖模型理解、工具语义和任务边界，不应承担全部稳定性。 |
| 长任务不可审计 | 一次性把复杂贡献交给单 Agent，过程、判断和返工原因容易消失在长输出里。 |

## 3. Core Thesis

### 标题

不要重写 Agent，把它放进正确的工程系统

### 正文

CodeInsights 的核心不是创造一个新的通用 Agent 内核，而是把专业 coding agent 的完整运行时接入到桌面工作台。它保留底层 agent 的全部能力，同时提供工作区、权限、阶段产物、人工 gate、checkpoint 和贡献流程编排。

### 对比表

| 方案 | 结果 |
|------|------|
| 自研通用 Agent 内核 | 需要持续追逐每个模型、工具和 CLI 的变化 |
| 只堆 Skills | 对复杂工程流程的稳定性帮助有限 |
| CodeInsights 运行时接入层 | 复用专业 agent 能力，用工程流程约束任务质量 |

### 强调句

底层 agent 每升级一次，CodeInsights 都应在已接入运行时范围内优先继承能力，减少二次封装带来的适配成本。

## 4. Agent Mode

### 标题

Agent 模式：从完整运行时开始，而不是弱化封装

### 正文

Agent 模式当前基于 Claude Agent SDK 和 Anthropic 兼容渠道提供完整运行时能力。CodeInsights 调用的是 agent 运行时，而不是把它们压缩成普通聊天接口。文件操作、终端执行、工具链、权限确认、上下文管理和上游升级能力，都应尽量由原生运行时提供。Codex 当前用于 Pipeline 的 Developer / Reviewer，更多 coding agent 运行时选择应作为产品方向按版本标注。

### 功能点

| 功能 | 文案 |
|------|------|
| 完整运行时 | 保留 coding agent 原生能力，而不是二次实现一套弱化版工具系统。 |
| 运行时接入 | 不把 agent 能力重写成弱化工具层，优先调用完整运行时。 |
| 降低适配成本 | 当已接入运行时升级，CodeInsights 应优先继承新能力，减少重复适配。 |
| 工作区隔离 | 每个工作区拥有自己的 cwd、MCP、Skills 和文件上下文。 |
| 权限可控 | 重要操作通过权限策略和用户确认进入可控路径。 |

### 组件文案

- 当前 Agent 渠道：Claude Agent SDK / Anthropic 兼容渠道
- Pipeline Codex 节点：Developer / Reviewer 使用 Codex SDK 或 CLI fallback
- 选择工作区：将 agent 限定在当前项目上下文
- 权限模式：安全、询问、允许全部
- 状态提示：运行时能力来自所选 coding agent，CodeInsights 负责工作区、权限和记录
- 路线图标注：Codex / Custom Agent Runtime 等 Agent 模式选择项在接入前显示为即将支持或路线图

## 5. Pipeline Mode

### 标题

Pipeline 模式：人类设计流程，AI 完成节点

### 正文

Pipeline 模式把一次开源贡献拆成可审计阶段：探索、规划、开发、审核和测试，并在验证后汇总提交材料。每个节点内部由 AI 完成工作，每个关键阶段由人类确认方向。它不是让 AI 一次性跑完所有事情，而是把工程师的判断放在成本投入之前。

### 阶段文案

| 阶段 | 主页短文案 | 产物 |
|------|------------|------|
| Explorer | 读取目标和代码上下文，找到真正值得做的贡献点 | 发现报告、关键文件、下一步 |
| Planner | 把贡献点转成可执行计划，列出风险和验证路径 | 开发计划、风险、测试策略 |
| Developer | 由 coding agent 修改代码、补测试、生成变更说明 | diff、变更摘要、测试记录 |
| Reviewer | 只读审查结果，聚焦正确性、回归风险和测试缺口 | review 结论、问题列表 |
| Tester | 执行最终验证，证明结果能工作 | 命令、结果、阻塞项 |

### 完成后的 Outcome

Tester gate 通过后，页面可以展示提交材料汇总区，用于整理 patch、PR notes 和阶段 artifacts。它是五阶段 Pipeline 完成后的结果视图，不应画成第六个自动执行节点。

### 核心机制

- 人工 gate：每个关键阶段都能继续、重跑或带反馈返工。
- 结构化产物：阶段输出不是临时聊天内容，而是可保存、可复盘的贡献材料。
- Developer / Reviewer 循环：开发和审查形成返工闭环，而不是一次性完成。
- checkpoint 恢复：长任务中断后可以恢复待审批状态。

## 6. Platform Layer

### 标题

一站式贡献工作台，而不是一次性聊天窗口

### 正文

CodeInsights 把 agent 执行、工作区配置、MCP、Skills、权限、远程 Bridge、会话记录和 Pipeline 产物放在同一个桌面应用里。贡献过程默认保存在本地，便于回放、审查和迁移。

### 能力矩阵

| 能力 | 价值 |
|------|------|
| 本地优先存储 | 配置、消息、checkpoint 和 artifacts 默认保存在本机文件系统 |
| 多工作区 | 不同项目使用独立 cwd、MCP、Skills 和工作区文件 |
| MCP / Skills | 作为上下文和能力扩展层，服务具体任务场景 |
| Pipeline artifacts | 阶段报告、JSON 结果和 manifest 可落盘 |
| 远程 Bridge | 通过飞书、钉钉、微信等入口触发本地 agent 工作 |
| 多标签工作台 | Pipeline、Agent 和隐藏回退 Chat 可以在统一界面中切换 |

## 7. Trust

### 标题

让 AI 做更多事，但让工程师保留控制权

### 正文

CodeInsights 的设计重点不是制造“全自动”的错觉，而是把 AI 的执行力放进清晰边界里。每个阶段都能留下记录，每个关键决策都能人工确认，每次失败都能回到可理解的状态。

### 信任点

- 权限请求按会话隔离，不因页面切换丢失。
- Pipeline gate 是一等状态，不混在普通聊天消息中。
- JSONL 记录和阶段产物让过程可以审查。
- 本地优先设计减少对云端状态的依赖。
- 运行时接入策略减少自研内核漂移风险。

## 8. Open Source CTA

### 标题

把一次贡献，变成下一次也能复用的工程流程

### 正文

CodeInsights 面向真实开源协作：从读懂项目，到形成计划，到准备可验证 patch 材料。它让个人经验不再只停留在脑子里，而是沉淀成可复盘、可改进、可复用的 AI 工作流。

### CTA

- 主按钮：从源码运行
- 次按钮：阅读架构文档

### 页尾短句

CodeInsights: Human engineering judgment, AI execution power.
