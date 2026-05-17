# 下次启动 Codex 继续开发提示词

下次启动 Codex 后，可以直接发送下面这段提示词。

```text
请继续 RV-Insights 的 Agent 模式重构工作。

重要上下文：
- 项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
- 参考方案目录：docs/agent-refactor/
- 当前方案阶段已完成并提交：158d8a64 docs: 完成 Agent 模式重构方案阶段文档
- 最新进度跟踪文件：docs/agent-refactor/development-checklist.md
- 当前代码实现尚未开始，下一步应从“阶段 0：冻结基线”开始。

必须遵守：
- 客户端 UI 零可见变化，不改布局、样式、文案、入口、按钮行为或交互路径。
- 不引入本地数据库，不默认 Docker，不照搬 SaaS/IM-first 模型。
- 不默认 bypass 权限，外部渠道默认保守权限策略。
- 每阶段只改变一个主边界，阶段完成并通过验证后立即单独提交。
- 提交只包含该阶段相关文件，不纳入 .DS_Store、improve/ 临时文件或其他无关改动。
- 开始前先阅读 tasks/lessons.md、docs/agent-refactor/README.md、docs/agent-refactor/development-checklist.md。

本次请执行阶段 0：
1. 创建 docs/agent-refactor/baseline-runs/ 文本证据目录。
2. 按 docs/agent-refactor/baseline-checklist.md 跑首轮行为基线。
3. 记录每个基线的输入、预期 UI、预期存储、预期终态。
4. 不修改业务代码。
5. 运行必要验证和 git diff --check。
6. 更新 docs/agent-refactor/development-checklist.md 的阶段 0 状态。
7. 阶段完成后用详细中文 commit message 单独提交。
```
