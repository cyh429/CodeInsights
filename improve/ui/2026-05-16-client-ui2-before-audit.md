# 2026-05-16 UI-2 Before 审计

## 范围

本轮只审计并改造 AppShell / Sidebar / Tab 范围，不进入 Pipeline 主面板 UI-3。运行时边界：

- 可触达：`AppShell.tsx`、`LeftSidebar.tsx`、`PipelineSidebar.tsx`、`MainArea.tsx`、`TabBar.tsx`、`TabBarItem.tsx`、`RightSidePanel.tsx`、Agent 右侧 `SidePanel` 容器样式。
- 不触达：`PipelineView.tsx`、`PipelineHeader.tsx`、`PipelineStageRail.tsx`、`PipelineRecords.tsx`、`PipelineComposer.tsx`、`PipelineGateCard.tsx`。
- 不新增 public API / IPC / shared type，不修改 README / AGENTS。

## Before 发现

| 区域 | 当前状态 | 影响 | UI-2 处理 |
| --- | --- | --- | --- |
| AppShell 外层 | `shell-bg` 叠加 hard-coded zinc gradient；侧栏 / 主区 / 右侧面板都用 `rounded-2xl shadow-xl` | 三栏层级重，特殊主题与 token 不完全一致 | 改为 `surface-app / surface-panel / shadow-panel / rounded-panel` 语言，降低外层饱和度 |
| MainArea | 主内容 `bg-content-area rounded-2xl shadow-xl`，TabBar 和内容区连接感依赖旧 class | active tab 与 content 连接弱，非 active tab 降权不足 | MainArea 改为同级 shell panel，TabBar 加底部分隔，active tab 与 panel 面连贯 |
| LeftSidebar | Chat / Agent session item 选中、hover、running 仍使用 `primary/emerald/blue/orange/green` 局部色；hover-only 操作按钮无 `aria-label` | 状态表达和键盘 / 读屏语义不稳定 | 统一 session item 高度、focus、状态左侧细线；补 hover 操作按钮 `aria-label` |
| PipelineSidebar | Pipeline session item 已有 running / waiting / failed 摘要，但状态色与 Agent / Tab 不是同一 token；折叠 / 搜索 / 设置 icon button 无 `aria-label` | 后台运行、blocked、failed 可见但跨组件不一致 | 迁移到 `status-*` token，并补 icon-only `aria-label` / focus-visible |
| ModeSwitcher | 默认滑块使用 `bg-background`，特殊主题使用裸色 override | 默认选中态不像主模式状态，主题规则分散 | 默认使用 primary token，特殊主题后续仍由主题覆盖 |
| TabBar / TabBarItem | indicator 只有 idle / running / blocked / completed，关闭控件是 `span role=button`，无可访问名称；运行和阻塞 tooltip 不明确 | close button 语义弱，blocked 状态缺少解释 | 使用真实 button + `aria-label`，为 running / blocked / completed 提供 token 细线和 tooltip/title |
| RightSidePanel | Agent `SidePanel` 自身使用 `bg-content-area rounded-2xl shadow-xl`，和 MainArea 同样重 | 右侧面板像另一个大卡片，不像同级工作台面板 | 改为同级 `surface-panel`，收窄时保持不挤压主内容 |

## 验收关注

- 当前模式、当前 session、当前 tab 三个上下文在 light / dark / forest 中可识别。
- 后台 running / blocked / completed 状态不整块染色，只使用细线 / 点 / badge。
- Sidebar 与 Tab 的 focus-visible 清楚可见。
- icon-only 操作拥有 tooltip 和可访问名称。
- 不产生新的水平滚动或主内容大幅跳动。
