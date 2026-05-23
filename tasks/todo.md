# CodeInsights Agent 重构任务

## 2026-05-23 README 参考页样式对齐计划

- [x] 对照 ScienceClaw 的 README_zh 结构，确认需要重排的首屏元素：标题、语言切换、简介、徽章、视频播放器和锚点导航。
- [x] 重写 README 顶部展示区，改为居中品牌标题 + 语言切换 + 一句话定位 + 彩色徽章 + 原生视频播放器。
- [x] 补一块简洁的“产品优势”卡片区，参考外部 README 的三栏式信息密度。
- [x] 清理或收敛原来的目录/展示重复块，让 README 更像展示型项目首页。
- [x] 运行 Markdown、链接和 diff 验证，在本节末尾追加 Review。
- [x] 按用户澄清，将 README 的视频播放器改为 GitHub 绝对视频地址，确保访问者在 README 内直接点击播放。

## 2026-05-23 README 首屏视频与旧名清理计划

- [x] 复查 README 首屏、项目展示、FAQ、本地配置说明、素材目录和当前视频/图片素材引用，确认仍有旧名说明与顶部图标位置问题。
- [x] 将 README 标题下的图标替换为 20 秒视频预览，并移除重复的项目展示区块。
- [x] 清理 README 中所有历史项目名、旧目录实名说明和“为什么写旧名”的 FAQ。
- [x] 重新渲染视频和关键帧快照，确保 README 首屏预览使用更新后的 CodeInsights 素材。
- [x] 验证 README 链接、旧名扫描、图片/视频预览和 git diff；在本节末尾追加 Review。

## 2026-05-23 CodeInsights 项目图标外缘修正计划

- [x] 明确反馈范围：保留当前中间深色圆角方形 CI 图标主体，去掉外侧浅色背景圈/留白，不重新设计主体图形。
- [x] 调整 `apps/electron/resources/generate-icons.sh`：在生成主图标前清理与画布边缘连通的浅色背景，并保留透明 alpha。
- [x] 重新生成 Electron、renderer、web、video 和 tray 相关图标资源，确保所有派生图标来自同一透明主图标。
- [x] 验证主图标和派生图标尺寸、透明外缘、SVG XML、typecheck/build 和 `git diff --check`。
- [x] 在本节末尾追加 Review，记录修正结果和残留风险。

## 2026-05-23 CodeInsights 项目图标外缘修正 Review

- 已按反馈保留当前 CI 主体，去掉主图标外侧浅色背景圈/留白；`apps/electron/resources/icon.png` 现在为 RGBA，四角和画布边缘 alpha 均为 0。
- 已修改 `apps/electron/resources/generate-icons.sh`：先清理画布边缘连通的浅色背景，再用透明主图标生成 `.png`、`.ico`、`.icns`、renderer、web 和 video 资源；相同 PNG 改为保存一次后复制字节，生成耗时从接近 3 分钟降到约 23 秒。
- 已按审查反馈补强生成脚本：使用 `CODEINSIGHTS_ICON_SOURCE` 刷新主图标时，如果缺少 `iconutil` 会直接失败，避免 `icon.png` 已更新但 macOS `.icns` 仍是旧图标。
- 已重新生成 Electron resources、renderer `codeinsights-logos`、renderer model icon、`web/assets/brand/logo.webp` 和 video cutout 图标；tray template 仍保持单色 CI 模板图标。
- 透明度验证通过：`apps/electron/resources/icon.png`、`codeinsights-transparent.png`、renderer model、web logo、video cutout、build 后 `dist/resources/icon.png` 均为 1024x1024 且边缘透明；`icon.ico` 顶层 256x256 四角 alpha 为 0。
- 构建验证通过：`xmllint --noout apps/electron/resources/icon.svg apps/electron/resources/codeinsights-logos/icon.svg`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build`；`git diff --check`。
- 代码审查通过：复查确认脚本不会把透明主图标重新扁平化成白底；`CODEINSIGHTS_ICON_SOURCE` + 缺少 `iconutil` 的保护会在写文件前失败；`.ico` / `.icns` / PNG / WebP 均保留透明角。
- 残留说明：工作树中已有 `.DS_Store`、`docs/.DS_Store`、`assets/`、`improve/` 等无关噪音，本轮未处理。

## 2026-05-22 Agent 右侧资源边栏布局优化计划

- [x] 启动前复习 `tasks/lessons.md`，确认本轮应优先做结构减法，避免给右侧边栏继续堆叠装饰和重复信息。
- [x] 定位 Agent 右侧边栏实现：`SidePanel.tsx` 负责 Resource Bay、会话文件、工作区文件；`FileDropZone.tsx` 负责拖拽上传空态；`globals.css` 负责 cockpit / vault 视觉。
- [x] 调整布局：保留会话文件和工作区文件能力，但减少重复空态、压缩标题栏和投放区，让两个资源区更像统一的简洁面板。
- [x] 调整样式：降低边框、扫描线、虚线框和内阴影权重，保留深色科技主题但提升留白和层级清晰度。
- [x] 验证：运行类型检查/聚焦构建，必要时启动本地界面核验右侧边栏首屏观感和无明显溢出。
- [x] Review：在本节末尾记录改动范围、验证结果和残留风险。

## 2026-05-22 Agent 右侧资源边栏布局优化 Review

- 已将右侧 `Resource Bay` 改为更薄的中文资源面板工具栏，刷新和关闭动作收拢到顶部，减少原先顶部英文 HUD 与分区标题重复。
- 已将会话文件、工作区文件改为统一的 `agent-resource-card` 结构：轻量标题、路径摘要、单个打开目录动作；移除两个区块之间的厚分隔线和多层嵌套边框。
- 已为 `FileDropZone` 增加 `compact` 模式，右侧边栏内上传区改为单行轻量投放入口，保留选择文件和附加文件夹能力；完整模式保持原有外部调用兼容。
- 已按审查反馈恢复空目录提示的条件显示：无附加目录时仍显示“此文件夹为空”，有附加目录时隐藏重复空态；同时补充纯图标按钮 `aria-label` / `title`，会话和工作区路径摘要兼容 Windows 分隔符。
- 验证通过：`cd apps/electron && bun run typecheck`；`cd apps/electron && bun run build:renderer`；仓库根目录 `bun run typecheck`；`git diff --check`。
- 已尝试用本地浏览器打开 `http://localhost:5173/` 做视觉核验，但浏览器环境缺少 Electron preload 的 `window.electronAPI`，初始化组件报错，不能作为桌面壳视觉证据；当前 Electron dev 进程未开放远程调试端口，因此本轮未产出真实桌面截图。
- 工作树中已有 `.DS_Store`、`assets/`、`improve/` 以及更早的图标任务记录未跟随本轮改动处理；本轮代码改动仅限 Agent 右侧资源边栏相关文件。

## 2026-05-22 CodeInsights 项目图标第四组计划

- [x] 复盘前三组候选：继续减少内部信息量，把方向收敛到更像正式 App icon 的强品牌符号。
- [x] 新增第四组 `codeinsights-refined-*` SVG：更粗主形、更少节点、更少渐变，优先保证 64px / 128px 识别。
- [x] 导出每个候选的 1024x1024 PNG，并生成第四组总览图。
- [x] 更新 `assets/icon/README.md`，说明 refined 组的定位与推荐候选。
- [x] 验证 SVG XML、PNG 尺寸、总览图渲染与 `git diff --check`，在本节末尾追加 Review。

## 2026-05-22 CodeInsights 项目图标第四组 Review

- 已新增第四组 6 套 refined 候选：`codeinsights-refined-core`、`codeinsights-refined-scope`、`codeinsights-refined-bracket`、`codeinsights-refined-signal`、`codeinsights-refined-slab`、`codeinsights-refined-terminal`。
- 每套候选都包含 SVG 源文件和 1024x1024 PNG 预览；第四组总览图为 `assets/icon/codeinsights-refined-candidates.png`。
- 本轮优化重点：相比第三组进一步减少内部细节，强化粗主形和小尺寸识别，避免复杂功能说明图；语义只保留 C/I、洞察镜头、代码括号、Agent 信号、终端入口等少量核心符号。
- 推荐优先继续打磨：`refined-core` 作为正式默认 App icon 方向，`refined-bracket` 作为开发者工具属性方向，`refined-terminal` 作为 Agent 执行入口方向。
- 本轮未替换 Electron 当前生效的 `apps/electron/resources/icon.*`，只新增候选资产。
- 验证通过：`xmllint --noout assets/icon/codeinsights-refined-*.svg`；`sips` 尺寸检查确认 6 个候选 PNG 均为 1024x1024、总览 PNG 为 1800x1200；已人工查看总览图和临时 128px / 64px 缩略图，主轮廓可识别；`git diff --check` 无空白错误。

## 2026-05-22 CodeInsights 项目图标第三组计划

- [x] 启动前复习 `tasks/lessons.md` 与现有 `assets/icon`，确认本轮只新增候选资产，不覆盖旧图标，不替换 Electron 当前生效图标。
- [x] 设计第三组更偏正式品牌标识的 SVG 候选：少元素、强轮廓、科技感、可在 Dock / tray 小尺寸下识别。
- [x] 将每个 SVG 导出为 1024x1024 PNG，并生成第三组总览图。
- [x] 更新 `assets/icon/README.md`，说明新增候选的设计方向和推荐用途。
- [x] 验证 SVG XML、PNG 尺寸、文件清单和工作树差异，在本节末尾追加 Review。

## 2026-05-22 CodeInsights 项目图标第三组 Review

- 已新增第三组 6 套几何品牌候选：`codeinsights-geometric-lens`、`codeinsights-geometric-bracket`、`codeinsights-geometric-beacon`、`codeinsights-geometric-crystal`、`codeinsights-geometric-thread`、`codeinsights-geometric-monogram`。
- 每套候选都包含 SVG 源文件和 1024x1024 PNG 预览；第三组总览图为 `assets/icon/codeinsights-geometric-candidates.png`。
- 本轮设计重点：更接近正式 App icon 的品牌标识，不做复杂功能说明图；元素控制在 C/I、代码括号、洞察光束、Agent 信号、Pipeline 单线节点等抽象符号内。
- 推荐优先继续打磨：`geometric-lens` 作为默认主图标方向，`geometric-monogram` 作为长期品牌字标方向，`geometric-bracket` 作为开发者工具属性更明确的方向。
- 本轮未替换 Electron 当前生效的 `apps/electron/resources/icon.*`，只新增候选资产。
- 验证通过：`xmllint --noout assets/icon/codeinsights-geometric-*.svg`；`sips` 尺寸检查确认 6 个候选 PNG 均为 1024x1024、总览 PNG 为 1800x1200；已人工查看总览图，确认没有占位图或空白渲染；`git diff --check` 无空白错误。

## 2026-05-22 CodeInsights 简约图标第二组计划

- [x] 记录用户反馈到 `tasks/lessons.md`：上一组元素过多，不够美观简约，后续图标应优先作为品牌标识而非功能说明图。
- [x] 重新定义设计约束：强主轮廓、低元素数、少渐变、最多一处强调色，小尺寸仍可识别。
- [x] 新增第二组简约候选 SVG：以 CodeInsights 的 C/I、代码洞察、Pipeline 方向、Agent 核心为抽象几何符号，不堆叠功能节点。
- [x] 使用 `sips` 导出 1024x1024 PNG，并生成第二组总览图。
- [x] 验证 SVG / PNG 资产，更新 `assets/icon/README.md` 与本节 Review。

## 2026-05-22 CodeInsights 简约图标第二组 Review

- 已新增第二组 6 套简约候选：`codeinsights-minimal-c-mark`、`codeinsights-minimal-aperture`、`codeinsights-minimal-stack`、`codeinsights-minimal-terminal`、`codeinsights-minimal-flow`、`codeinsights-minimal-cut`。
- 每套都包含 SVG 源文件和 1024x1024 PNG 预览；第二组总览图为 `assets/icon/codeinsights-minimal-candidates.png`。
- 本轮优化重点：减少功能说明性元素，去掉密集节点和复杂轨道，控制为强主轮廓 + 少量几何负形 + 单一强调色。
- 小尺寸临时检查覆盖 64px / 128px，`C Mark`、`Aperture`、`Terminal` 最适合作为正式 App icon 候选继续打磨；`Stack` 更接近旧识别点但更简洁。
- 本轮仍未替换 Electron 当前生效的 `apps/electron/resources/icon.*`，只生成候选资产。

## 2026-05-22 CodeInsights 项目图标候选设计计划

- [x] 启动前复习 `tasks/lessons.md`，确认本轮只新增图标资产，不触碰已有运行时代码和无关 `.DS_Store` 噪音。
- [x] 检查现有图标资源：`assets/icon` 当前为空；Electron 当前生效图标在 `apps/electron/resources/icon.*`，本轮不直接替换。
- [x] 确认导出工具：本机 `sips` 可将 SVG 导出为 1024 PNG；未安装 `rsvg-convert` / ImageMagick，因此本轮使用 SVG 源文件 + `sips` PNG 预览。
- [x] 设计多套符合 CodeInsights 定位的候选图标：保留代码纵深识别点，同时体现 Pipeline、Agent、本地优先、开源贡献与高对比桌面图标方向。
- [x] 将候选 SVG 与 PNG 放入 `assets/icon`，并生成一张候选总览图方便对比。
- [x] 验证 SVG 结构、PNG 尺寸和文件清单，在本节末尾追加 Review。

## 2026-05-22 CodeInsights 项目图标候选设计 Review

- 已新增 5 套候选图标：`codeinsights-pipeline-prism`、`codeinsights-agent-orbit`、`codeinsights-local-core`、`codeinsights-open-merge`、`codeinsights-dock-mark`。
- 每套候选都包含 SVG 源文件和 1024x1024 PNG 预览，统一放在 `assets/icon`；另有 `codeinsights-icon-candidates.png` 作为 1800x720 总览图。
- 设计方向分别覆盖：Pipeline 五阶段工作流、Agent 工具轨道、本地优先与权限审计、开源贡献/merge 流程、小尺寸高对比 Dock 标记。
- 已补充 `assets/icon/README.md` 说明候选用途；本轮未替换 Electron 当前生效的 `apps/electron/resources/icon.*`。
- 验证通过：`xmllint --noout assets/icon/codeinsights-*.svg`；`sips` 尺寸检查确认候选 PNG 均为 1024x1024，总览 PNG 为 1800x720；`git diff --check` 无空白错误。

## 2026-05-22 CodeInsights 项目重命名计划

- [x] 启动前复习 `tasks/lessons.md`，确认本轮需要保护已有 `.DS_Store`、`tasks/todo.md`、`assets/`、`improve/` 等未提交改动。
- [x] 盘点旧项目名命中范围：运行时代码、包名 scope、配置目录、环境变量、Electron 打包元数据、资源路径、README/AGENTS/历史文档和视频素材。
- [x] 定义替换规则：展示名统一为 `CodeInsights`；包 scope 使用 `@codeinsights/*`；本地配置目录使用 `~/.codeinsights` / `~/.codeinsights-dev`；环境变量前缀使用 `CODEINSIGHTS_`；内部事件和文件路径去除旧项目名。
- [x] 批量更新代码和文档，必要时同步重命名资源目录/文件名，并保持 TypeScript import 可解析。
- [x] 运行 `bun install` 同步 lockfile，执行 `bun run typecheck` 和必要聚焦测试，复查 `rg` 中旧名残留。
- [x] 在本节末尾追加 Review，说明变更、验证结果和仍保留的历史上下文风险。

## 2026-05-22 CodeInsights 项目重命名 Review

- 已将项目展示名、包 scope、Electron appId/productName、配置目录、环境变量前缀、资源目录/文件名、文档站和历史文档中的 `RV-Insights` 系列命名统一切换为 `CodeInsights` / `@codeinsights/*` / `codeinsights-*`。
- 已将主配置目录切换为 `~/.codeinsights` / `~/.codeinsights-dev`，并保留旧 `~/.rv-insights` / `~/.rv-insights-dev` 的首次复制迁移；`RV_INSIGHTS_CONFIG_DIR` 仍作为旧环境变量兼容入口，新的覆盖变量为 `CODEINSIGHTS_CONFIG_DIR`。
- 已将运行时事件写入切换为 `codeinsights_event`，并保留旧 JSONL 中 `rv_insights_event` 的读取兼容；renderer 启动脚本会把旧 `rv-insights-*` localStorage key 迁移到新的 `codeinsights-*` key。
- 已补强旧数据迁移：主进程启动早期会在新 Electron `userData` profile 不存在时复制旧 `RV-Insights` / `rv-insights` / `@rv-insights/electron-dev` profile，并跳过 Chromium Singleton 文件；旧 runtime envelope 的 `source: "rv_insights"` 也继续可校验读取。
- 已顺手收敛更早遗留的 Proma 命名：用户可见下载/菜单链接、shell marker、生图附件标记、调试环境变量主入口均切到 CodeInsights；`PROMA_DEV`、`PROMA_DEBUG_REQUEST`、`PROMA_DEBUG_SSE` 仅作为旧环境变量兼容保留。
- 已处理审查发现：`backend/.env` 中的默认 LLM API key 已清空；GitHub clone/help/issue/release 目标统一为 `zcxGGmu/CodeInsights`；README 增加 Pages 地址并同步 package 版本；web 结构测试兼容当前没有 `README_zh.md` 的仓库状态。
- 版本已递增并同步 lockfile：根包 `0.1.1`，`@codeinsights/shared@0.1.42`，`@codeinsights/core@0.2.12`，`@codeinsights/ui@0.1.4`，`@codeinsights/electron@0.0.100`。
- 验证通过：`bun install`；`bun run typecheck`；聚焦测试 49 pass；`python3 -m unittest web/tests/test_homepage_structure.py` 11 pass；`bun test --isolate` 508 pass；`bun run electron:build`；`git diff --check`；明文 `sk-*` / `DEFAULT_LLM_API_KEY` 扫描无命中。
- 最终旧名扫描只剩明确兼容点：旧事件 kind/source、旧配置目录/env、旧 Electron userData profile 迁移、旧 localStorage key 迁移，以及 `PROMA_*` 旧调试/env 兼容。RISC-V / RV64 / RVV 等领域术语未作为项目名替换。

## 2026-05-22 CodeInsights 20s 介绍视频计划

- [x] 启动前复习 `tasks/lessons.md` 与当前任务记录，确认本轮不修改运行时代码、不处理历史 `.DS_Store` 噪音。
- [x] 深入分析项目定位与公开主入口：本地优先、Pipeline 五阶段、Agent 自主执行、Skills / MCP / Bridge 扩展。
- [x] 定义 HyperFrames 视觉规范：深色技术底、项目品牌紫/青/翡翠点缀、JetBrains Mono + 系统中文 fallback 字体体系。
- [x] 在 `assets/video/` 下生成 20 秒介绍视频工程，复用现有架构图和 CodeInsights logo 素材。
- [x] 渲染最终 MP4，并运行 `hyperframes lint`、`hyperframes validate`、`hyperframes inspect` 与关键帧快照验证。
- [x] 在本节末尾补充 Review，记录产物路径、验证结果和残留风险。

## 2026-05-22 CodeInsights 20s 介绍视频 Review

- 已生成 HyperFrames 工程：`assets/video/index.html`、`DESIGN.md`、`hyperframes.json`、`package.json`、`meta.json`、`assets/` 素材目录。
- 最终视频：`assets/video/codeinsights-intro-20s.mp4`，1920x1080，30fps，H.264 + AAC，`ffprobe` 显示时长 `20.021s`，大小约 `4.9 MB`。
- 视频叙事覆盖：本地优先开源 Agent 桌面应用、Pipeline 五阶段与人工 gate、Agent Runtime 事件流、JSON/JSONL 本地状态、Skills/MCP/Bridge/Channels 扩展能力、最终 `Pipeline | Agent` 定位。
- 验证通过：`npx hyperframes lint assets/video --verbose` 0 errors / 0 warnings；`HYPERFRAMES_BROWSER_PATH="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" PRODUCER_FORCE_SCREENSHOT=1 npx hyperframes validate assets/video --timeout 7000` 无 console errors，88 个文字元素通过 WCAG AA；`inspect --samples 12 --timeout 30000` 0 layout issues。
- 已生成关键帧快照：`assets/video/snapshots/`；并从成片抽取 `assets/video/render-contact-sheet.jpg` 做最终 MP4 画面核验。
- 已运行 animation-map：输出 `assets/video/.hyperframes/anim-map/animation-map.json`，timeline 已收敛为 20s；剩余 dead zones 为每幕留白阅读时间，collision/offscreen flag 主要来自有意的转场 wipe、glow 和场景 clip 切换。
- 验证环境说明：HyperFrames 自带 Chrome cache 曾出现半截 zip / 下载超时，最终使用本机 Microsoft Edge 作为 `HYPERFRAMES_BROWSER_PATH` 完成浏览器验证与渲染。

## 2026-05-22 Agent 重构最新开发状态（下次接续优先读）

- [x] 阶段 0-12 均已完成并提交。
- [x] 阶段 13 Runner v2 代码侧等价证据已完成并提交：自动重试、typed error 持久化、catch error SDKMessage 持久化、UI `sdk_message` 推送、重复 `run_started` / `sdk_session` 去重、Plan Mode 退出事件持久化、Watchdog / Teams auto-resume。
- [x] 阶段 13 真实 Electron Runner v2 交互证据已完成：发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- [x] 阶段 13 Pipeline 深水位真实 UI run 已补齐：sessionId `342a6f0f-bea1-40eb-9396-378685bfaadc` 已到 developer / reviewer / tester / committer draft，写入完整 `patch-work` 与 `patch-set`，并复验 Git guard、HEAD / refs / index / config 和 tester evidence。
- [x] 阶段 13 Codex Pipeline runner 收尾补强已完成并提交：`10356a3a fix(agent): 收尾阶段13 Pipeline 与 Codex guard 证据`，覆盖 Codex auth 隔离、strict schema 递归校验、reviewer 空字符串保守拒绝、Git guard 环境隔离和 clean-env 测试稳定性。
- [x] 阶段 13 文档交接曾同步提交：`353c5c53 docs(agent): 同步阶段13最新状态并更新继续开发提示词`；本节为 2026-05-22 文档状态再同步。
- [x] 当前版本：`@codeinsights/shared@0.1.41`，`@codeinsights/electron@0.0.99`。
- [x] 已定位 `bunx electron . --remote-debugging-port=9334` 立即退出原因：已有 9333 Electron 实例持有 `requestSingleInstanceLock()`，新进程被单实例锁退出；结束旧实例后 9334 CDP 可连接。
- [!] 飞书入口与飞书群聊 MCP 仍阻塞：本机缺少 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`，不能伪造通过。
- [x] 阶段 14A 已实施并提交：`88c03213 feat(agent): 完成阶段14A Agent Runner v2 默认化`。默认 Agent 对话走 Runner v2，`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` 可回到旧主循环。
- [x] 阶段 14B 已实施并提交：`be82e53d feat(agent): 完成阶段14B Pipeline Runner v2 默认化`。默认 Pipeline Claude 节点走 Pipeline Runner v2，`CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0` 可回到 Pipeline legacy adapter。
- [x] 已建立并完成阶段 14 分批默认化：14A Agent Runner v2、14B Pipeline Runner v2、14C Channels v2 均已默认开启并保留显式 env 回滚。
- [!] 若后续需要声明飞书真实可用，再真实补跑 `agentRuntimeChannelsV2` 飞书入口与飞书群聊 MCP；无配置时继续明确记录真实飞书阻塞。
- [x] 阶段 14A 默认化前后已跑完整聚焦验证与真实 Electron 交互复核，并继续保留旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge、旧 session JSONL 兼容。
- [x] 阶段 14C 已按用户指示排除飞书真实入口阻塞后完成代码侧默认化：默认 Channels v2 开启，`CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2=0` 可回到旧 Feishu bridge 路径。
- [x] 阶段 15 已完成 Agent Runner 链路手动切换：Agent 输入区可选择 `Runner v2` / `Legacy`，选择持久化到 settings，env 显式关闭仍硬回滚旧主循环。
- [!] 2026-05-22 本轮复查：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍不存在；未进入阶段 14C，未修改 `agentRuntimeChannelsV2` 默认策略。
- [x] 2026-05-22 用户明确指示暂不考虑飞书问题；阶段 14C 改为评估无飞书真实入口验收下的 `agentRuntimeChannelsV2` 默认开启和显式关闭回滚，不声称飞书入口或群聊 MCP 已通过。

## 2026-05-22 Agent 重构阶段 15：Agent Runner 链路手动切换计划

- [x] 范围确认：本阶段只为桌面 Agent 输入区增加 Runner 链路选择；不删除旧 Agent 主循环，不改变 Pipeline Runner、Channels v2 或飞书路径。
- [x] UI 位置：在 Agent 输入区底部工具栏靠左、权限模式与思考按钮之间增加紧凑链路切换控件，支持 `Runner v2` 与 `Legacy` 两条链路。
- [x] 契约设计：扩展 `AgentSendInput`，允许渲染进程把本次选择的 runner mode 传给主进程；主进程根据本次选择决定进入 `InProcessAgentRuntimeRunner` 或旧内联主循环。
- [x] 回滚约束：保留 `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` 环境变量硬回滚；显式关闭 env 时即使 UI 选择 Runner v2 也必须走旧主循环。
- [x] 持久化：把用户选择保存到 settings，重启后恢复；默认值保持当前默认链路 `Runner v2`。
- [x] 可审计性：运行日志和 runtime event log 记录本次实际链路，便于证明某次会话走的是 Runner v2 还是旧主循环。
- [x] TDD：先补纯函数/契约测试，覆盖默认 Runner v2、UI 选择 Legacy、env 关闭硬回滚和 run_started 中的 runner mode。
- [x] 实现 UI、settings 类型、preload/IPC 类型、主进程分支选择与必要文案；同步递增受影响包 patch 版本。
- [x] 验证：运行 `bun run typecheck`、Agent runtime/orchestrator/event log/renderer 聚焦测试、`git diff --check`；本阶段未删除旧路径，也未触碰 Pipeline / Channels 执行路径。
- [x] 阶段 15 完成后更新 Review 和 Agent 重构 checklist，单独提交，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件。

## 2026-05-22 Agent 重构阶段 15：Review

- 已在 Agent 输入区底部工具栏的权限模式与思考按钮之间增加链路切换按钮，当前显示 `Runner v2` 或 `Legacy`；运行中按钮禁用，切换只影响后续发送。
- 已扩展 `AgentSendInput.runtimeRunnerMode` 与 `AppSettings.agentRuntimeRunnerMode`，渲染进程发送消息时透传本次选择，并把用户选择持久化到 settings。
- 主进程新增 per-run 链路解析：默认走 `Runner v2`；未显式设置 env 时 UI 选择 `Legacy` 可走旧 Agent 主循环；`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` / `false` / `off` / `no` / `disabled` 仍硬回滚旧主循环，显式开启值仍强制 Runner v2。
- Runtime event log 的 `run_started` 新增可选 `runnerMode` 字段，运行日志也输出 `Runtime Runner 链路: ...`，可审计每次会话实际链路。
- 版本已递增：`@codeinsights/shared@0.1.41`，`@codeinsights/electron@0.0.99`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`，58 pass。

## 2026-05-22 Agent 重构阶段 14C：Channels v2 非飞书默认化计划

- [x] 重新确认范围：按用户指示，本阶段不以飞书真实配置、飞书入口或飞书群聊 MCP 为默认化阻塞条件。
- [x] 保留边界说明：本阶段只能证明无飞书配置环境下默认开启 `agentRuntimeChannelsV2` 不影响桌面 Agent / Pipeline；不能声称飞书真实入口已通过。
- [x] 修改 `agentRuntimeChannelsV2` 默认策略：未设置 `CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2` 时默认开启；显式 `0` / `false` / `off` / `no` / `disabled` 回到旧 Feishu bridge 路径；显式开启值继续强制 Channels v2。
- [x] 补充聚焦测试：覆盖默认开启、显式关闭、显式开启和模块导入时 env 决定 flag；保留 Feishu adapter 的权限排队、delta、final markdown 测试。
- [x] 验证无飞书配置环境：复查两份 feishu 配置仍缺失；按用户指示不以飞书真实入口为阻塞，不声明飞书真实通过。
- [x] 运行验证：`bun run typecheck`；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试；Pipeline 聚焦测试。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、新增阶段 14C baseline、更新 `docs/agent-refactor/next-session-prompt.md` 和本文件 Review；递增 `@codeinsights/electron` patch 版本并同步 lockfile。
- [x] 阶段 14C 完成后单独提交，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件。

## 2026-05-22 Agent 重构阶段 14C：Review

- 阶段 14C 已完成代码侧默认化：`agentRuntimeChannelsV2` 默认策略改为未设置 env 时启用 Channels v2，`CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2=0` / `false` / `off` / `no` / `disabled` 可显式回滚旧 Feishu bridge 路径，`1` / `true` / `on` / `yes` / `enabled` 继续强制 Channels v2。
- 本阶段按用户指示暂不考虑飞书问题；未补跑真实飞书入口或飞书群聊 MCP，也不声明飞书真实通过。
- 本阶段只触碰 Channels v2 默认策略、聚焦测试、`@codeinsights/electron` 版本和 Agent 重构交接文档；未删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- 验证通过：`bun run typecheck`；Feishu / channel 聚焦测试 9 pass；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试 56 pass；Pipeline 聚焦测试 91 pass。
- 飞书配置复查仍缺失：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在；如后续需要声明飞书真实可用，仍需单独补真实入口和群聊 MCP 验证。
- 下一阶段如要删除旧路径，必须另起独立计划并保留回滚点。

## 2026-05-22 Agent 重构 14C 飞书配置复查阻塞计划（历史记录）

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13/14A/14B baseline 和 next-session prompt。
- [x] 运行 `git status --short`，确认当前只存在 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 无关噪音，不纳入提交。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在。
- [x] 因缺少飞书配置，本轮只记录阻塞；不补跑飞书入口或飞书群聊 MCP，不伪造通过。
- [x] 当时保持 `agentRuntimeChannelsV2` 默认关闭；不删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- [x] 运行 `git diff --check`，确认本轮只包含阻塞记录文档变更。

## 2026-05-22 Agent 重构 14C 飞书配置复查 Review（历史记录）

- 本轮未进入阶段 14C 默认化：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，无法真实补跑飞书入口和飞书群聊 MCP。
- 当时 `agentRuntimeChannelsV2` 继续默认关闭；该阻塞判断已被用户后续“暂不考虑飞书问题”的指示覆盖。
- 本轮只更新 `tasks/todo.md` 的阻塞记录，不修改运行时代码，不修改 package 版本，不触碰旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。

## 2026-05-22 Agent 重构 14B 后状态文档同步计划

- [x] 更新 `tasks/todo.md` 最新状态：明确 14B commit `be82e53d` 已完成，下一阶段只剩 14C Channels v2 受飞书配置阻塞。
- [x] 更新 `docs/agent-refactor/README.md`、`development-checklist.md`、`baseline-runs/2026-05-22-stage-14B.md`、`next-session-prompt.md`：补齐 14B 提交号和下次启动入口。
- [x] 运行 `git diff --check`，确认只包含文档状态同步，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件。
- [x] 本轮文档状态同步后单独提交，便于下次启动直接恢复。

## 2026-05-22 Agent 重构 14B 后状态文档同步 Review

- 已同步 14B 最新完成状态：commit `be82e53d` 已作为 Pipeline Runner v2 默认化完成点写入任务记录、Agent 重构 README、development checklist、阶段 14B baseline 和 next-session prompt。
- 当前已完成：Agent Runner v2 默认开启；Pipeline Runner v2 默认开启；两者均保留显式 env 关闭回滚。
- 当时未完成：飞书入口与飞书群聊 MCP 仍缺 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；`agentRuntimeChannelsV2` 当时仍默认关闭；旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 和旧 session JSONL 兼容仍保留。
- 本轮只更新文档状态和下次启动提示词，不修改运行时代码，不修改 package 版本。

## 2026-05-22 Agent 重构阶段 14B：Pipeline Runner v2 默认化执行计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13/14A baseline 和 next-session prompt。
- [x] 运行 `git status --short`，确认当前只存在 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 无关噪音，不纳入阶段提交。
- [x] 复查飞书配置：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍不存在，飞书入口与飞书群聊 MCP 继续阻塞，不伪造通过。
- [x] 范围确认：本阶段只评估 `agentRuntimePipelineRunnerV2` 默认化；不触碰 `agentRuntimeChannelsV2` 默认值，不删除 Pipeline legacy adapter、旧 Agent 主循环、旧 Feishu bridge 或旧 session JSONL 兼容。
- [x] 默认化前验证矩阵：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试；Pipeline 聚焦测试；clean-env Codex runner 单测；真实 Electron Pipeline 深水位 UI run；`git diff --check`。
- [x] 默认化前记录当前行为：未设置 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2` 时 Pipeline 仍走 legacy adapter；显式 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1` 时走 Pipeline Runner v2。
- [x] 实现默认策略：未设置 env 时走 Pipeline Runner v2；显式关闭 env 时回到 Pipeline legacy adapter；显式开启 env 时继续强制 Pipeline Runner v2。
- [x] 补聚焦测试：覆盖默认开启、显式关闭回滚、显式开启强制 Runner v2；确认 `agentRuntimeChannelsV2` 默认值不变。
- [x] 默认化后复跑同一验证矩阵，并记录默认 Pipeline 走 Runner v2、显式关闭走 legacy adapter 的真实 Electron 证据。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、新增阶段 14B baseline、`docs/agent-refactor/next-session-prompt.md` 和本文件 Review；递增受影响包 patch 版本并同步 lockfile。
- [x] 阶段 14B 完成后单独提交，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件；提交信息用中文说明完成项、验证项和未完成项。

## 2026-05-22 Agent 重构阶段 14B：Review

- 阶段 14B 已完成：`agentRuntimePipelineRunnerV2` 默认策略改为未设置 env 时启用 Pipeline Runner v2，`CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0` / `false` / `off` / `no` / `disabled` 可显式回滚 Pipeline legacy adapter，`1` / `true` / `on` / `yes` / `enabled` 继续强制 Pipeline Runner v2。
- 本阶段只触碰 Pipeline Runner v2 默认策略、聚焦测试、`@codeinsights/electron` 版本和 Agent 重构交接文档；未默认开启 `agentRuntimeChannelsV2`，未删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- 默认化前验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试 51 pass；Pipeline 聚焦测试 88 pass；clean-env Codex runner 单测 30 pass；`git diff --check`。
- 默认化前真实 Electron 基线：`0.0.96` + `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1` session `de721097-fdb8-4cc3-9847-e5707eecb771` 走 Pipeline Runner v2 并到 committer/completed；unseeded session `35bfc6af-233b-4318-8564-a66691d44bbb` 因无 Git repository 被 Git guard fail closed。
- 默认化后验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试 51 pass；Pipeline 聚焦测试 91 pass；clean-env Codex runner 单测 30 pass。
- 默认化后真实 Electron 默认路径：`0.0.97` 无 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2` session `a70c02d0-ff2f-4283-b121-cd963771fd9f` 日志确认 explorer / planner 使用 `InProcessAgentRuntimeRunner`，最终到 committer/completed。
- 默认路径 Git guard 复验通过：HEAD `f908d9fc45795b5a3e65fcaec649db2e18b0a0ed` 未变，refs 仅 `refs/heads/main`，staged diff 为空，index SHA256 `5c3fac2a3d81eb4ad1e58c8b84c77882ba4c7e7b1cfa6a1d59d2062b89261d48` 未变，config SHA256 `6260efbdf5ce8288e0724fe95d167459922c83ad7e32070da3b7e1362d1518f8` 未变。
- 默认路径 patch-work 完整写入：`explorer/report-001.md`、`selected-task.md`、`plan.md`、`test-plan.md`、`dev.md`、`review.md`、`result.md`、`commit.md`、`pr.md` 和 `patch-set/*`；`test-evidence.json` 中 `bun test` / `bun test --coverage` 均为 passed，commit / PR 仅为 draft。
- 显式关闭回滚路径：`0.0.97` + `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0` session `1112d7fc-ab4b-4e4b-bedf-193533a7daec` 日志确认 explorer 使用 `legacy adapter`，随后手动 stop 到 `terminated`。
- 聚焦测试补强：新增模块导入隔离测试，验证 env 在导入时决定模块级 flag；Git/PR guard 长用例因全量运行时偶发 5s 假阴性，单独重跑通过后将该用例超时调整为 10s。
- 飞书配置复查仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，不能伪造飞书入口或飞书群聊 MCP 通过。
- 当时下一阶段计划是补齐飞书配置后进入 14C；该判断已被后续用户指示“暂不考虑飞书问题”覆盖。

## 2026-05-22 Agent 重构阶段 14：Runner v2 默认化评估计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13 baseline 和 next-session prompt。
- [x] 运行 `git status --short`，确认当前只存在 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 无关噪音，不纳入阶段提交。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在，飞书入口与飞书群聊 MCP 继续阻塞，不伪造通过。
- [x] 定位三个默认化开关现状：`agentRuntimeRunnerV2` 在 `apps/electron/src/main/lib/agent-runtime-types.ts`，`agentRuntimePipelineRunnerV2` 在 `apps/electron/src/main/lib/pipeline-node-runner.ts`，`agentRuntimeChannelsV2` 在 `apps/electron/src/main/lib/agent-channel.ts`；当前均为 env 显式 `1` 才启用。
- [x] 默认化策略定为分批推进：阶段 14A 只评估 Agent Runner v2 默认开启；Pipeline Runner v2 不在同一提交默认开启；Channels v2 在飞书配置缺失前保持默认关闭。
- [x] 回滚策略：默认化实现必须保留显式 env 关闭能力，并继续保留旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 和旧 session JSONL 兼容。
- [x] 阶段 14A 实现前先确认计划，不直接修改 feature flag 默认值；实现时只触碰 Agent Runner v2 默认开关和必要测试/文档。
- [x] 阶段 14A 默认化前复跑：`bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、clean-env Codex runner 单测、真实 Electron Agent 交互复核和 `git diff --check`。
- [x] 阶段 14A 默认化后复跑同一验证矩阵，确认默认 Agent 对话走 Runner v2，显式关闭开关能回到旧主循环。
- [x] 阶段 14B 只有在 14A 通过并单独提交后，才评估 Pipeline Runner v2 默认开启；已单独完成并提交 `be82e53d`，已重跑 Pipeline 深水位真实 UI run，复验 human gate、patch-work、Git guard 和 tester evidence。
- [x] 阶段 14C Channels v2 默认化已按用户指示排除飞书真实入口阻塞后完成；仍不得标记飞书入口或群聊 MCP 通过。

## 2026-05-22 Agent 重构阶段 14A：Agent Runner v2 默认化执行计划

- [x] 启动前复习必要文档，并确认工作树只存在 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音。
- [x] 复查飞书配置：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍不存在，飞书入口与飞书群聊 MCP 继续阻塞，不伪造通过。
- [x] 范围确认：本阶段只修改 `agentRuntimeRunnerV2` 默认策略、相关聚焦测试、必要版本与阶段文档；不默认开启 `agentRuntimePipelineRunnerV2` 或 `agentRuntimeChannelsV2`。
- [x] 默认化前验证矩阵：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试；Pipeline 聚焦测试；clean-env Codex runner 单测；真实 Electron Agent 交互复核；`git diff --check`。
- [x] 实现默认策略：未设置 env 时走 Runner v2；显式关闭 env 时回到旧 Agent 主循环；显式开启 env 时继续强制 Runner v2。
- [x] 补聚焦测试：覆盖默认开启、显式关闭回滚、显式开启强制 Runner v2；确认 Pipeline / Channels 默认值不变。
- [x] 默认化后复跑同一验证矩阵，并记录默认 Agent 对话走 Runner v2、显式关闭走旧主循环的真实 Electron 证据。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、必要交接文档和本文件 Review；递增受影响包 patch 版本并同步 lockfile。
- [x] 阶段 14A 完成后单独提交，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件。

## 2026-05-22 Agent 重构阶段 14A：Review

- 阶段 14A 已完成：`agentRuntimeRunnerV2` 默认策略改为未设置 env 时启用 Runner v2，`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` / `false` / `off` / `no` / `disabled` 可显式回滚旧主循环，`1` / `true` / `on` / `yes` / `enabled` 继续强制 Runner v2。
- 阶段 14A 已单独提交：`88c03213 feat(agent): 完成阶段14A Agent Runner v2 默认化`。
- 本阶段只触碰 Agent Runner v2 默认策略、聚焦测试、`@codeinsights/electron` 版本和 Agent 重构交接文档；未默认开启 `agentRuntimePipelineRunnerV2` 或 `agentRuntimeChannelsV2`，未删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- 默认化前验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试 44 pass；Pipeline 聚焦测试 87 pass；clean-env Codex runner 单测 30 pass；`git diff --check`。
- 默认化前真实 Electron 基线：`0.0.95` 无 env session `53a0c58e-0ca9-4a26-8354-45910b99a904` 走旧主循环，输出 `stage14 pre default legacy ok`。
- 默认化后验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试 51 pass；Pipeline 聚焦测试 88 pass；clean-env Codex runner 单测 30 pass；`git diff --check`。
- 默认化后真实 Electron 默认路径：`0.0.96` 无 env session `073783b3-27ae-49ec-b516-92de146e6572` 日志确认切到 `InProcessAgentRuntimeRunner`，events JSONL 写入 `run_completed`，输出 `stage14 default runner v2 ok`。
- 显式关闭回滚路径：`0.0.96` + `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` session `70bf7de8-043a-49c2-81c4-28e49f15ff96` 日志确认无 Runner v2 切换，走旧 Adapter 主循环并输出 `stage14 explicit off legacy ok`。
- 飞书配置复查仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，不能伪造飞书入口或飞书群聊 MCP 通过。
- 下一阶段只能在本阶段单独提交后进入 14B：评估 Pipeline Runner v2 默认化，并重新补 Pipeline 深水位真实 UI run。

## 2026-05-22 Agent 重构 14A 后状态文档同步计划

- [x] 更新 `tasks/todo.md` 最新状态：明确 14A commit `88c03213` 已完成，下一阶段是 14B。
- [x] 更新 `docs/agent-refactor/README.md`、`development-checklist.md`、`next-session-prompt.md`：补入 14A 提交号与 14B 接续入口。
- [x] 运行 `git diff --check`，确认只包含文档状态同步，不纳入 `.DS_Store`、`improve/` 或无关文件。
- [x] 本轮文档状态同步后单独提交，便于下次启动直接恢复。

## 2026-05-22 Agent 重构 14A 后状态文档同步 Review

- 已同步 14A 最新完成状态：commit `88c03213` 已作为 Agent Runner v2 默认化完成点写入任务记录、Agent 重构 README、development checklist 和 next-session prompt。
- 下次启动入口已明确为阶段 14B：只评估 Pipeline Runner v2 默认化，进入前先更新计划并重跑 Pipeline 深水位真实 UI run；Channels v2 不得同批默认开启。
- 当前未完成项仍为：飞书入口与飞书群聊 MCP 缺配置阻塞；`agentRuntimePipelineRunnerV2` 与 `agentRuntimeChannelsV2` 默认值尚未修改；旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 和旧 session JSONL 兼容仍保留。

## 2026-05-22 Agent 重构阶段 14：计划 Review

- 本轮只建立 Runner v2 默认化评估计划，不修改运行时代码，不改变 `agentRuntimeRunnerV2` / `agentRuntimePipelineRunnerV2` / `agentRuntimeChannelsV2` 当前默认关闭行为。
- 分批决策：Agent Runner v2 可作为第一批默认化候选；Pipeline Runner v2 虽已有深水位证据，但因副作用面更大，必须后置到单独阶段；Channels v2 因飞书配置缺失继续阻塞。
- 默认化实现必须提供显式回滚开关，不能删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- 飞书配置复查仍缺失：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。

## 2026-05-22 Agent 重构文档状态同步计划

- [x] 更新 `docs/agent-refactor/README.md` 当前进度：补入阶段 14 计划提交 `02199299`，明确下一步进入 14A。
- [x] 更新 `docs/agent-refactor/next-session-prompt.md`：给出下次启动可直接发送的提示词，入口改为阶段 14A。
- [x] 保持 `docs/agent-refactor/development-checklist.md` 的阶段 14 分批默认化计划为当前主控状态。
- [x] 本轮不修改运行时代码，不修改 package 版本，不改 README 项目根文档或 AGENTS。
- [x] 运行文档 diff 检查和 `git diff --check`。

## 2026-05-22 Agent 重构文档状态同步 Review

- 已把最新开发状态同步到 Agent 重构 README、development checklist、next-session prompt 和本任务记录。
- 当前已完成：阶段 0-13 全部实现/证据项完成；阶段 14 默认化评估计划完成并已提交；阶段 14A Agent Runner v2 默认化已完成。
- 当前未完成：飞书入口与飞书群聊 MCP 仍缺配置阻塞；Pipeline Runner v2 与 Channels v2 默认开关尚未修改；14B Pipeline 默认化评估尚未开始。
- 下次启动应从阶段 14B 继续：先做 Pipeline 默认化前验证，再只评估 Pipeline Runner v2 默认策略，Channels v2 不得同批默认开启。

## 2026-05-22 文档状态同步 Review

- 本次任务只更新交接文档和下次启动提示词，不修改运行时代码。
- 历史阶段条目中的旧 `[ ]` / `[~]` 可能是当时记录，判断当前进度时以本节、`docs/agent-refactor/development-checklist.md` 的“当前开发状态”和 `docs/agent-refactor/next-session-prompt.md` 为准。
- 当前工作树已知无关噪音：`.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store`；后续提交不得纳入这些文件。

## 2026-05-19 Agent 重构阶段 13：Pipeline 深水位续跑计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13 baseline 和 next-session prompt。
- [x] 检查 `git status --short`，确认当前只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音，不纳入阶段提交。
- [x] 确认可用渠道/模型：本机开发配置仍只有 DeepSeek 渠道；本轮采用已完成的 deepwater session 证据，不再重新赌余额。
- [x] 启动 Electron / CDP，并在 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1`、`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=1` 下补跑最小 Pipeline v2 真实 UI run。
- [x] 让 Pipeline 至少进入 developer / reviewer / tester，记录 sessionId、gateId、选择的 report、records、patch-work 文件和最终状态。
- [x] 复验 Git 写入防护：确认 developer / tester 阶段没有污染 HEAD、refs、index、local config，并保留校验命令/结果。
- [x] 复验 tester 证据保守判定：真实 session 的 evidence 全部为 `passed`，缺失或 failed/skipped evidence 仍由聚焦测试保守阻断。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在，继续记录阻塞，不伪造通过。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`、`docs/agent-refactor/next-session-prompt.md` 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、clean-env Codex runner 测试、Electron 真实交互证据复核和 `git diff --check`。
- [x] 阶段 13 本轮补证完成后单独提交，只包含阶段 13 相关文件，不纳入 `.DS_Store`、`improve/` 或无关改动。

## 2026-05-19 Agent 重构阶段 13：Pipeline 深水位与 Codex auth Review

- Pipeline deepwater session `342a6f0f-bea1-40eb-9396-378685bfaadc` 已形成真实 UI 证据：`patch-work/dev.md`、`patch-work/review.md`、`patch-work/result.md`、`patch-work/commit.md`、`patch-work/pr.md` 和 `patch-work/patch-set/*` 均存在。
- Reviewer 只读通过：`patch-work/review.md` 结论 `approved=true`，未发现 blocking issue。
- Tester workspace-write 通过：`patch-work/result.md` 记录 `bun test` 与 `bun test --coverage` 成功；`test-evidence.json` 三条 evidence 均为 `passed`。
- Committer 仅生成草稿：`commit.md` / `pr.md` 均为 draft only，明确未执行 `git add`、`git commit`、`git push` 或创建 PR。
- Git guard 复验通过：HEAD 为 `9e701190e6ea8ca80f4417aa6300d70b40f89e50`，refs 仅 `refs/heads/main`，staged diff 为空，index SHA256 为 `676c9ec5d1621f8e7007ec8d6fdc415332a3703d641a0c323ba7f3367472ea74`，config SHA256 为 `507d44b93b030d2b2c78262ca9920be5a0d43ca914dce94943f5007673f91a37`。
- Codex Pipeline runner 已补强 auth 隔离：支持 `CODEX_HOME/auth.json`，API key 模式隔离继承的 `CODEX_HOME`，测试默认用假 `CODEX_API_KEY`，只有 fail-fast 用例保留无凭证路径。
- Strict schema 已补递归测试，所有 object schema 的 `required` 必须完整覆盖 `properties`，Codex mock finalResponse 已更新为符合 schema 的响应；reviewer `structuredIssues` 的 id / file / suggestedFix 空字符串会被保守拒绝。
- Git guard 已补宿主 `GIT_*` 环境隔离：内部 Git snapshot 使用清理后的环境，v2 写入节点存在 contribution task 但无法读取 HEAD 时 fail closed，避免因宿主 `GIT_DIR` / `GIT_CONFIG_COUNT` 导致 guard 不安装。
- 飞书配置复查仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，不能伪造通过。
- clean-env Codex runner 单测在 3 秒等待窗口下曾复现 `grandchild.pid` 假阴性超时；已把进程树 fixture 等待窗口调宽到 10 秒，避免干净环境 Bun 子进程冷启动导致误报。
- 已通过 clean-env Codex runner 单测：空 `HOME` / 空 `CODEX_HOME` / 无 `CODEX_API_KEY` / 无 `OPENAI_API_KEY` 下 `codex-pipeline-node-runner.test.ts` 30 pass。
- 已通过本轮收尾验证：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试 44 pass；Pipeline 聚焦测试 87 pass；clean-env Codex runner 单测 30 pass；`git diff --check`。

## 2026-05-19 Agent 重构阶段 13：Pipeline planner fallback 与深水位补跑 Review

- 已定位 Electron 9334 立即退出根因：旧 Electron 仍在 9333 运行，单实例锁导致新进程退出；结束旧实例并重启后 `curl http://127.0.0.1:9334/json/version` 返回 `@codeinsights/electron/0.0.93`，CDP 恢复。
- 真实 Pipeline run `2432c724-3b6f-463e-89c6-bdb135ac0a65` 已进入 `explorer/task_selection` gate，写入 `patch-work/explorer/report-001.md`；选择 `report-001` 后 planner 返回自然语言摘要，旧逻辑因“输出不是合法 JSON 对象”失败。
- 已修复 planner 自然语言 fallback：非 JSON planner 输出会生成保守 `PipelinePlannerStageOutput`，v2 enrichment 会继续写入 `patch-work/plan.md` 与 `patch-work/test-plan.md`，不放宽 reviewer / tester 严格结构化校验。
- 修复后新真实 Pipeline run `e81216eb-9902-475e-98fc-a51661426694` 启动成功，explorer 阶段尝试写文件被只读工具防护拦截，随后 DeepSeek 渠道返回 `Insufficient Balance`，当时未标记深水位通过；后续 session `342a6f0f-bea1-40eb-9396-378685bfaadc` 已补齐深水位证据。
- Pipeline planner fallback 修复已提交：`6171f164 fix(agent): 补强阶段13 Pipeline planner fallback 证据`。
- 飞书配置复查仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。
- 验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试 44 pass；Pipeline 聚焦测试 83 pass；`git diff --check`。

## 2026-05-18 Agent 重构最新状态交接

- [x] 阶段 0 冻结基线已完成并提交：`47f8ad8d docs: 冻结 Agent 重构阶段 0 行为基线`。
- [x] 阶段 1 Shared Event Contract 已完成并提交：`d9801cf9 feat(shared): 完成 Agent 重构阶段 1 事件契约`。
- [x] 阶段 2 Event Log 双写已完成并提交：`04f23aa6 feat(agent): 完成 Agent 重构阶段 2 事件日志双写`。
- [x] 阶段 3 In-process AgentRuntimeRunner 已完成并提交：`ee1157b9 feat(agent): 完成 Agent 重构阶段 3 进程内 Runner`。
- [x] 阶段 4 Runtime Manifest 只读解析已完成并提交：`18a65cd1 feat(agent): 完成 Agent 重构阶段 4 Runtime Manifest 只读解析`。
- [x] 阶段 5 交接提示词已更新并提交：`410d8945 docs(agent): 更新阶段 5 交接提示词`。
- [x] 阶段 5 Runtime Materializer for New Sessions 已完成并提交：`10fd5808 feat(agent): 完成 Agent 重构阶段 5 Runtime Materializer`。
- [x] 阶段 6 插件系统原生化已完成并提交：`05f3c9e9 feat(agent): 完成 Agent 重构阶段 6 插件系统原生化`。
- [x] 阶段 7 内置 MCP Bridge 已完成并提交：`eb9b9f34 feat(agent): 完成 Agent 重构阶段 7 内置 MCP Bridge`。
- [x] 阶段 8 Renderer 切新 Reducer 已完成并提交：`6ff5a6cb feat(agent): 完成 Agent 重构阶段 8 Renderer 切新 Reducer`。
- [x] 阶段 9 External Channel Adapter 已完成并提交：`09e558a7 feat(agent): 完成 Agent 重构阶段 9 External Channel Adapter`。
- [x] 阶段 10 Pipeline 复用 Runner 已完成实现与聚焦验证。
- [x] 阶段 11 清理旧路径已完成并提交：`2760a3e8 feat(agent): 完成阶段11旧路径清理`。
- [x] 阶段 12 真实交互补跑与 Runner v2 默认化准备已完成并提交：`0e37e500 feat(agent): 完成阶段12真实交互补跑与Runner v2 stop加固`。
- [x] 阶段 13 Runner v2 默认化证据补齐已完成到可审计状态：代码侧补强 `328b3c96`、`sdk_session` 去重 `46e62a75`、Plan Mode 退出 `acc769f1`、Watchdog / Teams auto-resume `b3d0517e`、Pipeline planner fallback `6171f164`、Pipeline 与 Codex guard 收尾 `10356a3a` 均已提交；Pipeline UI 深水位证据已由后续 session `342a6f0f-bea1-40eb-9396-378685bfaadc` 补齐。

## 2026-05-18 Agent 重构阶段 13：Runner v2 默认化证据补齐计划

- [x] 复习 `tasks/lessons.md`、阶段 12 证据、Agent 重构 README、development checklist、event contract 和 runtime manifest。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 梳理旧 Agent 主循环仍独有能力：自动重试、Watchdog、Teams auto-resume、typed error 持久化、UI `sdk_message` 推送、旧 session resume / transcript 兼容。
- [x] 在 `agentRuntimeRunnerV2` feature flag 下补齐自动重试等价测试或明确记录仍不等价原因。
- [x] 在 `agentRuntimeRunnerV2` feature flag 下补齐 typed error 持久化和 completion signal 行为测试。
- [~] 补跑真实 Electron Runner v2 交互：发送、停止、权限 approve / deny、AskUser、Plan Mode。
- [!] 补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；当前真实脚本多次超时，需改为更小粒度脚本或单场景补跑。
- [!] 补跑最小 Pipeline 真实 UI run，复验 human gate、patch-work 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定；本轮未进入。
- [ ] 若有飞书配置，补跑 `agentRuntimeChannelsV2` 飞书入口与群聊 MCP；若仍无配置，继续明确阻塞，不伪造通过。
- [~] 判断是否具备默认开启 `agentRuntimeRunnerV2` 条件；目前仅部分证据补齐，仍不能默认开启。
- [x] 更新 `docs/agent-refactor/baseline-runs/` 新证据、`docs/agent-refactor/development-checklist.md` 和本文件 Review。
- [~] 运行 `bun run typecheck`、Agent / Runtime / Renderer / Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。
- [x] 阶段 13 代码侧补强已单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动：`328b3c96 feat(agent): 补齐阶段13 Runner v2 等价证据`。
- [x] 阶段 13 追加修复已单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动：`46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据`。
- [x] 阶段 13 Plan Mode 退出证据补强已单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动：`acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据`。

## 2026-05-18 Agent 重构阶段 13：当前 Review

- Runner v2 已补齐的代码侧证据：自动重试、typed error 持久化、`sdk_message` UI 推送、stop 终态加固与重复 `run_started/sdk_session` 去重。
- 已完成验证：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`；`git diff --check`。
- 真实 Electron 交互已补到发送与停止；权限 approve / deny、AskUser、Plan Mode 在本轮脚本中卡在会话/响应编排上，未形成可提交证据。
- 旧 session resume、同会话并发、附件、additional directory、fork、rewind、最小 Pipeline 真实 UI run 仍未完成。
- 当前仍不能默认开启 `agentRuntimeRunnerV2`；缺口主要在真实交互覆盖，不在 typecheck 或聚焦单测。
- 已将 `@codeinsights/electron` 升到 `0.0.90`，并同步 `bun.lock` workspace 版本元数据。
- 新增阶段 13 状态证据文档：`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`。

## 2026-05-18 Agent 重构阶段 13：下次启动继续开发入口

- [x] 先复习本文件、`tasks/lessons.md`、`docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-12.md` 和 `docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`。
- [x] 不默认开启 `agentRuntimeRunnerV2`，不删除旧 Agent 主循环，不做 UI 改版。
- [~] 用更小粒度 CDP / preload 脚本补跑 Runner v2 权限 approve、权限 deny、AskUser、Plan Mode；权限 approve / deny 已补跑通过，其他 pending 仍待补。
- [ ] 补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；每项记录 sessionId、输入、终态、events JSONL 证据和阻塞原因。
- [ ] 补跑最小 Pipeline 真实 UI run，复验 human gate、patch-work 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
- [ ] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；若仍不存在，继续记录飞书阻塞，不能伪造通过。
- [ ] 完成真实证据后再评估 `agentRuntimeRunnerV2` 是否具备默认开启条件。
- [ ] 收尾时运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。

## 2026-05-19 Agent 重构阶段 13：真实证据补跑计划

- [x] 复习阶段 13 交接文档、事件契约、runtime manifest、阶段 12/13 baseline 和 lessons。
- [x] 梳理 preload / CDP / Electron 启动入口，确认 Agent pending 响应字段严格使用 `behavior`、`answers`、`action`。
- [x] 单场景补跑 Runner v2 权限 approve，记录 sessionId、requestId、events JSONL 终态和 SDKMessage 证据。
- [x] 单场景补跑 Runner v2 权限 deny，记录 sessionId、requestId、permission_denials / run 终态。
- [ ] 单场景补跑 Runner v2 AskUser，记录 requestId、回答 payload、resolved event 和后续终态或明确阻塞。
- [ ] 单场景补跑 Runner v2 Plan Mode，记录 `plan_mode_entered`、`plan_mode_exited` 或阻塞原因，并恢复 workspace permission mode。
- [ ] 分项补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；失败时必须 stop 当前 session 并记录阻塞。
- [ ] 补跑最小 Pipeline 真实 UI run，并复验 human gate、patch-work Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
- [x] 检查飞书配置文件；`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍缺失，继续记录阻塞。
- [~] 更新 `docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md` 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。

## 2026-05-19 Agent 重构阶段 13：当前 Review

- Runner v2 权限 approve 已用 Electron 0.0.90 + `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=1` 真实补跑通过：sessionId `d2fd3559-3515-40ed-b0dd-304c6c218200`，requestId `f7bf1269-3e92-45b0-b99a-f5f451eefde5`，`Write` 工具批准后写入 `stage13-runner-v2-approve-dedupe.txt`，events JSONL 终态 `run_completed`。
- Runner v2 权限 deny 已用同一 Electron 实例真实补跑通过：sessionId `c31ec718-0d80-465f-bebd-5233e2ca7884`，requestId `b31cdc76-fe22-428a-a11c-32fba08899b4`，`permission_resolved(decision=denied)` 后 `tool_completed(status=error, outputSummary=用户拒绝了此操作)`，目标文件未生成。
- 补跑中发现阶段 13 原“重复 sdk_session 去重”仍不完整：`queryOptions.onSessionId` 会多次写入相同 `sdk_session`。已改为 event log writer 对同一 run 内相同 `sdkSessionId` 去重，并新增聚焦测试。
- 修复后复验：`d2fd3559-3515-40ed-b0dd-304c6c218200.events.jsonl` 中 `sdk_session_count=1`，事件序列保持连续，文件写入成功。
- 追加修复已提交：`46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据`。
- Plan Mode 退出证据补强已提交：`acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据`。
- 已将 `@codeinsights/electron` 升到 `0.0.91`，并同步 `bun.lock` workspace 版本元数据。
- 已通过聚焦测试：`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts`。
- 已通过收尾验证：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`（41 pass）；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`（81 pass）；`git diff --check`。
- 飞书配置仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。
- 仍不能默认开启 Runner v2；AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind 已在后续补跑通过，剩余缺口是 Watchdog、Teams auto-resume、能进入 gate/patch-work/tester 的 Pipeline 真实 UI run 和飞书入口。

## 2026-05-19 Agent 重构阶段 13：下次启动继续开发入口

- [x] 当前代码侧补强、`sdk_session` 去重修复和 Plan Mode 退出证据补强已提交，提交号分别为 `328b3c96`、`46e62a75` 与 `acc769f1`。
- [x] 历史记录：当时默认 Agent 对话仍走旧 Orchestrator 主循环；`agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 当时均不能默认开启。
- [x] 已完成真实 Electron Runner v2：发送、停止、权限 approve、权限 deny。
- [ ] 下一步先补 Runner v2 AskUser 单场景脚本，记录 requestId、`respondAskUser({ requestId, answers })` payload、resolved event、终态和 events JSONL。
- [ ] 再补 Runner v2 Plan Mode 单场景脚本，记录 `plan_mode_entered`、`respondExitPlanMode({ requestId, action })`、`plan_mode_exited` 或阻塞原因，并恢复 workspace permission mode。
- [ ] 再分项补旧 session resume、同会话并发、附件、additional directory、fork、rewind；每项只跑一个脚本，失败必须 stop 当前 session 并记录阻塞。
- [ ] 再补最小 Pipeline 真实 UI run，复验 human gate、patch-work Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
- [ ] 再检查飞书配置；若 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍不存在，继续记录阻塞，不伪造通过。
- [ ] 收尾前更新 `tasks/todo.md`、`docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md` 和 `docs/agent-refactor/next-session-prompt.md`。
- [ ] 收尾验证至少包括 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。

## 2026-05-19 Agent 重构阶段 13：继续真实证据补跑计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13 baseline 和 next-session prompt。
- [x] 检查 `git status --short`，确认只忽略 `.DS_Store`、`improve/` 与既有阶段 13 文档改动，不纳入无关噪音。
- [x] 单独补跑 Runner v2 AskUser：记录 sessionId、requestId、`respondAskUser({ requestId, answers })` payload、`ask_user_resolved` 和终态；超时必须 stop 并记录阻塞。
- [x] 单独补跑 Runner v2 Plan Mode：记录 `plan_mode_entered`、`respondExitPlanMode({ requestId, action })`、`plan_mode_exited` 或阻塞原因，并恢复 workspace permission mode。
- [x] 分项补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；每项记录 sessionId、输入、终态、events JSONL 证据和阻塞原因。
- [!] 补跑最小 Pipeline 真实 UI run，复验 human gate、patch-work Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定；已启动并 stop，但 150 秒内未到 gate / patch-work / tester，不能标记通过。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在，继续记录飞书阻塞，不伪造通过。
- [x] 更新阶段 13 baseline、development checklist、next-session prompt 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。

## 2026-05-19 Agent 重构阶段 13：继续真实证据补跑 Review

- Runner v2 AskUser 已真实补跑通过：sessionId `436a4963-edc9-4e7f-b5ec-50058ec9ce3b`，requestId `d5e9574f-9811-4bdb-b0f5-0fb61e55c9c3`，`respondAskUser({ requestId, answers })` 后写入 `ask_user_resolved` 与 `run_completed`，最终输出 `stage13 runner v2 askuser ok`。
- Runner v2 Plan Mode 已真实补跑通过：sessionId `8f5ac714-6397-4d0e-94a7-38aa0f9f8696`，requestId `4ebe4e01-d822-4b25-8938-5162a118a259`，`approve_edit` 后写入 `plan_mode_entered -> plan_mode_exited -> run_completed`，workspace permission mode 已恢复 `auto`。
- 真实补跑发现并修复 `plan_mode_exited` 持久化缺口；修复后只在 `approve_auto` / `approve_edit` 写退出事件，`deny` / `feedback` 不写，避免 replay 错误关闭 plan mode。
- 旧 session resume 已补跑：旧会话 `0ec2d089-e052-4d20-9ed6-57746cf4ac29` 无 runtime manifest，Runner v2 复用旧 cwd 与 `sdkSessionId=d4de1bc5-93d6-46bd-bb6f-6450ad95e8e2`，终态 `run_completed`。
- 同会话并发、附件保存、additional directory、fork、rewind 均已形成最小真实证据；详见 stage-13 baseline。
- 最小 Pipeline v2 真实 run 已尝试：sessionId `e4012949-23ff-417f-ae73-1febd99800b1`，150 秒停留 `explorer/running`，stop 后 stream/records 写入 `terminated`；未到 human gate / patch-work / tester，不能标记通过。
- 飞书配置仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。
- 已将 `@codeinsights/electron` 升到 `0.0.92` 并同步 `bun.lock`。
- 收尾验证已通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`（42 pass）；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`（81 pass）；`git diff --check`。
- 当前仍不能默认开启 Runner v2；Watchdog、Teams auto-resume 和 Pipeline 深水位真实 run 后续均已补齐，剩余阻塞是飞书入口缺配置，以及默认化本身仍需单独计划和回归验证。

## 2026-05-19 Agent 重构阶段 13：Watchdog / Pipeline 深水位补证计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13 baseline 和 next-session prompt。
- [x] 检查 `git status --short`，确认当前只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音，不纳入阶段提交。
- [x] 定位旧 Agent 主循环 Watchdog、Teams auto-resume 逻辑，明确 Runner v2 已覆盖、未覆盖或需补测试的边界。
- [x] 在不默认开启 `agentRuntimeRunnerV2` 的前提下补齐 Watchdog 与 Teams auto-resume 等价证据；Runner v2 复用 `TeamsCoordinator` 并补聚焦测试。
- [!] 补跑可进入 human gate / patch-work / tester 的最小 Pipeline 真实 UI run；本轮 Electron 启动后立即退出，未建立 CDP，不能标记通过。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在，继续记录飞书阻塞，不伪造通过。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`、`docs/agent-refactor/next-session-prompt.md` 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。
- [x] 阶段 13 本轮补证完成后单独提交，只包含阶段 13 相关文件，不纳入 `.DS_Store`、`improve/` 或无关改动：`b3d0517e fix(agent): 补强阶段13 Watchdog 与 Teams auto-resume 证据`。

## 2026-05-19 Agent 重构阶段 13：Watchdog / Pipeline 深水位补证 Review

- Runner v2 已补上 Watchdog / Teams auto-resume 等价回路：`InProcessAgentRuntimeRunner` 复用 `TeamsCoordinator`，捕获 `sdkSessionId` 后同步给 coordinator，Teams 活跃时延迟 result，resume 后再推送，并通过 legacy lifecycle 回调保持 `waiting_resume` / `resume_start` UI 副作用。
- 新增聚焦证据：Teams auto-resume 使用 summary fallback 在同一 SDK session 继续 query；Watchdog 检测 worker idle 后退出挂起 query 并收尾。
- 已通过 `bun run typecheck`。
- 已通过 Agent / Runtime / Event Log / Renderer atoms 聚焦测试：`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/teams-coordinator.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`（50 pass）。
- 已通过 Pipeline 聚焦测试：`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`（81 pass）。
- 飞书配置仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。
- Pipeline 真实 UI 深水位仍阻塞：`bunx electron . --remote-debugging-port=9334` 启动后立即退出，仅输出配置目录日志，`127.0.0.1:9334/json/version` 无法连接；未能进入 human gate / patch-work / tester，不能伪造通过。
- 已将 `@codeinsights/electron` 升到 `0.0.93` 并同步 `bun.lock`。

## 2026-05-18 Agent 重构阶段 12：真实交互补跑与 Runner v2 默认化准备计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 0 baseline 和阶段 11 Review。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 启动 Electron 桌面壳，确认可用 Agent 兼容渠道/API Key；若无法启动或缺少渠道，明确记录阻塞。
- [~] 补跑 Agent 发送、停止、同会话并发、旧 session resume；已补跑发送和 pending-stop，同会话并发/旧 session resume 未完整重跑。
- [x] 补跑权限 approve / deny、AskUser、Plan Mode 进入与退出。
- [!] 补跑附件、additional directory、fork、rewind；本轮未完整跑模型闭环，继续记录为后续缺口。
- [x] 补跑 materialized runtime 下 `rv_host` 只读 MCP 工具真实可见性。
- [!] 补跑 Skill / Plugin snapshot 在真实 Agent 对话中的可见性；本轮未单独证明 Skill / Plugin snapshot 被模型实际使用。
- [!] 补跑飞书入口和飞书群聊 MCP；本机缺少 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`，明确阻塞，不伪造通过。
- [!] 补跑最小 Pipeline 真实运行，确认 Pipeline UI、human gate、patch-work 防护仍正常；本轮未启动新 Pipeline 真实任务，继续依赖聚焦测试。
- [x] 开启 feature flag 做对照评估：`agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 是否具备默认开启条件。
- [x] 若发现 Runner v2 缺口，优先记录并补测试，不直接删除旧 Agent 主循环。
- [x] 更新 `docs/agent-refactor/baseline-runs/` 新一轮证据、`docs/agent-refactor/development-checklist.md` 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Renderer / Pipeline 聚焦测试、`git diff --check`。
- [x] 阶段 12 验证通过后单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动。

## 2026-05-18 Agent 重构阶段 12：真实交互补跑与 Runner v2 默认化准备 Review

- 已新增真实交互证据：`docs/agent-refactor/baseline-runs/2026-05-18-stage-12.md`。
- Electron 桌面壳通过 Vite + `bunx electron . --remote-debugging-port=9333` 启动成功，主进程 runtime init / IPC / workspace watcher 正常；通过 CDP 调用 preload API 补跑真实交互。
- 默认旧 Agent 主循环发送成功：`c098927b-114c-4f74-8c75-ee7f258b9a27` 写入 SDK JSONL 和 events JSONL，终态 `completed`。
- 权限 approve / deny 已补跑：`d16ec854-899d-4993-bca4-d78585d368bb` 批准写入成功，`6a317c0b-132e-4ed4-8686-9b9e2fd4fab0` 显式拒绝后 result `permission_denials` 非空。
- AskUser 已补跑：`14ace8a5-b218-435f-9be5-fcec8fe673f9` 触发 `AskUserQuestion`，pending askUsers 可恢复，回答后写入 resolved；后续触发 MCP 权限后已 stop 清理 pending。
- Plan Mode 已补跑：`674ab67a-c2ab-40c8-9e7a-8315e21e9489` 触发 `ExitPlanMode` pending 和 `plan_mode_entered`，已用 deny 清理并恢复 workspace permission mode 为 `auto`。
- materialized runtime 的 `rv_host` MCP 真实可见：权限队列中出现 `mcp__rv_host__codeinsights_list_workspace_files`，events JSONL 写入 `tool_started` / `permission_requested`。
- 发现并修复 pending-stop 缺口：旧主循环在 SDK iterator 因 stop 正常结束时未写 `run_stopped`；已在正常完成前检查 stopped session 并补写终态，同时避免 inactive session stop 留下 stale `stoppedBySessions`。
- 代码审查后追加修复 Runner v2 同类缺口：`runWithRuntimeRunnerV2()` 在 runner 正常结束后也会复验 active session，被 stop 时补写 `run_stopped` 并发送 `stoppedByUser` completion。
- 修复后真实复验：`2b0bc1d5-e914-4194-86ed-d4f473fc28d1` pending 权限 stop 后 events JSONL sequence 7 写入 `run_stopped(reason=user_abort, stoppedBy=user)`，pending 清空。
- Runner v2 真实最小发送通过：`03281fb6-648b-438b-8616-370a3a2140a8` 在 `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=1` 下完成，日志确认切到 `InProcessAgentRuntimeRunner`。
- 不默认开启 feature flag：`agentRuntimeRunnerV2` 缺少自动重试、Watchdog、Teams auto-resume、typed error 持久化等完整等价证据；Pipeline Runner v2 缺真实 Pipeline UI run；Channels v2 缺飞书配置。
- 飞书真实入口阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，未伪造通过。
- 未完整补跑：附件、additional directory、fork、rewind、最小 Pipeline 真实 UI run、Skill / Plugin snapshot 实际模型使用；均已记录为后续缺口。
- 已将 `@codeinsights/electron` 升到 `0.0.89`；本轮 `bun.lock` 无 diff。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`（37 pass）；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`（81 pass）；`git diff --check`。

## 2026-05-18 Agent 重构阶段 11：清理旧路径计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查阶段 0 真实交互缺口，确认阶段 11 不能清理尚未人工补跑的发送、停止、权限、AskUser、Plan Mode、附件、additional directory、fork、rewind、MCP、飞书关键路径。
- [x] 梳理 Orchestrator / Pipeline / Renderer / shared runtime event 中 legacy reducer、重复 SDK env、重复 SDK query 包装的当前落点。
- [x] 清理已验证的重复 SDK env 导出与测试入口，确保 Orchestrator 与 Pipeline 统一使用 `agent-sdk-env.ts`。
- [x] 瘦身 Renderer legacy reducer/shadow compare 的重复转换逻辑，但保留旧 session、transcript/debug、副作用、pending permission、AskUser、Plan Mode 和回滚兼容路径。
- [x] 复核 shared runtime event adapter，确认本阶段不删除公共导出的旧 `AgentEvent` adapter，避免改变 `AgentStreamEnvelope` / `AgentRuntimeEvent` 公共契约与测试对照。
- [x] 保留 `agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 默认关闭回滚点，不改变 Agent / Pipeline / 飞书 / Renderer UI 可见行为。
- [x] 补充或调整 Agent Runtime Runner / Event Log / Pipeline Node Runner / Renderer atoms 聚焦测试。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Pipeline / Renderer 相关聚焦测试、`git diff --check`。
- [!] 尽量补跑阶段 0 核心真实交互；本轮未启动 Electron 桌面壳，缺少真实渠道/API 交互上下文，无法补跑发送、停止、权限 approve/deny、AskUser、Plan Mode、MCP、飞书和 Pipeline UI。
- [x] 阶段 11 验证通过后单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动。

## 2026-05-18 Agent 重构阶段 11：清理旧路径 Review

- 已删除 `useGlobalAgentListeners.ts` 中硬编码 runtime envelope reducer 后不再可达的旧 reducer fallback；Renderer 流式 view model 继续由 `AgentStreamEnvelope` reducer 驱动。
- 已删除 Renderer 端 shadow compare 投影和 `console.debug` 差异输出，保留主进程 event log shadow compare 作为迁移诊断安全网。
- `payloadToLegacyEvents()` 仍保留为副作用适配层，用于文件自动定位、后台任务、权限/AskUser/ExitPlanMode 队列、Plan Mode、提示建议和通知；未清理尚未人工补跑的关键交互路径。
- `agent-orchestrator/sdk-environment.test.ts` 改为从统一 `agent-sdk-env.ts` 入口导入 `buildSdkEnv()` / `resolveSDKCliPath()`；Orchestrator 与 Pipeline 仍共用同一个 SDK env/CLI 解析实现。
- 未删除 Agent 主循环旧 `adapter.query()` 路径：该路径仍承载自动重试、Watchdog、Teams auto-resume、typed error 持久化和现有 UI `sdk_message` 推送。
- 未删除 Pipeline legacy adapter、shared `adaptAgentEventToRuntimeEvent()` 或旧 session transcript 兼容；这些仍是默认关闭 feature flag、测试对照或旧数据读取的回滚点。
- 已将 `@codeinsights/electron` 升到 `0.0.88`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/renderer/atoms/agent-atoms.test.ts apps/electron/src/main/lib/agent-orchestrator/sdk-environment.test.ts packages/shared/src/agent/runtime-events.test.ts`；`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`。
- `bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/pipeline-node-runner.test.ts` 组合运行时复现既有 Bun/Electron named export 问题；同一批中 Pipeline Node Runner 与 Runtime Runner 测试先通过，event log 已单独通过。
- 人工验证缺口：本轮未启动 Electron 桌面壳补跑真实交互，因此阶段 0 的实时交互缺口继续保留。

## 2026-05-18 Agent 重构阶段 10：Pipeline 复用 Runner 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store`、`improve/` 与已有文档改动为无关噪音，不纳入阶段提交。
- [x] 梳理 `pipeline-node-runner.ts` 与 `agent-runtime-runner.ts` 的 SDK env / SDK query / event contract 重复边界。
- [x] 为 `AgentRuntimeRunInput` 增加 pipeline metadata，能区分 pipeline `nodeId`、pipeline session 和 run context，不破坏 Agent 路径。
- [x] 增加 `agentRuntimePipelineRunnerV2` feature flag，默认关闭，保留旧 `pipeline-node-runner.ts` 路径可快速回滚。
- [x] 迁移 Pipeline 节点的 SDK env / SDK query 重复逻辑到 Runner 复用路径。
- [x] 保留 Pipeline 独立状态管理、LangGraph checkpoint、human gate、结构化输出 schema、patch-work 写入防护和现有 UI 行为。
- [x] 不把 Pipeline 结构化输出强塞进通用 Agent UI；Pipeline 只消费自身节点结果。
- [x] 补充 Pipeline / Runner 聚焦测试，覆盖 metadata 透传、结构化输出解析、runtime 失败映射和 delta/message 去重。
- [!] 尽量人工跑一个最小 Pipeline；本轮未启动 Electron 桌面壳，缺少真实渠道/API 交互上下文，无法证明真实最小 Pipeline。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行 `bun run typecheck`、聚焦测试、`git diff --check`，并单独提交阶段 10。

## 2026-05-18 Agent 重构阶段 10：Pipeline 复用 Runner Review

- 已为 `AgentRuntimeRunInput` 增加可选判别联合 metadata；Pipeline 传入 `origin: "pipeline"`、pipeline session、nodeId、nodeRunId、version 和 reviewIteration，Agent 路径不传 metadata。
- `ClaudePipelineNodeRunner` 新增 `agentRuntimePipelineRunnerV2` feature flag，默认关闭；开启后 Claude Pipeline 节点通过 `InProcessAgentRuntimeRunner` 执行 SDK query，关闭时仍走旧 adapter query 路径。
- `pipeline-node-runner.ts` 复用 `agent-sdk-env` 的 `buildSdkEnv()` / `resolveSDKCliPath()`，移除本地重复 SDK env / CLI path 实现。
- Pipeline 的 checkpoint、human gate、PipelineStreamEvent、结构化 schema、patch-work 文档写入、tester 证据保守判定和 v2 read-only 工具策略保持独立，未进入通用 Agent UI。
- 修复代码审查指出的 runtime delta 与完整 assistant message 重复合并风险；默认 Runner 延迟动态加载，只在 feature flag 开启路径创建。
- 已将 `@codeinsights/electron` 升到 `0.0.87`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`git diff --check`。
- 人工验证缺口：本轮未启动 Electron 桌面壳补跑真实最小 Pipeline；真实渠道/API 与 Pipeline UI 交互仍保留为后续可用环境验证项。

## 2026-05-18 Agent 重构阶段 9：External Channel Adapter 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 梳理现有 `agent-service` / `agent-orchestrator` / `feishu-bridge` 入口，确认阶段 9 只新增 External Channel Adapter，不做 Pipeline 复用、不清理旧路径。
- [x] 新增 `AgentChannel` / channel adapter 抽象，入口统一消费 `AgentStreamEnvelope`，不直接解析 SDKMessage 内部结构。
- [x] 新增 Electron channel adapter，保持桌面 UI 当前 `AgentStreamEnvelope` 消费路径和可见行为不变。
- [x] 新增 Feishu channel adapter 或最小接入层，复用同一 runtime runner / event contract；飞书输出采用 assistant delta 节流、run completed 最终 Markdown 拼接、权限请求默认 queue_to_desktop。
- [x] 定义 channel session binding store，使用本地 JSON / JSONL，不引入数据库。
- [x] 支持 channel-scoped MCP overlay 作为 run overlay，不写入 workspace manifest。
- [x] 用 `agentRuntimeChannelsV2` feature flag 保留旧 Feishu bridge 回滚路径，客户端 UI 零可见变化。
- [x] 补充 channel adapter / binding store / Feishu adapter fixture 聚焦测试。
- [!] 尽量人工补跑 Electron Agent 发送与飞书入口；当前未启动 Electron 桌面壳，且本机不存在 `~/.codeinsights/feishu.json`，无法补跑真实飞书入口。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行 `bun run typecheck`、聚焦测试、`git diff --check`，并单独提交阶段 9。

## 2026-05-18 Agent 重构阶段 9：External Channel Adapter Review

- 已新增 `agent-channel.ts`，定义 `AgentChannel`、`AgentChannelRunContext`、`agentRuntimeChannelsV2` feature flag 和 `ElectronAgentChannel`；桌面端仍发送原有 IPC payload，Renderer 消费路径、UI 布局、样式、文案和交互不变。
- 已新增 `agent-channel-binding-store.ts`，使用 `~/.codeinsights/agent-channel-bindings.json` 与 `agent-channel-bindings.events.jsonl` 保存 channel session binding 和审计事件，不引入数据库。
- 已新增 `feishu-channel-adapter.ts`，只消费 `AgentStreamEnvelope`：assistant delta 节流输出，`run_completed` 拼接最终 Markdown，`permission_requested` 默认 `queue_to_desktop`，不自动 approve、不默认 bypass。
- `feishu-bridge.ts` 保留旧 bridge 路径；只有 `CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2=1` 时才切到 Feishu channel adapter。群聊 `feishu_chat` MCP 仍作为 `customMcpServers` run overlay 传入，不写 workspace manifest。
- 飞书绑定创建、切换、设置页更新、加载与移除会同步写入 channel binding store；旧 `feishu-bindings-{botId}.json` 仍保留给现有 UI 和回滚路径。
- 已将 `@codeinsights/electron` 升到 `0.0.86`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-channel-binding-store.test.ts apps/electron/src/main/lib/feishu-channel-adapter.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`git diff --check`。
- 人工验证缺口：本轮未启动 Electron 桌面壳补跑真实 Agent 发送；本机不存在 `~/.codeinsights/feishu.json`，无法补跑真实飞书入口和权限 pending。未伪造通过，继续记录为后续可用环境验证项。

## 2026-05-18 Agent 重构阶段 8：Renderer 切新 Reducer 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，`development-checklist.md` / `next-session-prompt.md` / `tasks/todo.md` 已有阶段 7 状态同步改动。
- [x] 梳理 `useGlobalAgentListeners` 与 `agent-atoms.ts` 的旧 `AgentEvent` 应用路径，确认阶段 8 只切 Renderer reducer/event source，不改 UI 组件、布局、样式、文案或交互。
- [x] 新增或补强 `AgentStreamEnvelope` 到 Renderer view model 的 reducer/helper，保持 `SDKMessageRenderer` transcript/debug 兼容路径。
- [x] 在 `useGlobalAgentListeners` 中接入受 feature flag 控制的新 envelope 应用路径，旧 payload / 旧 session / 旧 SDKMessage JSONL 继续兼容。
- [x] 恢复 pending permission、AskUser 与 plan mode 状态时优先使用 event log/envelope，可用旧数据源兜底。
- [x] 保留短期 shadow compare，新旧 view model 差异只写开发日志，不在 UI 展示。
- [x] 补充 event replay / Renderer view model 对比聚焦测试，覆盖 assistant text、tool timeline、pending permission、AskUser、plan mode、usage、running/terminal status。
- [ ] 尽量补跑阶段 0 关键真实交互：发送、停止、权限 approve/deny、AskUser、Plan Mode、旧 session resume；无法补跑时记录原因。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行 `bun run typecheck`、聚焦测试、`git diff --check`，并单独提交阶段 8。

## 2026-05-18 Agent 重构阶段 8：Renderer 切新 Reducer Review

- 已在 `agent-atoms.ts` 新增 runtime envelope reducer helper，继续输出原有 `AgentStreamState`，因此 Agent UI 组件、布局、样式、文案和按钮行为不变。
- `useGlobalAgentListeners` 现在优先把 stream payload 适配为 `AgentStreamEnvelope` 并应用新 reducer；旧 `payloadToLegacyEvents()` 保留给副作用、transcript/debug 兼容和回滚。
- `AgentRuntimeReplayState` 现在保留原始 permission / AskUser / ExitPlanMode request，可从 event log/envelope 恢复 pending 横幅状态；Plan Mode active 状态也进入 replay。
- 短期 shadow compare 仅写 `console.debug`，不在 UI 展示。
- 已将 `@codeinsights/shared` 升到 `0.1.40`，`@codeinsights/electron` 升到 `0.0.85`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts`；`git diff --check`。
- 本轮未启动 Electron 桌面壳补跑真实交互，因此发送、停止、权限 approve/deny、AskUser、Plan Mode、旧 session resume 仍按阶段 0 缺口继续保留。

下一次开发应从阶段 9 开始：External Channel Adapter。阶段 8 已让 Renderer 主路径优先消费 runtime envelope，旧 transcript/debug 兼容路径继续保留。继续保持客户端 UI 零可见变化，默认不切换 Agent 对话可见行为。

## 2026-05-18 Agent 重构阶段 7：内置 MCP Bridge 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查现有 runtime manifest registry / materializer / orchestrator 接入点，确认阶段 7 只新增 host bridge 能力，不切 Renderer、不默认启用 Runner v2。
- [x] 新增 `agent-host-mcp-server.ts`，定义内置 host bridge tool manifest 与保守 tool handler 边界。
- [x] 实现 `codeinsights_workspace_search`、`codeinsights_list_workspace_files`、`codeinsights_open_file`，限定 workspace/session/additional directory 可读范围，避免越权路径访问。
- [x] 实现 `codeinsights_memory_search`、`codeinsights_memory_append`，复用现有 memory service 或本地 JSON 存储能力，写入行为保持可审计。
- [x] 实现 `codeinsights_send_channel_message`、`codeinsights_schedule_task` 的保守默认策略，缺少真实外部渠道/调度器时返回明确不可用结果，不默认绕过权限或伪造发送。
- [x] 将 host bridge 能力写入 runtime manifest / materializer，并暴露为 materialized workspace runtime 的 MCP server 配置。
- [x] 补充 host MCP bridge / tool handlers 聚焦测试，覆盖路径安全、只读搜索、memory append、不可用 channel/task 行为和 manifest/materializer 输出。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行 `bun run typecheck`、聚焦测试、`git diff --check`，并单独提交阶段 7。

## 2026-05-18 Agent 重构阶段 7：内置 MCP Bridge Review

- 已新增 `apps/electron/src/main/lib/agent-host-mcp-server.ts`，实现 `rv_host` in-process MCP server，以及 `codeinsights_workspace_search`、`codeinsights_list_workspace_files`、`codeinsights_memory_search`、`codeinsights_open_file`、`codeinsights_memory_append`、`codeinsights_send_channel_message`、`codeinsights_schedule_task` handlers；默认 hostBridge 只注册只读工具。
- 文件类工具只读取 manifest 允许的 session cwd、workspace-files 和 additional directory，拒绝范围外路径、符号链接逃逸、非文本文件和过大文件。
- 记忆工具复用 `getMemoryConfig()`、`searchMemory()`、`addMemory()`、`formatSearchResult()`；未启用记忆或缺少 API Key 时返回明确错误。
- channel 发送与任务调度工具默认保守返回不可用，只有未来显式注入 adapter 后才执行 side effect，且不在默认 hostBridge 工具清单中注册；没有默认 bypass 权限。
- `agent-runtime-manifest-registry.ts` 现在用只读默认工具列表生成 manifest，记录 `version` / `configHash`，并把 `hostBridge` 纳入 source/runtime hash；`agent-runtime-materializer.ts` 写入 `runtime/.claude/codeinsights-host-bridge.json` 作为运行时审计元数据，恢复已物化 session 时会校验该产物未被篡改。
- `agent-orchestrator.ts` 仅对 materialized session 注入 `rv_host` MCP server；event log / Runner v2 会记录同一个 manifest `runtimeHash`，并拒绝外部 `customMcpServers` 覆盖内置 `rv_host`。旧 session、Renderer、布局、文案、交互路径和 `agentRuntimeRunnerV2` 默认关闭状态均未改变。
- 已将 `@codeinsights/electron` 升到 `0.0.84`、`@codeinsights/shared` 升到 `0.1.39`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-host-mcp-server.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-runtime-materializer.test.ts`；`git diff --check`。
- 本轮未启动 Electron 桌面壳或真实 Claude Code MCP 会话，因此真实 MCP 可见性、只读工具/side effect 工具的人工调用和权限 UI 仍记录为后续补跑缺口。

## 2026-05-18 Agent 重构阶段 6：插件系统原生化计划

- [x] 复习 `tasks/lessons.md`、Agent 重构文档、事件契约、runtime manifest 设计和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 梳理阶段 4/5 manifest registry 与 materializer 中现有 plugin 读取、snapshot、hash 边界，确认阶段 6 不改变 Renderer、不默认启用 Runner v2。
- [x] 新增 plugin catalog 类型与 enabled plugin refs 配置，支持 workspace 本地 Claude Code plugin 引用。
- [x] 实现 plugin snapshot materializer，记录 plugin source path、snapshot path、hash，snapshot 失败时阻断而不是 fallback 到用户全局 plugin。
- [x] 建立 plugin command 索引，区分 DMI slash command 与非 DMI plugin command。
- [x] 实现 DMI slash command 应用层展开能力；非 DMI command 保留给 SDK 原生处理。
- [x] 补充 plugin catalog / materializer / snapshot / command index 聚焦测试，并记录人工启用/禁用本地 plugin 或未补跑原因。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行验证并单独提交阶段 6。

## 2026-05-18 Agent 重构阶段 6：插件系统原生化 Review

- 已新增 `packages/shared/src/agent/runtime-manifest.ts` 的插件扩展字段：`AgentPluginCatalogEntry`、`AgentPluginEnabledRef`、`AgentPluginCommandIndexEntry`，以及增强后的 `AgentRuntimeManifestPlugin`。
- 已新增 `apps/electron/src/main/lib/agent-plugin-catalog.ts` 与聚焦测试，支持从 `config.json` 读取 plugin catalog / enabled refs，导入本地 Claude Code plugin，生成 runtime snapshot，记录 source path / snapshot path / hash，并建立 command index。
- DMI slash command 现在在应用层展开，非 DMI command 保留给 SDK；插件 snapshot 失败会直接阻断，不会 fallback 到用户全局 plugin 目录。
- `agent-runtime-manifest-registry.ts` 现在把 plugin snapshot 作为 manifest 的一部分输出，`agent-runtime-materializer.ts` 负责落盘 runtime plugin snapshot 与 `enabledPlugins` settings。
- `agent-orchestrator.ts` 在已有 runtime manifest 的 session 下复用 materialized runtime；新 session 无 manifest 时先物化，再将 `queryOptions.plugins` 指向 RV snapshot，旧 session 继续走原 workspace plugin 路径，Renderer 和默认 Runner 路径没有变化。
- 代码审查后修复了两个关键风险：新 session runtime 分支判定反向、DMI slash command 展开读取 source 而不是 snapshot；并补充 snapshot 优先读取与 `config.json` symlink 防护测试。
- `@codeinsights/shared` 已升到 `0.1.38`，`@codeinsights/electron` 已升到 `0.0.83`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-plugin-catalog.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-runtime-materializer.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`；`git diff --check`。
- 人工启用/禁用本地 plugin 已通过聚焦测试覆盖；当前环境未单独跑 Electron 桌面壳，故真实桌面交互未补跑，已记录为后续缺口。

## 2026-05-18 Agent 重构阶段 5：Runtime Materializer for New Sessions 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构文档、事件契约、runtime manifest 设计和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 新增 Runtime Materializer，基于阶段 4 manifest 只对新建 session 物化 `runtime/` 与 `sessions/{session-id}/cwd`。
- [x] 写入 `runtime/.claude/settings.json`、`runtime/mcp.json`、`runtime/CLAUDE.md`、Skill snapshot、plugin snapshot 和 session `runtime-manifest.json`。
- [x] 实现 settings 白名单合并：只管理允许 key，白名单 key 冲突时写 `.codeinsights-conflicts.json` 并阻断 run。
- [x] 在 session 创建与 Orchestrator cwd 选择处接入：存在 session runtime manifest 的新 session 使用 `sessions/{id}/cwd`，旧 session 保持旧 cwd / resume 行为。
- [x] 补充 materializer / manifest write / settings conflict / path safety / 旧 session cwd 兼容聚焦测试。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行验证并单独提交阶段 5。

## 2026-05-18 Agent 重构阶段 5：Runtime Materializer for New Sessions Review

- 已新增 `agent-runtime-materializer.ts`，负责新 session runtime 物化：`runtime/.claude/settings.json`、`runtime/mcp.json`、`runtime/CLAUDE.md`、`runtime/.claude/skills/*`、`runtime/.claude/plugins/*`、`sessions/{session-id}/cwd/.context` 和 `sessions/{session-id}/runtime-manifest.json`。
- `createAgentSession()` 现在会在写入 session index 前 materialize runtime；如果 settings 冲突或路径不安全，创建会话会失败，不留下 session metadata。
- Orchestrator 运行时只在发现 `sessions/{session-id}/runtime-manifest.json` 时切到 `sessions/{session-id}/cwd`；旧 session 没有 manifest，继续使用旧 `agent-workspaces/{slug}/{sessionId}` cwd 和原 resume 逻辑。
- settings 合并只管理白名单字段；冲突会写入 `runtime/.claude/.codeinsights-conflicts.json` 并通过 preflight error 阻断 run。
- materialized runtime 判定会校验 manifest 普通文件、sessionId、workspaceSlug、sessionCwd 和 manifest path，避免旧 session 被残留文件误切到新 cwd。
- materializer 同时写入 runtime settings 与实际 SDK project settings；Orchestrator 对 materialized session 跳过旧 settings 写入 block，避免绕过冲突检查。
- 路径安全覆盖 runtime 写入目标 symlink 拒绝，Skill / plugin snapshot 均保持在 workspace root 内；fork 复制源 cwd 时会递归跳过任意层级 symlink；additional directories 仍只记录引用，不复制。
- 本阶段没有改 Renderer、UI 样式、文案、入口或交互路径；没有默认启用 Runner v2。
- 已将 `@codeinsights/shared` 升到 `0.1.37`，`@codeinsights/electron` 升到 `0.0.82`，并同步 `bun.lock`。
- 代码审查发现并已修复：manifest 存在性误判、session cwd project settings 覆盖风险、fork 源 cwd symlink 递归复制风险，并补充对应回归测试。
- 验证通过：`bun test apps/electron/src/main/lib/agent-runtime-materializer.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-session-manager-copy.test.ts`；`bun run typecheck`；`git diff --check`。
- 本轮未启动 Electron 桌面壳补跑真实新/旧 session；旧 session cwd / resume 兼容以路径 fixture 覆盖，并在开发清单中记录为真实交互缺口。

## 2026-05-18 Agent 重构阶段 4：Runtime Manifest 只读解析计划

- [x] 复习 `tasks/lessons.md`、Agent 重构阶段文档、事件契约、runtime manifest 设计和阶段 0 基线。
- [x] 梳理现有 workspace 路径、MCP、skills、plugin manifest、attached directories 读取边界，确认只读解析不改变 cwd / UI / 运行路径。
- [x] 新增 Runtime Manifest 类型与只读 feature flag，默认关闭运行时切换。
- [x] 新增 Workspace Runtime Registry，只从旧 workspace 配置生成 manifest 快照、source hash、runtimeHash 和能力列表，不物化 runtime 目录。
- [x] 加固路径安全：已存在路径段拒绝 symlink，manifest 内部路径必须保持在 workspace root 内，additional directories 只保存引用。
- [x] 补充单元测试，覆盖旧 mcp.json、skills、plugin manifest、attached directories、缺失配置、hash 稳定性和 symlink traversal 拒绝。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行验证并单独提交阶段 4。

## 2026-05-18 Agent 重构阶段 4：Runtime Manifest 只读解析 Review

- 已新增 `packages/shared/src/agent/runtime-manifest.ts`，定义 `AgentRuntimeManifest`、MCP / Skill / Plugin / additional directory manifest 类型，以及默认关闭的 `agentRuntimeManifestV1` feature flag。
- 已新增 `apps/electron/src/main/lib/agent-runtime-manifest-registry.ts`，只读解析旧 workspace 的 `mcp.json`、`skills/`、`skills-inactive/`、`.claude-plugin/plugin.json` 和 `config.json.attachedDirectories`，生成 source hash / runtime hash / 能力快照。
- `skills-inactive/` 只参与 source hash，不进入 `enabledSkills`；additional directories 只保存引用，不复制、不物化。
- 路径安全已覆盖 workspace 内路径边界、workspace slug traversal、plugin name traversal、已存在路径段 symlink 拒绝、realpath 复验、入口文件 symlink、nested Skill symlink 和 `skills-inactive` symlink fixture。
- 本阶段未创建 runtime 目录、未写 manifest 文件、未改变 cwd / Runner / Orchestrator / Renderer；客户端 UI 零可见变化。
- 已将 `@codeinsights/shared` 升到 `0.1.36`，`@codeinsights/electron` 升到 `0.0.81`，并同步 `bun.lock`。
- 代码审查发现并已修复 shared barrel 顶层 `process`、workspace slug traversal 和 plugin snapshot path 风险。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts`（9 pass）；`git diff --check`。
- 当前未启动 Electron 桌面壳人工打开旧 workspace / old session；阶段 4 只读 registry 未接入运行路径，该真实交互仍作为后续补跑缺口记录。

## 2026-05-18 Agent 重构阶段 3：In-process AgentRuntimeRunner 下一步计划

- [x] 先复习 `tasks/lessons.md`、`docs/agent-refactor/development-checklist.md`、`event-contract.md` 和阶段 0 基线。
- [x] 新增 `agent-runtime-types.ts`，定义 Runner 输入、输出、store interface、权限/AskUser callback。
- [x] 新增 `agent-runtime-runner.ts`，把 SDK query 封装为进程内 Runner，输出 `AsyncIterable<AgentStreamEnvelope>`。
- [x] 新增 `agent-sdk-env.ts` 与 `agent-sdk-message-converter.ts`，迁移 env 构建和 SDKMessage 转换边界。
- [x] 用 `agentRuntimeRunnerV2` feature flag 接入 Orchestrator，保留旧 SDK query 路径作为回滚。
- [x] 补充 Runner mock SDK stream 测试，覆盖发送、停止、resume、权限、AskUser、错误终态。
- [x] 保持 Renderer 旧路径和客户端 UI 零可见变化。
- [x] 完成后更新 `docs/agent-refactor/development-checklist.md` 和本文件 Review，并单独提交阶段 3。

## 2026-05-18 Agent 重构阶段 3：In-process AgentRuntimeRunner Review

- 已新增 `apps/electron/src/main/lib/agent-runtime-types.ts`，定义 `AgentRuntimeRunInput`、`AgentRuntimeRunner`、SDKMessage store interface、权限/AskUser callback，以及默认关闭的 `agentRuntimeRunnerV2` feature flag。
- 已新增 `agent-runtime-runner.ts`，进程内 Runner 负责调用注入的 SDK query、遍历 stream、输出 `AsyncIterable<AgentStreamEnvelope>`、通过 store interface 持久化 SDKMessage，不直接写 IPC 或 Renderer。
- 已新增 `agent-sdk-message-converter.ts`，集中把 SDKMessage 转换为 runtime envelope；已新增 `agent-sdk-env.ts`，把 SDK env / binary 解析边界从 Orchestrator 调整到稳定入口，同时保留旧子模块实现。
- Orchestrator 已在 `queryOptions` 构造后接入 Runner v2 分支；`agentRuntimeRunnerV2` 默认关闭，旧 SDK query / retry / Watchdog / Teams / Renderer 流式路径继续作为默认运行路径和回滚路径。
- Runner mock SDK stream 测试覆盖发送、停止、resume、权限、AskUser 和错误终态。
- 本阶段未修改 Renderer、UI 样式、文案、入口或交互路径；客户端 UI 零可见变化。
- `@codeinsights/electron` patch 版本从 `0.0.79` 提升到 `0.0.80`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`。
- 当前未启动 Electron 桌面壳补跑真实 UI 交互；阶段 3 行为由 Runner mock 和 Orchestrator 既有 completion-signal 测试覆盖，阶段 0 的真实交互缺口仍保留。

## 2026-05-18 Agent 重构阶段 2：Event Log 双写计划

- [x] 复习阶段 0/1 文档与现有 Agent Orchestrator、会话持久化、权限和 AskUser 路径，确认 UI 零可见变化边界。
- [x] 在会话持久化层新增 `{session-id}.events.jsonl` 旁路读写能力，原 SDKMessage JSONL 保持不变。
- [x] 新增 Agent runtime event log writer，负责 runId、per-run sequence、终态去重、schema 校验和开发日志。
- [x] 在旧 Agent 运行路径中双写 `AgentStreamEnvelope`：`run_started`、`sdk_session`、assistant/tool、usage、终态事件。
- [x] 在权限与 AskUser 生命周期中记录 requested/resolved，不改变现有 pending queue 与 UI 行为。
- [x] 新增新旧 reducer shadow compare 的开发日志打桩，保证差异只进主进程日志、不显示到 Renderer。
- [x] 补充 event log / replay 聚焦测试，覆盖终态去重、sequence、权限和 AskUser。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行验证并单独提交阶段 2。

## 2026-05-18 Agent 重构阶段 2：Event Log 双写 Review

- 已新增 `apps/electron/src/main/lib/agent-runtime-event-log.ts`，在旧 Orchestrator 旁边写入 `{session-id}.events.jsonl`，原 SDKMessage `{session-id}.jsonl` 继续保留。
- 每次 run 生成独立 `runId`，同一 run 内 `sequence` 单调递增，并对 `run_completed` / `run_failed` / `run_stopped` 做终态去重。
- 已双写 `run_started`、`sdk_session`、assistant/tool、`usage_updated`、终态事件；权限和 AskUser 的 requested/resolved 已进入 events JSONL。
- shadow compare 当前只写主进程开发日志，检测 sequence 缺口和 replay 终态差异，不向 Renderer 暴露任何调试状态。
- 本阶段未修改 Renderer、UI 样式、文案、入口或交互路径；`STREAM_EVENT` 旧 payload 继续按原路径送到 UI。
- 已将 `@codeinsights/shared` 升到 `0.1.35`，`@codeinsights/electron` 升到 `0.0.79`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`；`git diff --check`。
- 全量 `bun test` 仍在 412 pass 后复现既有 Electron named export 问题：`Export named 'BrowserWindow' not found in module .../electron/index.js`；本阶段相关聚焦测试单独运行通过。
- 本轮未启动 Electron 桌面壳做阶段 0 真实交互补跑；发送/停止通过 Orchestrator 测试覆盖，权限/AskUser 通过 event log 单测覆盖，真实 UI 交互仍作为后续缺口记录。

## 2026-05-18 Agent 重构阶段 1：Shared Event Contract 计划

- [x] 复习阶段 0 基线、事件契约和开发清单，确认本阶段只新增 shared event contract，不改变 Agent 运行行为。
- [x] 在 `packages/shared/src/agent/` 新增 `AgentStreamEnvelope`、`AgentRuntimeEvent`、`AgentRuntimeErrorPayload`、`AgentEventSource` 类型。
- [x] 新增事件 schema guard / validator，覆盖 envelope 基础字段、事件 union 和终态互斥所需的单事件校验。
- [x] 新增旧 `AgentEvent` / `AgentStreamPayload` 到新 envelope 的 adapter，保留旧类型和旧 IPC 默认行为。
- [x] 新增 SDKMessage fixture 与 AgentStreamEnvelope fixture，覆盖 text、tool、permission、AskUser、usage、complete、error。
- [x] 新增 event replay reducer 测试骨架，先验证 sequence 幂等、文本累计、工具状态、pending interaction、usage 和 terminal status 的基础行为。
- [x] 引入 `agentRuntimeEventsV2` feature flag，默认 off，仅作为后续阶段回滚开关。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 阶段 1 状态与验证记录。
- [x] 运行 `bun run typecheck`、`bun test` shared event fixture、`git diff --check`。
- [x] 追加 Review，并单独提交阶段 1 成果。

## 2026-05-18 Agent 重构阶段 1：Shared Event Contract Review

- 已在 `packages/shared/src/agent/runtime-events.ts` 新增 `AgentStreamEnvelope`、`AgentRuntimeEvent`、`AgentRuntimeErrorPayload`、`AgentEventSource`、默认关闭的 `agentRuntimeEventsV2` feature flag。
- 已新增 envelope 创建、schema guard / validator、终态识别、旧 `AgentEvent` / `AgentStreamPayload` / `SDKMessage` 到 runtime event 的 adapter，以及只用于测试和后续 reducer 对齐的 replay reducer 骨架。
- 已新增 `packages/shared/src/agent/runtime-events.test.ts`，fixture 覆盖 text、tool、permission、AskUser、usage、complete、error，并验证 sequence 幂等回放。
- 已通过 `packages/shared/src/agent/index.ts` 和 package root 导出新契约，同时保留旧 `AgentEvent`、旧 `AgentStreamPayload`、旧 renderer reducer 和 IPC 默认行为。
- 已将 `@codeinsights/shared` patch 版本从 `0.1.33` 提升到 `0.1.34`，同步更新 `bun.lock`。
- 本阶段没有修改 `apps/electron` 运行路径、Renderer UI、布局、样式、文案、入口、按钮行为或交互路径。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts`；`bun test packages/shared/src/agent/runtime-events.test.ts packages/shared/src/utils/pipeline-state.test.ts packages/shared/src/utils/capabilities-diff.test.ts`；`bun test apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`；`git diff --check`。
- 全量 `bun test` 曾在 412 pass 后出现一次 test runner / Electron named export 问题：`Export named 'BrowserWindow' not found in module .../electron/index.js`；单独重跑该失败文件通过，本阶段 shared contract 改动未触碰该路径。

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
- 已确认本机开发配置目录为 `~/.codeinsights-dev/`，当前有 1 个 DeepSeek Agent 渠道、1 个默认 workspace、4 条 Agent session metadata、3 个 SDKMessage JSONL transcript。
- 已用存量 JSONL 固化首条消息、错误恢复样例、WebSearch tool activity、result 终态和旧 session 多轮 resume 行为；未记录 API Key、加密密文或完整大段模型输出。
- 当前环境缺少实时 Electron 桌面交互、workspace MCP server、飞书配置和若干权限/AskUser 样例；这些场景没有伪造通过，已作为后续触碰相关边界前必须补跑的缺口记录。
- 已更新 `docs/agent-refactor/development-checklist.md`，标记阶段 0 首轮文本证据完成，并把下一步推进到阶段 1 Shared Event Contract。
- 本轮没有修改 `apps/`、`packages/`、README 或 AGENTS；客户端 UI 零可见变化。
- 验证通过：`bun run typecheck`；`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent 模式 happyclaw 参考重构方案

- [x] 复习项目 `tasks/lessons.md`，确认本次只生成重构方案文档，不直接改业务代码。
- [x] 梳理 CodeInsights 当前 Agent 主链路：IPC、AgentOrchestrator、会话 JSONL、Jotai 全局监听和 UI 展示。
- [x] 梳理 happyclaw 核心理念：复用 Claude Code CLI 运行时、多渠道路由、容器/宿主机运行时、工作区配置、MCP/Skill/插件。
- [x] 在 `docs/agent-refactor/` 下生成重构方案 Markdown，覆盖目标架构、模块边界、迁移阶段、数据模型、验证策略和风险。
- [x] 追加 Review，记录文档范围、依据与残余问题。

## 2026-05-17 Agent 模式 happyclaw 参考重构方案 Review

- 已新增 `docs/agent-refactor/README.md`、`current-state-and-gap.md`、`target-architecture.md`、`migration-plan.md`，形成总览、现状差距、目标架构和阶段迁移路线。
- 方案明确吸收 happyclaw 的核心原则：Claude Code 原生优先、Runner 边界、shared event contract、runtime materialization、内置 MCP bridge；同时明确不照搬 SaaS 认证/RBAC/计费、IM-first 路由、Docker 默认隔离、SQLite 后台。
- 文档依据包括 CodeInsights 的 `AgentView`、preload、agent IPC、`agent-service`、`agent-orchestrator`、`ClaudeAgentAdapter`、`agent-session-manager`、`useGlobalAgentListeners`、`agent-atoms`，以及 happyclaw 的 README、`container-runner`、`container/agent-runner`、`im-channel`、`plugin-utils`、`mcp-tools` 等。
- 本轮未修改业务代码、README 或 AGENTS；仅新增方案文档并更新任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。
- 残余问题：方案尚未进入实现拆分，后续正式编码前需要按阶段确认是否先做 shared event contract，避免一次性大改 AgentOrchestrator 和 Renderer。

## 2026-05-17 Agent 模式重构方案深化计划

- [x] 复核 `tasks/lessons.md` 与现有 `docs/agent-refactor/` 文档，确认本轮继续只做方案文档优化。
- [x] 补充总览文档，明确 happyclaw 理念到 CodeInsights 的取舍、最终交付物和阅读路径。
- [x] 细化现状差距，按模块标注当前职责、问题症状、重构去向和保留边界。
- [x] 细化目标架构，补齐事件契约、Runner 输入输出、runtime 目录、权限、MCP bridge、外部渠道和 Pipeline 复用细节。
- [x] 细化迁移路线，补齐每阶段文件范围、测试策略、回滚点、完成定义和风险缓解。
- [x] 运行 Markdown 差异检查，在本节追加 Review。

## 2026-05-17 Agent 模式重构方案深化 Review

- 已将 `docs/agent-refactor/` 从方向性方案补成可执行规格：总览补了阅读路径、最终交付物和取舍规则；现状差距补了职责拆分、待迁移模块和当前行为基线；目标架构补了 `AgentRuntimeService`、`AgentRuntimeRunner`、`AgentRuntimeManifest`、事件契约、权限生命周期、MCP bridge 和 Pipeline 复用边界；迁移路线补了 feature flag、文件范围、fixture 类型、兼容规则、回滚点和双写总规则。
- 本轮重点吸收了 happyclaw 的原则，但把 CodeInsights 必须保留的本地优先、文件存储、保守权限和 Electron UI 体验边界明确写死，避免后续实现时误把 SaaS / IM-first / Docker-first 模型搬进来。
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
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun test apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/components/ui6-view-model.test.ts`；`git diff --check`。
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
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun test apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/components/ui6-view-model.test.ts`，16 pass；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- `build:renderer` 仍有既有的大 chunk warning，本次构建成功；当前环境未打开 Electron 桌面壳做人工截图，残余风险主要是实际窗口里的主观观感与极窄宽度下的视觉密度。

## 2026-05-17 Agent|Pipeline 玻璃感优化计划

- [x] 复核用户截图中顶部模式切换器的视觉问题：比例偏厚、边框和背景发闷、当前态层级不够明确。
- [x] 将 `ModeSwitcher` 重构为紧凑玻璃感分段控件，保留 `Agent | Pipeline` 文案和原切换逻辑。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 Agent|Pipeline 玻璃感优化 Review

- `Agent | Pipeline` 仍保留在展开态左侧栏最上方，切换逻辑未改。
- `ModeSwitcher` 已改成紧凑玻璃感分段控件：半透明外壳、柔和光晕、滑块当前态、图标圆形承托和更小的字号/高度。
- 新增样式集中在 `.mode-switcher-glass` 和其内部 `.mode-slider` / `.mode-btn`，没有扩散到业务组件。
- `@codeinsights/electron` 版本已从 `0.0.77` 提升到 `0.0.78`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。

## 2026-05-17 顶部 Agent|Pipeline 恢复计划

- [x] 复核用户指出的顶部模式切换器缺失问题，确认 `ModeSwitcher` 仅是未渲染而非组件丢失。
- [x] 将 `Agent | Pipeline` 放回展开态左侧栏最上方，并让 `Command Desk` 下移一层。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 顶部 Agent|Pipeline 恢复 Review

- 已恢复展开态左侧栏最上方的 `Agent | Pipeline` 模式切换器，保持原 `ModeSwitcher` 逻辑和视觉样式。
- `Command Desk` 现在位于模式切换器下方，不再替代或遮挡顶部模式入口。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。
- `@codeinsights/electron` 版本已从 `0.0.76` 提升到 `0.0.77`。

## 2026-05-17 左侧栏红框修正计划

- [x] 删除顶部红框中的 `MCP / Skills` 统计卡，避免无意义占位。
- [x] 压缩底部能力行，避免窄侧栏中图标与文字重叠。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 左侧栏红框修正 Review

- 顶部红框中的 `MCP / Skills` 统计卡已直接移除，顶部区域回到原本的命令舱主视觉，不再占据额外高度。
- 底部 `Capabilities` 行已改成更短的中文单行表达，并把内容容器、图标和尾部箭头收紧，避免窄侧栏里文字与图标互相挤压。
- 这次没有改归档、能力配置和用户设置的功能流，只调整侧栏的呈现与响应式占位。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。
- `@codeinsights/electron` 版本已从 `0.0.75` 提升到 `0.0.76`。

## 2026-05-17 左侧栏底部 Dock 紧凑化计划

- [x] 根据用户反馈复核底部 dock 空间占用，确认主要高度来自标题说明、两行副文本、较大 icon 和按钮 padding。
- [x] 去除非必要副说明，将归档与能力条压成单行信息表达，缩小图标、计数胶囊、按钮 padding 和底部外边距。
- [x] 保留归档切换、能力配置、用户设置三类入口，不改变数据流和点击目标。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 左侧栏底部 Dock 紧凑化 Review

- 已将底部 dock 从三段较高的信息卡压缩为更轻的紧凑面板：标题说明被移除，归档与能力入口改为单行排列，按钮高度、图标尺寸、计数胶囊和底部外边距都同步收紧。
- 现在这块区域的视觉重心更集中，仍保留归档切换、MCP / Skills 配置和用户设置入口，但占据的纵向空间明显更少。
- 变更只影响 `LeftSidebar` 底部结构和配套 scoped CSS，没有碰数据流、IPC 或设置逻辑。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。
- `@codeinsights/electron` 版本已从 `0.0.74` 提升到 `0.0.75`。

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
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。
- `@codeinsights/electron` 版本已从 `0.0.73` 提升到 `0.0.74`。
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
- 验证结果：`git diff --check` 通过；`bun run --filter='@codeinsights/electron' build:renderer` 成功完成，仍只有既有的大 chunk warning。全量 `typecheck` 在当前工作区被仓库里一个非侧栏的 `ChatMessages.tsx` 缺失导入问题干扰，当前不在这次侧栏重构范围内。
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
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
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
- 这次改动仍然只碰渲染层视觉与少量版本元数据，没有新增 IPC、atom、存储格式或业务逻辑；`@codeinsights/electron` 版本已从 `0.0.71` 提升到 `0.0.72`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`、聚焦的 sidebar / agent UI model 测试。
- `build:renderer` 仍有既有的大 chunk warning，但构建成功，没有引入新的阻断性错误。
- 由于当前环境没有直接进入 Electron 桌面壳做截图复核，这次结论基于静态构建与代码审查；残余风险主要是纯视觉观感，需要桌面壳里再看一轮最终版式。

## 2026-05-17 Agent Cockpit UI 科幻舱内重塑

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 为 Agent 相关布局补齐更强的 cockpit / mission console 视觉层级，统一全局背景、面板材质和状态光效。
- [x] 重构 AgentHeader、AgentMessages、AgentView 的展示 class，让头部、消息卡、输入区形成一致叙事。
- [x] 让权限横幅与 AskUser 横幅也进入同一视觉系统，避免在新风格里突兀。
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck` 与 `git diff --check`，必要时做浏览器截图验证。
- [x] 在本节追加 Review，记录实现范围、验证结果和残余风险。

## 2026-05-17 Agent Cockpit UI 科幻舱内重塑 Review

- 已将 Agent 相关视觉统一到 cockpit / mission console 语言：头部信息条更像任务舱控制面板，消息卡增加角色色带和更强层次，输入区和权限 / 问答横幅也进入同一材质系统。
- 已新增 `agent-shell-bg`、强化 `agent-cockpit-shell`、`agent-message-card`、`agent-command-deck`、`agent-tool-rail` 等 scoped 样式，保留 reduced-motion 兼容，没有引入新依赖，也没有改 IPC、Jotai atoms 或持久化格式。
- `@codeinsights/electron` 版本已从 `0.0.70` 提升到 `0.0.71`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
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
- 左侧栏宽度持久化为 `codeinsights-app-shell-left-sidebar-width`，Agent / Pipeline 共用；右侧文件面板宽度持久化为 `codeinsights-app-shell-right-panel-width`。
- 宽度约束：左栏 220-420px，右栏 280-520px，并按视口预留主内容最小宽度，避免拖拽把主工作区压到不可用。
- 交互支持鼠标拖拽、双击复位、Enter / Home 复位、方向键调整；handle 使用 `role="separator"` 和中文 `aria-label`。
- 同步让 `PipelineSidebar`、`RightSidePanel`、`SidePanel` 接收外部宽度，避免外层可变但内部仍固定 320px 的空白问题。
- `@codeinsights/electron` 版本 `0.0.68 -> 0.0.69`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`bun test apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.test.ts` 14 pass；`git diff --check`。
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
- `@codeinsights/electron` 版本 `0.0.67 -> 0.0.68`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/components/agent/agent-ui-model.test.ts` 14 pass；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
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
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.test.ts` 11 pass；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- `build:renderer` 仍有既有 chunk size warning，本次构建成功，未作为本次侧边栏 UI 改造阻塞项。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-16 Pipeline Stage Rail Creative UI Refresh 计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 将 `PipelineStageRail` 从朴素卡片网格改为“贡献航线 / Mission Route”视觉，保留现有状态模型和阶段定位行为。
- [x] 为每个阶段增加序号、节点图标、状态徽章、微型进度刻度、hover / focus 反馈，并强化当前运行阶段的 glow / scan / pulse。
- [x] 增加 scoped `pipeline-stage-route-*` CSS utilities，并确保 reduced-motion 下循环动画降级。
- [x] 递增 `@codeinsights/electron` patch 版本并同步 `bun.lock` workspace metadata。
- [x] 运行 Pipeline 聚焦测试、typecheck 和 `git diff --check`。
- [x] 在本节追加 Review，说明改动、验证和残余风险。

## 2026-05-16 Pipeline Stage Rail Creative UI Refresh Review

- 已完成红框区域改造：`PipelineStageRail` 现在使用 Mission Route / 贡献航线布局，阶段卡片包含节点图标、两位序号、状态 icon、状态徽章和微型进度刻度；当前阶段具备 glow、扫描高光和脉冲节点。
- 状态来源保持不变：继续使用 `buildPipelineStageViewModels` 的 `done / active / waiting / failed / stopped / todo`，点击阶段定位记录的行为未改变。
- 新增 CSS 均为 scoped `pipeline-stage-route-*` utility，动画使用 opacity / transform / background-position，并已加入 `prefers-reduced-motion: reduce` 降级。
- `@codeinsights/electron` 版本 `0.0.65 -> 0.0.66`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- 未修改 README / AGENTS，不新增依赖，不新增 public API / IPC / shared type，不改 Pipeline 状态机、主进程服务或持久化格式。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-16 Pipeline Header 大标题移除计划

- [x] 移除 PipelineHeader 中展示会话标题的大号 H1，保留顶部 CodeInsights Pipeline 与当前节点、状态摘要。
- [x] 同步收紧 Header 内部间距，避免删除标题后出现明显空洞。
- [x] 更新 `tasks/lessons.md` 记录用户对 Pipeline Header 信息密度的纠正。
- [x] 运行聚焦测试或类型检查，并重新截图确认红框区域不再保留。
- [x] 在本节追加 Review。

## 2026-05-16 Pipeline Header 大标题移除 Review

- 已移除 `PipelineHeader` 中的大号会话标题 H1；Header 现在只保留 `CodeInsights Pipeline`、当前节点、状态摘要、轮次和右侧状态卡，用户标红区域不再占位。
- 已更新 `tasks/lessons.md`，记录 Pipeline Header 不再重复以超大标题展示会话名的偏好。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@codeinsights/electron' typecheck`。
- 已重新采集截图：`/tmp/codeinsights-shots/pipeline-header-stage.png`，确认红框内容已删除。

## 2026-05-16 Pipeline Neon Control Deck UI 优化计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 改造 Pipeline 主内容背景、Header、StageRail、Records、Composer，让运行状态和阶段进度有明显科技感与动态反馈。
- [x] 适度增强 PipelineSidebar 的新建入口、当前会话选中态和运行中状态点。
- [x] 增加 scoped Pipeline CSS utilities / keyframes，并确保 reduced-motion 下动画降级。
- [x] 递增 `@codeinsights/electron` patch 版本并同步锁文件。
- [x] 运行 Pipeline 聚焦测试、pipeline atoms 测试、typecheck 与 `git diff --check`。
- [x] 启动客户端做 Pipeline 模式视觉验证，检查桌面与窄宽布局、长文本、搜索、运行/等待/失败/停止状态。
- [x] 在本节追加 Review，说明改动、验证和残余风险。

## 2026-05-16 Pipeline Neon Control Deck UI 优化 Review

- 已完成 Pipeline 可见层改造：主工作区增加网格 / 微光背景；Header 改为任务指挥舱；StageRail 增加能量线、当前阶段 glow 和状态 icon；Records 增加控制台式搜索 / filter、实时输出扫描光、记录左侧状态轨和 hover lift；Composer 改为任务发射台；PipelineSidebar 增强新建入口、选中态和运行状态点。
- CSS 新增均使用 `pipeline-*` scoped class；动画使用 transform / opacity / background-position，并在 `prefers-reduced-motion: reduce` 下禁用循环扫描、能量线、状态脉冲和高亮呼吸。
- Code review 后已修复：不再对已含 alpha 的 `status-*-bg` / `status-*-border` token 叠加 Tailwind opacity modifier；Pipeline 背景伪元素加 `z-index: 0`，内容容器加 `z-10`；新增装饰性 Lucide 图标补 `aria-hidden`。
- `@codeinsights/electron` 版本 `0.0.64 -> 0.0.65`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
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
- UI-7 已完成并验证：4 个聚焦测试文件 11 pass、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`。
- 后续继续开发时不要重复 UI-0 到 UI-7；应先定义新的 UI 专项或接收新的用户需求，再写入 `tasks/todo.md` 计划并 check-in。
- 可选后续专项：真实 Electron 截图复核、File Browser 完整 roving tabindex / typeahead、低频集成设置页 token 化、窄窗口矩阵、新产品功能 UI。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 下次启动提示词（UI 全阶段完成后）

```text
你正在 CodeInsights 仓库继续开发。请先阅读并遵守：
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
15. UI-7 验证通过：bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/tabs/tab-close-confirm-model.test.ts；bun run --filter='@codeinsights/electron' typecheck；git diff --check。
16. 当前工作区可能存在未提交临时文件 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，以及 .DS_Store 修改；它们不是 UI 阶段成果，不要纳入提交，先确认来源并保护用户变更。

请从当前完成状态继续：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 implementation checklist 的当前状态快照、UI-7 最终 Review、P0/P1 关闭矩阵，以及 tasks/todo.md 的 UI 全阶段完成后状态同步 Review。
3. 不要回头重复 UI-0 到 UI-7 的阶段实现；这些阶段已经完成并提交。
4. 如果用户要求继续 UI 优化，先在 tasks/todo.md 写新的专项计划并 check-in，再开始实现。可选后续专项包括：真实 Electron 截图复核、File Browser 完整 roving tabindex / typeahead、低频集成设置页 token 化、窄窗口矩阵、或新的产品功能 UI。
5. 继续遵守 Jotai、Radix/shadcn 风格组件、Lucide 图标、现有主题 token、本地 JSON/JSONL 存储的约束。
6. 不新增 public API / IPC / shared type，除非单独评审；不修改 README / AGENTS，除非用户明确允许。
7. 新专项完成后运行 bun run --filter='@codeinsights/electron' typecheck、相关 focused tests 或手动路径验证、git diff --check；按需要补充截图或在 Review 中说明覆盖依据。
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
- [x] 运行最终验证：`bun run --filter='@codeinsights/electron' typecheck`、相关 focused tests 或手动路径验证、`git diff --check`。
- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 的总览、UI-7 任务、截图矩阵与最终 Review。
- [x] 在本节追加 UI-7 Review，单独提交 UI-7，提交时继续排除 `.DS_Store` 与 swap 文件。

## 2026-05-16 UI-7 全局验收与收尾 Review

- UI-7 已完成全局验收：UI-0 到 UI-6 阶段 Review 已补齐，P0 / P1 关闭矩阵已写入 implementation checklist。
- 最小修复范围：ChatHeader 编辑确认 / 取消、置顶、并排模式补 `aria-label`；WelcomeEmptyState 移除组件内 `forest-light` 裸 hex 分支，回到 token；TabBar 补 `tablist` / `tab` / `aria-selected` 与 ArrowLeft / ArrowRight / Home / End 切换；LeftSidebar 隐藏行内操作退出 Tab 顺序，运行 / 等待 / 成功 / 失败状态补 sr-only 文案；File Browser 补 ArrowUp / ArrowDown 在 treeitem 间移动。
- `@codeinsights/electron` 版本 `0.0.63 -> 0.0.64`，`bun.lock` workspace metadata 已同步。
- 截图矩阵已收口：Pipeline、Agent、AppShell、Settings、Welcome、Chat 回退、File Browser 已有 light / dark / 特殊主题组合覆盖；Chat 回退 light/dark 与 File Browser light/dark 以 token 复用、既有特殊主题截图、focused tests 和手动路径审计接受。
- 验证通过：`bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/tabs/tab-close-confirm-model.test.ts` 11 pass；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check`。
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
- UI-6 验证记录：UI-6 聚焦测试 4 pass、`bun run --filter='@codeinsights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- UI-6 截图记录：`welcome-light-first-run-desktop.png`、`welcome-dark-config-missing-desktop.png`、`chat-slate-message-list-desktop.png`、`chat-slate-tool-activity-desktop.png`、`file-browser-forest-selected-desktop.png`、`file-browser-forest-delete-confirm-desktop.png`。
- 下次启动应从 UI-7「全局验收与收尾」开始，先做全局验收计划，再检查主题矩阵、键盘路径、icon-only 可访问性、状态色辅助表达、长文本 / 长路径溢出、截图矩阵和最终 Review。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入阶段提交。

## 下次启动提示词（UI-7）

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
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck`、相关聚焦测试或手动路径验证、`git diff --check`。
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
- `@codeinsights/electron` 版本 `0.0.62 -> 0.0.63`，`bun.lock` workspace metadata 已同步。
- 验证通过：UI-6 聚焦测试 4 pass、`bun run --filter='@codeinsights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
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
- UI-5 验证记录：Settings 聚焦测试 7 pass、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- UI-5 截图记录：`settings-light-channel-form-desktop.png`、`settings-dark-validation-error-desktop.png`、`settings-slate-danger-dialog-desktop.png`、`settings-slate-update-desktop.png`。
- 下次启动应从 UI-6「Welcome / Chat 回退 / File Browser」开始，先做长尾页面 before 审计，再优化 Welcome / Onboarding 空态、旧 Chat 回退视觉、File Browser 文件树 / rename / delete confirm / empty folder。
- 当前仍需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入阶段提交。

## 下次启动提示词（UI-6）

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
- `@codeinsights/electron` 版本 `0.0.61 -> 0.0.62`，`bun.lock` workspace metadata 已同步。
- 验证通过：Settings 聚焦测试 7 pass、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`。
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
- [x] 递增 `@codeinsights/electron` patch 版本并同步锁文件。
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
- `@codeinsights/electron` 版本 `0.0.60 -> 0.0.61`，`bun.lock` workspace metadata 已同步。
- 验证通过：Agent 聚焦测试 11 pass、`bun run --filter='@codeinsights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
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
- 新增 `ContributionTask`、`PatchWorkManifest`、`PipelinePreflightResult` 等共享类型；`@codeinsights/shared` 版本 `0.1.25 -> 0.1.26`。
- 新增 `contribution-task-service.ts`，支持 `contribution-tasks.json` 索引、`contribution-tasks/{taskId}.jsonl` 事件、运行时 enum/schema 校验和坏行容错。
- 新增 `pipeline-patch-work-service.ts`，支持 manifest、固定文件、checksum、revision 归档和原子写入；路径安全覆盖绝对路径、`..`、文件/目录 symlink、manifest/tmp/bak symlink、dangling symlink、保留路径。
- 新增 `pipeline-preflight-service.ts`，覆盖 Git root/branch/remote/dirty/conflict、Claude CLI、Codex CLI、Git 和包管理器识别；resolver 异常会转换为稳定 blocker。
- `@codeinsights/electron` 版本 `0.0.46 -> 0.0.47`，`bun.lock` workspace 版本元数据已同步。
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
- `@codeinsights/shared` 版本 `0.1.26 -> 0.1.27`，`@codeinsights/electron` 版本 `0.0.47 -> 0.0.48`，`bun.lock` workspace metadata 已同步。
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
- `@codeinsights/shared` 版本 `0.1.27 -> 0.1.28`，`@codeinsights/electron` 版本 `0.0.48 -> 0.0.49`，`bun.lock` 已同步。
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
- `@codeinsights/electron` 版本 `0.0.49 -> 0.0.50`，`bun.lock` workspace metadata 已同步。
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
- `@codeinsights/electron` 版本 `0.0.50 -> 0.0.51`，`bun.lock` workspace metadata 已同步。
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
- `@codeinsights/electron` 版本 `0.0.51 -> 0.0.52`，`bun.lock` workspace metadata 已同步。
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
- `@codeinsights/electron` 版本 `0.0.52 -> 0.0.53`，`bun.lock` workspace metadata 已同步。
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
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck`、Pipeline 聚焦测试、`git diff --check`。
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
- 验证通过：Pipeline 聚焦测试 25 pass；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check`。
- 截图已采集：`improve/ui/screenshots/pipeline-ui3-light-desktop.png`、`pipeline-ui3-dark-desktop.png`、`pipeline-ui3-slate-light-desktop.png`。截图通过 localhost 临时预览采集，原因是浏览器安全策略拒绝直接打开 `data:` / `file:` URL。

- [x] 更新 Pipeline checklist 的最新状态快照、Phase 3 后续 bugfix、版本号、验证状态和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”，明确 Phase 0-3 完成、Phase 3 后续修复已提交、Phase 4-8 未开始。
- [x] 不修改 README / AGENTS，不进入 Phase 4，不执行 push / PR。
- [x] 执行文档校验并追加 Review。

## 2026-05-14 最新开发状态文档同步 Review

- 已同步 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`：最近提交更新为 `ffd1f309905c08fdd1bf471ef560361d3585d236`，分支状态为 ahead 8 commits，Phase 4 仍未开始。
- 已同步 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`：补充 Phase 3 提交 `881c7ad1` 和后续 bugfix `e65f8ac2` / `71bcb1df` / `364cf964` / `ffd1f309`。
- 当前版本状态已记录：`@codeinsights/shared` 为 `0.1.28`，`@codeinsights/electron` 为 `0.0.53`。
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
- [x] 递增受影响 package patch version，预计至少包含 `@codeinsights/shared` 和 `@codeinsights/electron`。
- [x] 运行 Phase 4 指定测试、`bun run typecheck`、`git diff --check` 和必要的锁文件校验；满足完成定义后追加 Review 并单独提交 Phase 4。

## 2026-05-14 Phase 4 Review

- Phase 4 已实现 Developer 文档审核与 Reviewer Issue Loop，并已单独提交。
- developer 现在必须读取已接受的 `plan.md` / `test-plan.md`，输出 `dev.md` 并进入 developer document gate；接受后才进入 reviewer。
- reviewer 读取已接受的 `dev.md`、方案和测试方案，保持 read-only，输出结构化 issues 与 `review.md`；不通过且未达 3 轮上限时自动回 developer，达到上限进入人工 gate。
- UI 新增 `ReviewerIssueBoard`，`ReviewDocumentBoard` 支持 developer 阶段，仍通过结构化 IPC 读取 patch-work 文档，不从 records 反推业务状态。
- 代码审查发现的 SDK abort 竞态已修复：Codex SDK runner 在准备阶段、`thread.run()` 后和 patch-work enrichment 后都会检查中止状态，避免 stopped 会话继续写 `dev.md` / `review.md` 或发送 `node_complete`。
- `@codeinsights/shared` 版本 `0.1.28 -> 0.1.29`，`@codeinsights/electron` 版本 `0.0.53 -> 0.0.54`，`bun.lock` workspace metadata 已同步。
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
- 当前版本状态：`@codeinsights/shared` 为 `0.1.29`，`@codeinsights/electron` 为 `0.0.54`。
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
- [x] 递增受影响 package patch version：`@codeinsights/shared` `0.1.29 -> 0.1.30`，`@codeinsights/electron` `0.0.54 -> 0.0.55`。
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
- 当前版本状态：`@codeinsights/shared` 为 `0.1.30`，`@codeinsights/electron` 为 `0.0.55`。
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
- [x] 递增受影响 package patch version：`@codeinsights/shared` `0.1.30 -> 0.1.31`，`@codeinsights/electron` `0.0.55 -> 0.0.56`，并同步 `bun.lock` workspace metadata。
- [x] 运行 Phase 6 指定测试、`bun run typecheck`、`git diff --check` 和 `bun install --frozen-lockfile --dry-run`；满足完成定义后追加 Review 并单独提交 Phase 6。

## 2026-05-15 Phase 6 Review

- Phase 6 已完成 Committer Draft-Only 闭环，随本轮阶段提交落地；未进入 Phase 7。
- Committer v2 读取 accepted `result.md`、`patch-set/changes.patch`、`patch-set/changed-files.json`、`patch-set/diff-summary.md`、`patch-set/test-evidence.json`、CONTRIBUTING 和 Git 状态，只生成提交 / PR 草稿。
- 新增只读提交上下文读取能力：Git status、diff 摘要、变更文件、HEAD、分支和 CONTRIBUTING；读取 CONTRIBUTING 时拒绝 symlink 越界；不执行 `git add`、`git commit`、`git push` 或 GitHub 写 API，提交候选继续排除 `patch-work/**`。
- Committer enrichment 写入并登记 `patch-work/commit.md` 和 `patch-work/pr.md`，stage output 回填 `commitDocRef` / `prDocRef`，`localCommit` 和 `remoteSubmission` 保持 `not_requested`。
- `submission_review` gate 在 Phase 6 只接受 `submissionMode: local_patch`，会接受 `commit_doc` / `pr_doc` 并完成 ContributionTask；`local_commit` / `remote_pr` 会被拒绝，committer schema/parser 和 UI 也会阻止非 `draft_only` 提交状态。
- UI 新增 `CommitterPanel`，在 `submission_review` gate 通过结构化 patch-work IPC 读取 `commit.md` / `pr.md`，同时展示 patch-set 摘要、测试证据、blocker 和风险，不从 records 反推主业务状态。
- `@codeinsights/shared` 版本 `0.1.30 -> 0.1.31`，`@codeinsights/electron` 版本 `0.0.55 -> 0.0.56`，`bun.lock` workspace metadata 已同步。
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
- 当前版本状态：`@codeinsights/shared` 为 `0.1.31`，`@codeinsights/electron` 为 `0.0.56`。
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
- [x] 递增受影响 package patch version：`@codeinsights/shared` `0.1.31 -> 0.1.32`、`@codeinsights/electron` `0.0.56 -> 0.0.57`，并同步 `bun.lock` workspace metadata。
- [x] 运行 Phase 7 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`；满足完成定义后追加 Review 并单独提交 Phase 7，不执行 push / PR。

## 2026-05-15 Phase 7 Review

- Phase 7 已完成受控本地 Commit Gate，并已单独提交 `d6da8380dc69e179c24d542d4a73cd1be90216cc`（`feat(pipeline): 完成 Phase 7 受控本地提交闭环`）。
- Git service 新增 `validateCommitPreconditions` 和 `createLocalPipelineCommit`：本地 commit 必须显式 `confirmed: true`，无 operation id、无 commit message、detached HEAD、无候选变更、冲突或 staged `patch-work/**` 都会阻止提交。
- 受控 staging 只 stage Git status 候选源码文件，默认排除 `patch-work/**`；使用 literal pathspec 防止特殊文件名扩大 stage 范围，若 `patch-work/**` 已经进入 index，commit 前会二次阻断。
- `submission_review` gate 现在支持 `local_patch` 保存草稿和 `local_commit` 本地提交；`remote_pr` 仍被拒绝，push / PR 未开启。
- local commit 前会先只读校验 `commit.md` / `pr.md` checksum，commit result 会写入 `local_commit_created` / `local_commit_failed` Contribution events，并回填 committer stage output；重复 resume 使用 operation id 识别已创建结果，不重复执行 commit。
- `CommitterPanel` 新增本地 commit 候选、排除项、分支、测试证据和提交结果展示；仍通过结构化 patch-work IPC 读取 `commit.md` / `pr.md`，不从 records 反推主业务状态。
- `@codeinsights/shared` 版本 `0.1.31 -> 0.1.32`，`@codeinsights/electron` 版本 `0.0.56 -> 0.0.57`，`bun.lock` workspace metadata 已同步。
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
- 当前版本状态：`@codeinsights/shared` 为 `0.1.32`，`@codeinsights/electron` 为 `0.0.57`。
- 当前分支状态：`base/pipeline-v0` 相对 `origin/base/pipeline-v0` ahead 14 commits；未执行 push / PR。
- 当前验证状态：Phase 7 聚焦测试 80 pass、shared / ContributionTask 兼容测试 18 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 370 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 下次启动提示词（Phase 8）

```text
你正在 CodeInsights 仓库继续开发 Pipeline v2 六 Agent 开源贡献工作流。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md
- improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md 中“当前实现进度”和 Phase 8 相关内容

当前进度：
1. Phase 0-6 已完成并分别提交，Phase 6 commit 为 fab7f906f546e619157286ffb6fe40c869f1d3e2。
2. Phase 7 已完成并提交，commit 为 d6da8380dc69e179c24d542d4a73cd1be90216cc；已实现受控本地 Commit Gate，支持 local_commit 人工确认、受控 staging、默认排除 patch-work/**、operation id 幂等、commit hash 回填和 CommitterPanel 状态展示。
3. 当前 @codeinsights/shared 版本为 0.1.32，@codeinsights/electron 版本为 0.0.57。
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
- [x] 递增受影响 package patch version：`@codeinsights/shared` `0.1.32 -> 0.1.33`、`@codeinsights/electron` `0.0.57 -> 0.0.58`，并同步 `bun.lock` workspace metadata。
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
- 新增远端提交契约和状态：`remoteSubmissionOperationId`、`remoteWriteConfirmed`、`PipelineRemoteSubmissionSummary`、`pushed` 可恢复状态、`remote_submission_created` / `remote_submission_failed` Contribution events；`@codeinsights/shared` 版本 `0.1.32 -> 0.1.33`。
- `pipeline-git-submission-service` 新增远端 preflight / submit：读取实际 push URL（`git remote get-url --push`）并脱敏展示，从 GitHub push URL 解析 `owner/repo`，`gh pr create` 显式传 `--repo`，并使用本机 `gh` / git credential，不新增 token 存储。
- 远端写前会校验 `allowRemoteWrites`、confirmed、operation id、HEAD == local commit hash、remote/base/head branch、`gh auth status`、目标 remote base branch 存在，并拒绝 `headBranch === baseBranch`、`main`、`master` 等 base/default 分支直推风险。
- `patch-work/**` 远端防护已加固：不仅检查 Git index，还检查待推送 commit tree 和本地 remote/base 到 commit hash 的 push range 历史，发现 `patch-work/**` 曾进入历史即阻断远端写。
- 幂等和恢复：完整成功按 operation id 复用已创建 PR；push 成功但 PR 创建失败会持久化 `pushed` 状态，后续同 operation id 重试会跳过 push，只恢复 PR 创建；PR 已存在时通过 `gh pr view` 回填既有 URL。
- 错误脱敏：远端命令错误进入 stage artifact、Contribution events 和 UI 前统一清洗 credentialed remote URL、Authorization bearer、`ghp_`、`github_pat_`、`GH_TOKEN` / `GITHUB_TOKEN`。
- `CommitterPanel` 新增远端目标、独立确认、红色高风险提交按钮、远端成功 / 失败 / pushed 可恢复状态展示；本地 commit 后远端目标会从 `localCommit` fallback，不依赖 records 反推主业务状态。
- `@codeinsights/electron` 版本 `0.0.57 -> 0.0.58`，`bun.lock` workspace metadata 已同步。
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
- [x] 递增 `@codeinsights/electron` patch 版本并同步锁文件。
- [x] 运行 UI-1 验证：`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`，并补充 light / dark / ocean primitive 截图证据。
- [x] 更新 UI checklist 与本文件 Review，单独提交 UI-1 阶段成果。

## 2026-05-16 UI-1 Token 与 Primitive 收敛 Review

- UI-1 已完成，范围限定在 renderer token / primitive / settings primitives、截图和 `@codeinsights/electron` 版本更新；未修改 README / AGENTS，未新增 public API / IPC / shared type。
- 新增 semantic token alias：surface、text、border、focus、running / waiting / success / danger / neutral status 三件套、radius、shadow、motion，并暴露到 Tailwind。
- 新增 `Card` 与 `Chip` primitive；Button 支持 loading，新增 `IconButton` 封装 tooltip + `aria-label`；Badge / Alert 支持状态 variant。
- 收敛 Dialog / AlertDialog / Popover / Tooltip / Dropdown / ContextMenu / Command / Tabs / Sheet / Input / Textarea / Select / Switch / Slider / Sonner / Settings primitives 的基础 radius、surface、shadow、focus 和 motion。
- Settings 密钥显隐按钮已从不可聚焦的裸 button 改为有 `aria-label` 和 tooltip 的 `IconButton`。
- `@codeinsights/electron` 版本 `0.0.58 -> 0.0.59`，`bun.lock` workspace metadata 已同步。
- 截图证据：`improve/ui/screenshots/primitives-light-default-desktop.png`、`improve/ui/screenshots/primitives-dark-default-desktop.png`、`improve/ui/screenshots/primitives-ocean-status-desktop.png`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。renderer build 仅保留既有 chunk size warning。
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
你正在 CodeInsights 仓库继续推进全客户端 UI 优化。

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
8. 验证：至少运行 bun run --filter='@codeinsights/electron' typecheck、git diff --check，并采集 UI-2 light / dark / 特殊主题截图。
9. 每完成一个阶段并通过该阶段验证后，立即更新 checklist 和 tasks/todo.md 的 Review，并单独提交该阶段成果；不执行 push / PR，除非用户明确要求。
```

## 2026-05-16 UI-2 AppShell / Sidebar / Tab 计划

- [x] 执行 `git status --short`，确认当前只有 `.DS_Store` 修改和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 未跟踪文件，二者均不纳入 UI-2 提交。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、UI checklist 的 UI-2 阶段，以及视觉规范 `5.1 AppShell / Sidebar / Tab`、`5.8 页面级 Wireframe`。
- [x] 做 UI-2 before 审计，记录 AppShell / LeftSidebar / PipelineSidebar / TabBar / MainArea / RightSidePanel 当前结构、状态 indicator、focus 和溢出风险。
- [x] 实现 UI-2 视觉收敛：统一 AppShell 三栏 surface、LeftSidebar icon button、PipelineSidebar session item、TabBar / TabBarItem 状态 indicator、MainArea 与 RightSidePanel 层级。
- [x] 保持阶段边界：不进入 Pipeline 主面板 UI-3，不修改 Agent message / composer，不新增 public API / IPC / shared type，不修改 README / AGENTS。
- [x] 递增 `@codeinsights/electron` patch 版本并同步 `bun.lock`。
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`，并采集 UI-2 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 和本文件 Review，单独提交 UI-2 阶段成果。

## 2026-05-16 UI-2 AppShell / Sidebar / Tab Review

- UI-2 已完成，范围限定在 AppShell、Sidebar、TabBar / TabBarItem、MainArea、Agent RightSidePanel、状态派生 atom、截图和 `@codeinsights/electron` 版本更新；未修改 README / AGENTS，未新增 public API / IPC / shared type。
- 新增 before 审计记录：`improve/ui/2026-05-16-client-ui2-before-audit.md`。
- Shell 三栏统一到 `surface-app / surface-panel / rounded-panel / shadow-panel / border-subtle`；ModeSwitcher 使用 primary token；TabBar active tab 与 MainArea panel 连贯，非 active tab 降权。
- Sidebar / Tab 状态统一：Pipeline waiting -> blocked，node / recovery failed -> failed；Agent stream error / retry failed -> failed；running / blocked / failed / completed 使用 token 化细线和 tooltip，不整块染色。
- 可访问性修复：Tab close button 改为真实独立 button，避免 button 嵌套；Conversation / Agent / Pipeline 侧栏行补 Enter / Space 激活，并限制为仅在行容器自身聚焦时触发，避免子按钮键盘事件冒泡误选中会话；icon-only 操作补 `aria-label` 与 focus-visible ring。
- `@codeinsights/electron` 版本 `0.0.59 -> 0.0.60`，`bun.lock` workspace metadata 已同步。
- 截图证据：`improve/ui/screenshots/appshell-light-multi-tab-desktop.png`、`improve/ui/screenshots/appshell-dark-background-running-desktop.png`、`improve/ui/screenshots/appshell-forest-blocked-desktop.png`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、聚焦测试 21 pass、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
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
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck`、相关聚焦测试和 `git diff --check`。
- [x] 启动 Electron 做 light / dark / 特殊主题抽样检查；若截图受限，在 Review 中说明。
- [x] 追加本轮 Review，记录验证结果与残留风险。

## 2026-05-16 Agent / Pipeline Cockpit 创意 UI 刷新 Review

- 已完成 Agent 三栏工作台的 cockpit 视觉刷新：主画布增加克制网格微光，Header 升级为 mission strip，消息区、Reasoning Chamber、工具活动、Composer command deck、右侧资源面板和左侧 Agent 入口统一到同一层级语言。
- 改动保持视觉层范围：未改 IPC、Agent SDK / Pipeline 逻辑、Jotai state shape、持久化结构、shared package API、README 或 AGENTS；未新增依赖。
- 新增 CSS 均为 Agent scoped utility，使用现有 semantic token / CSS variable；状态表达同时包含图标、文案或结构轨道，不只依赖颜色，并包含 `prefers-reduced-motion` 降级。
- `@codeinsights/electron` 版本 `0.0.66 -> 0.0.67`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun install --frozen-lockfile --dry-run`、`bun run --filter='@codeinsights/electron' typecheck`、`bun test apps/electron/src/renderer/components/agent/agent-ui-model.test.ts` 7 pass / 21 expect、`git diff --check`。
- 运行验证：`bun run dev` 可启动 Vite、main/preload 构建、Electron、IPC、runtime、tray 和 watcher；日志未出现 renderer 编译失败。macOS `screencapture` 当前失败，错误为 `could not create image from display`，因此本轮无法留下 light / dark / 特殊主题截图证据。
- 已停止本轮启动的 Vite / Electron 开发进程；仍需保护既有无关文件：`.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-22 CodeInsights 架构图谱生成计划

- [x] 复习 `tasks/lessons.md`，确认本轮需要保护既有无关 `.DS_Store`，并在完成前做可渲染验证。
- [x] 读取 `fireworks-tech-graph` skill 与 style 7 OpenAI Official 规范，确定采用纯白、极简、绿色主箭头、SVG+PNG 双格式输出。
- [x] 梳理仓库分层：Bun workspace、Electron 主进程、preload、renderer、shared/core/ui 包、配置与本地文件存储。
- [x] 梳理关键运行链路：IPC 桥接、Agent SDK 事件流、Pipeline LangGraph 节点流、Provider 适配器、设置/工作区/持久化。
- [x] 设计一组架构、流程、框架图，覆盖总体架构、IPC/状态、Agent、Pipeline、数据存储/配置等主题。
- [ ] 在 `assets/imgs/` 生成 style 7 SVG，并导出对应 PNG。
- [ ] 运行 SVG XML 校验、PNG 导出校验、抽样视觉检查，修复箭头、文字、边距问题。
- [ ] 在本文件追加 Review，记录生成文件、验证结果与残留风险。

## 2026-05-23 CodeInsights 新项目图标替换计划

- [x] 启动前复习 `tasks/lessons.md`，确认本轮不再新增候选图标，直接把用户提供的新项目图标替换为当前生效资源。
- [x] 检查工作树，保护既有 `.DS_Store`、`assets/`、`improve/` 和本文件已有未提交记录，不回滚无关改动。
- [x] 盘点旧项目图标入口：Electron 打包图标 `apps/electron/resources/icon.*`、运行时资源副本、托盘 template、渲染层 `models/codeinsights.png`、品牌 Logo 下载资源。
- [x] 以 `assets/icon/CodeInsights.png` 为源生成 1024 PNG、macOS `.icns`、Windows `.ico`、托盘尺寸 PNG，并同步替换 renderer / resources 中的 CodeInsights 旧图标。
- [x] 复查源码引用和资源清单，确认第三方模型/平台图标不被误替换。
- [x] 运行资源尺寸校验、必要构建验证和 `git diff --check`，在本节追加 Review。

## 2026-05-23 CodeInsights 新项目图标替换 Review

- 已使用 `assets/icon/CodeInsights.png` 生成当前项目图标，并把已跟踪的 `apps/electron/resources/icon.png` 作为后续默认源；Electron 生效图标已导出为 `icon.png`、`icon.icns`、`icon.ico`。
- 已移除旧 SVG 图标形状：`apps/electron/resources/icon.svg` 改为引用已跟踪的 `resources/icon.png`，`apps/electron/resources/codeinsights-logos/icon.svg` 改为单色 CI tray 标记，避免继续从旧斜条矢量图生成。
- 已重写 `apps/electron/resources/generate-icons.sh`：默认从已跟踪的 `resources/icon.png` 生成 Electron、renderer、web、video 和品牌素材；需要刷新源图时可通过 `CODEINSIGHTS_ICON_SOURCE` 指向新 PNG；tray template 由脚本绘制单色 CI 标记。不再使用 `icon.svg -> icon.png` 自引用，也不依赖本机未安装的 `rsvg-convert` / ImageMagick。
- 已同步渲染层 CodeInsights 图标：`apps/electron/src/renderer/assets/models/codeinsights.png`，以及 `apps/electron/src/renderer/assets/bots/codeinsights-logos/*.png`。
- 已同步打包资源品牌图标：`apps/electron/resources/codeinsights-logos/*.png`；其中 `codeinsights-transparent.png` 使用透明背景 cutout，其余变体统一为新正式图标，避免旧图标残留。
- 已同步非 Electron 明确品牌入口：`web/assets/brand/logo.webp` 与 `assets/video/assets/codeinsights-logo-cutout*.png`；第三方模型、飞书、微信、钉钉等平台图标未替换。
- 已生成托盘 template 资源：`iconTemplate.png`、`iconTemplate@2x.png`、`iconTemplate@3x.png`，尺寸分别为 22 / 44 / 66 px；视觉抽样确认为单色 CI 标记，不再是旧斜条图标。
- 审查发现并已修复：第一轮生成后 `icon.ico` 和三份 tray template 与 HEAD hash 一致，说明仍是旧资源；修复后四个文件当前 hash 均不同于 HEAD，并已抽样打开 `.ico` 确认为新 App icon。
- 验证通过：执行 `CODEINSIGHTS_ICON_SOURCE="$PWD/assets/icon/CodeInsights.png" apps/electron/resources/generate-icons.sh`；SVG `xmllint --noout`；PIL 尺寸检查覆盖源图、Electron PNG/ICO、renderer PNG、WebP、视频 cutout、托盘 template；当前 vs HEAD hash 对比覆盖 `icon.ico` 和三份 tray template；源码扫描确认没有 tracked 文件继续引用未跟踪 `assets/icon/CodeInsights.png`；`bun run --filter='@codeinsights/electron' typecheck`；清理后执行 `bun run --filter='@codeinsights/electron' build`；`git diff --check`。
- 已清理后重建 `apps/electron/dist/resources`，确认 ignored dist 中不再保留旧 `proma-logos`；构建仍有既有 Vite chunk size warning。本轮未引入运行时代码变更；当前工作树中 `.DS_Store`、`docs/.DS_Store` 和未跟踪 `assets/` / `improve/` 为既有状态或资产目录，不应误纳入无关提交。

## 2026-05-23 中文 README 完善计划

- [x] 复习 `tasks/lessons.md`，确认本轮需要保护既有无关 `.DS_Store` / 资产目录状态，且文档内容必须以当前代码和素材为准。
- [x] 盘点当前 `README.md`、workspace 包版本、Electron 脚本、主进程服务、renderer 模块、IPC 契约、Pipeline / Agent 运行链路与本地存储结构。
- [x] 盘点 `assets/` 下图标、架构图、流程图、存储图和介绍视频素材，选择适合 README 首屏和架构章节的引用方式。
- [x] 重写或整理中文 README：突出项目定位、核心能力、快速开始、架构图、模块说明、开发/打包/验证命令、配置与安全边界、贡献提示。
- [x] 验证 README 中的本地资源路径、标题锚点、命令和 package 版本，运行 Markdown / 链接 / diff 静态检查。
- [x] 在本文件追加 Review，记录最终改动、验证结果、未覆盖风险和后续建议。

## 2026-05-23 中文 README 完善 Review

- 已将 `README.md` 重写为当前项目状态的中文 README，覆盖项目定位、核心能力、快速开始、技术栈、Monorepo 结构、整体架构、Pipeline v2、Agent Runtime、IPC / Jotai 状态、本地存储、Provider、Bridge、开发指南、打包发布、安全边界、素材目录和常见问题。
- 已结合 `assets/` 素材：顶部引用 `assets/icon/CodeInsights.png`，项目展示引用 `assets/video/snapshots/contact-sheet.jpg` 并链接 20 秒介绍视频，架构章节引用系统架构图、Pipeline LangGraph 流程图、Agent Runtime 流程图、IPC 状态流图和本地存储结构图。
- 已纠正旧 README 的过期事实：默认新建 Pipeline 是 v2 六节点，包含 `committer`；v2 中 `tester` 和 `committer` 走 Codex；`@codeinsights/electron` 当前为 `0.0.102`；开发模式默认 `.codeinsights-dev`，正式版本默认 `.codeinsights`；运行中的 Pipeline 跨重启不会继续跑，只可靠恢复 `waiting_human` gate。
- 已保留谨慎边界：Chat 为隐藏回退而非公开主入口；素材图中 `RV-Insights` 是历史项目名；根目录当前未检测到独立 LICENSE 文件，许可证说明需以最终 LICENSE / NOTICE 为准。
- 验证通过：`git diff --check`；自定义 Node 脚本检查 `README.md` 的 24 个链接 / 图片和 47 个标题锚点均可解析；旧版本号和过期五阶段表述扫描未发现需要修正的残留。
- 本轮只修改文档，未运行 TypeScript typecheck 或应用构建；当前工作树仍有既有无关 `.DS_Store` 修改、未跟踪 `assets/` 和 `improve/` 目录状态，不应误纳入无关提交。

## 2026-05-23 README 首屏视频与旧名清理 Review

- 已把 README 首屏的图标位替换为 20 秒视频预览，视频链接和设计说明放在标题后第一视觉位，不再单独展示重复的“项目展示”区块。
- 已从 README 中清理所有历史项目名相关提示，包括旧名说明段、FAQ 和旧配置目录的直白命名，只保留不暴露旧项目名的迁移表述。
- 已重新渲染 `assets/video/codeinsights-intro-20s.mp4`、`assets/video/snapshots/contact-sheet.jpg`、`assets/video/render-contact-sheet.jpg` 和关键帧快照；新视频首帧与 README 预览均为 CodeInsights 品牌内容。
- 已同步修正 `assets/imgs/codeinsights-system-architecture.png`、`assets/imgs/codeinsights-local-storage-framework.png` 和 `assets/video/assets/system-architecture.png`，避免视频和架构素材继续暴露历史名称。
- 验证通过：`bun run lint`；`bun run validate`（带 `HYPERFRAMES_BROWSER_PATH=/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` 和 `PRODUCER_FORCE_SCREENSHOT=1`）；`bun run inspect -- --samples 12 --timeout 30000`；`rg -n "RV-Insights|rv-insights|rv_insights|@rv-insights|\\.rv-" README.md assets/video/index.html assets/video/DESIGN.md assets/imgs/*.svg assets/video/meta.json assets/video/package.json assets/video/hyperframes.json`；`git diff --check`。
- 残留风险仅在仓库里既有的无关 `.DS_Store` 噪音和未跟踪资产目录，不属于本次 README 修复范围。

## 2026-05-23 README 参考页样式对齐 Review

- 已把 README 顶部改成更接近参考页的展示结构：居中品牌标题、语言切换、简短定位、彩色徽章、原生视频播放器和锚点导航。
- 已新增三栏式“产品优势”卡片，把项目最重要的三件事先讲清楚：可审计流水线、本地优先工作台、复用成熟运行时。
- 已保持正文深层内容不变，只收敛顶部入口与信息层级，让 README 先像一个项目首页，再展开详细架构、命令和边界。
- 已按用户澄清把 `<video>` 的 `src` 改为 GitHub 绝对视频地址，避免 README 上的视频播放器退化成静态预览或相对文件跳转；仓库内 mp4 链接保留为备用入口。
- 验证通过：`git diff --check`；README 本地链接/媒体/锚点 Node 检查；`curl -L --head --fail` 远程视频地址检查；`rg` 旧名扫描；`ffprobe` 视频文件检查。
- 残留风险仅在工作树既有的 `.DS_Store` 和未跟踪资产目录，不属于本轮 README 结构调整范围。

## 2026-05-23 README GitHub 附件视频修复计划

- [x] 复核远端 GitHub README 渲染结果，确认 raw 仓库 mp4 的 `<video>` 被过滤成空段落。
- [x] 获取 GitHub `user-attachments/assets` 视频地址，按 ScienceClaw 参考写法替换 README 首屏播放器。
- [x] 验证附件 URL 可访问、GitHub Markdown 渲染保留播放器、README 不含旧项目名。
- [x] 提交并推送修复，避免纳入无关 `.DS_Store` 改动。

## 2026-05-23 README GitHub 附件视频修复 Review

- 已确认上一版 raw 仓库 mp4 会被 GitHub README 渲染器过滤成空段落，导致页面上没有可播放视频。
- 已通过 GitHub 编辑器上传并持久化视频附件，最终 README 使用可匿名访问的 `https://github.com/user-attachments/assets/64ca3efd-b424-4e09-b0ca-9c4840cf9588`。
- 已验证新附件匿名请求能返回 mp4 文件头，GitHub Markdown API 会保留 `gh:secured-asset-reference` 与 `<video>`，README 旧名扫描无结果。
