# CodeInsights README 真实运行素材

本目录素材来自真实 Electron dev 主窗口，不是 mock。采集时使用隔离配置目录：

```bash
CODEINSIGHTS_CONFIG_DIR=/tmp/codeinsights-readme-capture-config
```

该配置目录只包含自动创建的默认工作区、默认 Skills 和空密钥 DeepSeek 预设渠道，避免读取本机真实会话、API Key 或飞书/钉钉/微信凭证。

## 素材清单

| 文件 | 内容 | 建议用途 |
|------|------|----------|
| `01-pipeline-dashboard.png` | Pipeline 发射台、六阶段 Mission Route、产物与运行日志面板 | README 首屏或 Pipeline 章节 |
| `02-agent-workbench.png` | Agent Mission、Command Deck、右侧资源面板、会话/工作区文件 | Agent Runtime 章节 |
| `03-settings-overview.png` | 模型配置、DeepSeek 预设、Pipeline Codex 认证来源、Agent 供应商 | 快速开始 / 首次配置 |
| `04-channels-and-agent-settings.png` | Agent 高级设置、内置工具、MCP 服务器、Skills | MCP / Skills / 本地能力章节 |
| `codeinsights-real-run-overview.mp4` | 6 秒真实界面录屏，覆盖 Pipeline、Agent、设置与回到 Pipeline | README 真实录屏文件链接 |
| `codeinsights-real-run-overview-contact-sheet.jpg` | 录屏抽帧总览 | 本地核验或视频 fallback 预览 |
| `feature-01-pipeline-workflow.mp4` | Pipeline 工作台、六阶段 Mission Route、记录过滤和阶段产物 / 运行日志切换 | README 功能演示区 |
| `feature-01-pipeline-workflow-poster.jpg` | Pipeline 工作流演示视频预览图 | README 功能演示区 |
| `feature-02-agent-workspace.mp4` | Agent 模式、工作区矩阵、新会话入口、资源面板和能力入口 | README 功能演示区 |
| `feature-02-agent-workspace-poster.jpg` | Agent 工作区演示视频预览图 | README 功能演示区 |
| `feature-03-provider-settings.mp4` | 模型配置、DeepSeek 预设、Pipeline Codex 认证来源和新增 Provider 表单 | README 功能演示区 |
| `feature-03-provider-settings-poster.jpg` | 模型与 Provider 配置演示视频预览图 | README 功能演示区 |
| `feature-04-agent-mcp-skills.mp4` | Agent 高级设置、内置工具、MCP Server、Skills 和工作区隔离能力 | README 功能演示区 |
| `feature-04-agent-mcp-skills-poster.jpg` | Agent MCP / Skills 演示视频预览图 | README 功能演示区 |
| `feature-demos-contact-sheet.jpg` | 四段功能演示视频预览总览 | 本地核验或素材目录 |
| `feature-videos-manifest.json` | 功能演示视频采集时间、文件清单和限制说明 | 审计记录 |
| `capture-cdp.mjs` | CDP 采集脚本 | 后续重新采集素材 |
| `capture-feature-demos.mjs` | 多功能演示视频 CDP 采集脚本 | 后续重新采集功能视频 |
| `manifest.json` | 采集时间、目标 URL 和文件清单 | 审计记录 |

## README 引用片段

```md
<video src="https://github.com/user-attachments/assets/64ca3efd-b424-4e09-b0ca-9c4840cf9588" controls width="900" autoplay muted loop></video>

![Pipeline 工作台](./docs/assets/readme/real-runs/01-pipeline-dashboard.png)

![Agent 工作台](./docs/assets/readme/real-runs/02-agent-workbench.png)

![模型配置](./docs/assets/readme/real-runs/03-settings-overview.png)

![Agent MCP 与 Skills 配置](./docs/assets/readme/real-runs/04-channels-and-agent-settings.png)

<video src="https://github.com/user-attachments/assets/dadf47f5-d339-4df1-90d4-a07e8d91eb42" controls muted width="100%"></video>

<video src="https://github.com/user-attachments/assets/482f3f5c-4022-4500-b5dd-f1f7c5244cb3" controls muted width="100%"></video>

<video src="https://github.com/user-attachments/assets/aec44d0a-2cee-4d39-831f-41423b9765ff" controls muted width="100%"></video>

<video src="https://github.com/user-attachments/assets/91380be8-b868-4dd8-9b2a-3962729d55b8" controls muted width="100%"></video>
```

当前根 README 的首屏总览和四段功能演示都使用 GitHub 已验证可渲染的 `https://github.com/user-attachments/assets/...` 附件 URL；仓库内 MP4 / poster 作为真实素材源文件保留。GitHub README 会过滤相对路径 MP4，因此新增或替换视频时必须先上传为 user-attachments 附件，把 URL 写入公开 README，并复核线上渲染 HTML 中存在 `<video>`。

功能演示附件映射：

| 本地源文件 | GitHub 附件 URL |
| --- | --- |
| `feature-01-pipeline-workflow.mp4` | `https://github.com/user-attachments/assets/dadf47f5-d339-4df1-90d4-a07e8d91eb42` |
| `feature-02-agent-workspace.mp4` | `https://github.com/user-attachments/assets/482f3f5c-4022-4500-b5dd-f1f7c5244cb3` |
| `feature-03-provider-settings.mp4` | `https://github.com/user-attachments/assets/aec44d0a-2cee-4d39-831f-41423b9765ff` |
| `feature-04-agent-mcp-skills.mp4` | `https://github.com/user-attachments/assets/91380be8-b868-4dd8-9b2a-3962729d55b8` |

## 重新采集功能演示视频

先用隔离配置目录启动 Electron dev 应用，并开启 CDP：

```bash
cd apps/electron
CODEINSIGHTS_CONFIG_DIR=/tmp/codeinsights-readme-feature-config ./node_modules/.bin/electron --remote-debugging-port=9334 .
```

然后在仓库根目录运行：

```bash
CODEINSIGHTS_CONFIG_DIR=/tmp/codeinsights-readme-feature-config bun docs/assets/readme/real-runs/capture-feature-demos.mjs
```

功能演示视频只覆盖本地可验证 UI，不调用真实模型、不连接外部 IM Bridge，也不读取本机历史会话或凭证。
