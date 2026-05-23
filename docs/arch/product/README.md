# CodeInsights Product Docs

> 状态：设计素材
> 位置：`docs/arch/product/`
> 目标：集中存放 CodeInsights 产品主页的定位、页面结构、文案与视觉资产规范，方便从一个入口查找所有文档。

## 素材清单

| 文件 | 用途 |
|------|------|
| [Product Brief](codeinsights-homepage-product-brief.md) | 产品定位、叙事主线、受众、差异化与首页声明边界 |
| [Homepage Content](codeinsights-homepage-content.md) | 可直接用于产品主页的 section 结构、标题、正文、CTA 与组件文案 |
| [Visual Assets](codeinsights-homepage-visual-assets.md) | 视觉方向、页面构图、色彩、图形素材、Hero 资产 prompt 与交互建议 |
| [Diagrams](codeinsights-homepage-diagrams.md) | Mermaid 图形素材：产品定位、Agent 模式、Pipeline 模式、平台闭环 |

## 推荐阅读顺序

1. [Product Brief](codeinsights-homepage-product-brief.md)：先确认产品定位、事实边界与首页主张。
2. [Homepage Content](codeinsights-homepage-content.md)：再查看可落地的页面分区文案。
3. [Visual Assets](codeinsights-homepage-visual-assets.md)：继续对齐视觉风格、Hero 图和响应式要求。
4. [Diagrams](codeinsights-homepage-diagrams.md)：最后选择可嵌入页面或文档的信息图。

## 首页核心表达

CodeInsights 的首页不应把产品讲成“又一个通用 Agent 框架”。核心叙事应该是：

> CodeInsights 把成熟 coding agent 运行时接入到一条人类工程经验设计的开源贡献流水线中。它不重写通用 Agent 内核，而是在已接入运行时范围内复用 Claude Agent SDK、Codex 等能力，并用 Pipeline 把探索、规划、开发、审核、测试和提交材料汇总变成可审计、可回退、可验证的协作流程。

## 推荐首页骨架

1. Hero：人类工程经验 + AI 的开源贡献工作台
2. Problem：通用 Agent 内核和 skills 堆叠难以长期稳定
3. Core Thesis：不做通用内核，直接接入成熟 coding agent 运行时
4. Agent Mode：当前基于 Claude Agent SDK / Anthropic 兼容渠道，产品方向是逐步接入更多 coding agent 运行时
5. Pipeline Mode：探索 -> 规划 -> 开发 -> 审核 -> 测试，验证后汇总提交材料
6. Platform Layer：本地优先、工作区、MCP、Skills、产物与 checkpoint
7. Open Source CTA：把个人贡献经验沉淀成可复用工作流

## 首页声明边界

- 可以强调“运行时接入层”和“减少二次封装适配成本”的产品方向。
- 不建议把 CodeInsights 宣称为自研通用 Agent 内核。
- 不建议把 Skills 描述成核心稳定性来源。更准确的表达是：Skills 是可选增强，核心执行能力来自被接入的专业 agent 运行时。
- 当前 Pipeline 主线是 Explorer、Planner、Developer、Reviewer、Tester 五个节点；“提交”应表述为提交材料准备或后续动作，不能写成已实现的自动 PR 提交阶段。
- 如果公开版本尚未完整支持多个 coding agent 自由切换，首页实现时应使用“支持接入 / 正在扩展”或在能力表中标注当前状态。
