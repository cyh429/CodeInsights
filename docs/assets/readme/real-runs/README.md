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
| `codeinsights-real-run-overview.mp4` | 6 秒真实界面录屏，覆盖 Pipeline、Agent、设置与回到 Pipeline | README 顶部演示视频链接 |
| `codeinsights-real-run-overview-contact-sheet.jpg` | 录屏抽帧总览 | README 顶部预览图、本地核验 |
| `capture-cdp.mjs` | CDP 采集脚本 | 后续重新采集素材 |
| `manifest.json` | 采集时间、目标 URL 和文件清单 | 审计记录 |

## README 引用片段

```md
<a href="./docs/assets/readme/real-runs/codeinsights-real-run-overview.mp4">
  <img src="./docs/assets/readme/real-runs/codeinsights-real-run-overview-contact-sheet.jpg" alt="CodeInsights 真实运行录屏预览" width="900" />
</a>

![Pipeline 工作台](./docs/assets/readme/real-runs/01-pipeline-dashboard.png)

![Agent 工作台](./docs/assets/readme/real-runs/02-agent-workbench.png)

![模型配置](./docs/assets/readme/real-runs/03-settings-overview.png)

![Agent MCP 与 Skills 配置](./docs/assets/readme/real-runs/04-channels-and-agent-settings.png)
```

当前根 README 使用抽帧图链接 MP4，避免相对路径 MP4 在 GitHub README 中被过滤后出现空白。如果要让 GitHub README 直接内嵌播放视频，需要在仓库页面上传 MP4 后改成 `https://github.com/user-attachments/assets/...` 地址，并复核线上渲染。
