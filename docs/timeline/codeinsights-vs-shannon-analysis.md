# CodeInsights 与 Shannon 技术架构对比分析及融合方案

> **文档版本**: v2.0
> **生成日期**: 2026-05-04
> **分析范围**: 技术栈、架构模式、核心实现、融合方案

---

## 目录

- [执行摘要](#执行摘要)
- [一、项目概述对比](#一项目概述对比)
- [二、技术栈全面对比](#二技术栈全面对比)
- [三、架构设计深度对比](#三架构设计深度对比)
- [四、核心功能对比](#四核心功能对比)
- [五、性能基准与资源占用](#五性能基准与资源占用)
- [六、开发者体验DX对比](#六开发者体验dx对比)
- [七、测试策略与工程质量对比](#七测试策略与工程质量对比)
- [八、事件系统与流式架构对比](#八事件系统与流式架构对比)
- [九、Skills系统对比](#九skills系统对比)
- [十、存储与持久化对比](#十存储与持久化对比)
- [十一、安全设计对比](#十一安全设计对比)
- [十二、错误处理与容错机制对比](#十二错误处理与容错机制对比)
- [十三、内存系统与记忆机制对比](#十三内存系统与记忆机制对比)
- [十四、融合方案](#十四融合方案)
- [十五、融合实施路线图](#十五融合实施路线图)
- [十六、迁移复杂度矩阵](#十六迁移复杂度矩阵)
- [十七、风险分析](#十七风险分析)
- [十八、经验教训与最佳实践](#十八经验教训与最佳实践)
- [十九、总结](#十九总结)
- [附录A：核心文件速查表](#附录a核心文件速查表)
- [附录B：依赖版本对比清单](#附录b依赖版本对比清单)
- [附录C：术语表](#附录c术语表)

---

## 执行摘要

本文档对 **CodeInsights**（开源 AI Agent 桌面应用）和 **Shannon**（企业级多 Agent AI 平台）进行全维度技术架构对比，并提出融合实现方案。

**核心发现**：
- **架构范式对立**：CodeInsights 是"本地优先、单体轻量"的 Electron 桌面应用（~77K 行 TypeScript）；Shannon 是"云原生、多语言微服务"的生产级平台（Go + Rust + Python）。
- **能力互补性强**：CodeInsights 在 UI 丰富度（Mermaid/KaTeX/Shiki）、IM 集成（飞书/钉钉/微信）、文档解析（PDF/Office）方面领先；Shannon 在生产可靠性（Temporal 工作流）、成本优化（Token 预算 + 模型分层）、安全沙箱（WASI）、可观测性（Prometheus + OTel）方面领先。
- **融合价值明确**：将两者优势结合，可打造既适合个人开发者又具备企业级能力的下一代 AI Agent 平台。预估实施周期 **16 周**，团队规模 **5-6 人**。

**关键决策建议**：
1. 前端从 Electron + React 18 迁移到 **Tauri v2 + Next.js 16**（包体积从 ~200MB 降至 ~10MB）
2. 编排层采用"**本地轻量 + 云端重型**"混合模式，本地处理简单任务，复杂任务可选路由到 Shannon 云端编排器
3. 保留 Bun 运行时和 JSON/JSONL 本地存储，云端补充 PostgreSQL + Redis

---

## 一、项目概述对比

### 1.1 定位与目标

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **产品定位** | 开源 AI Agent 桌面应用，面向个人开发者 | 企业级多 Agent AI 平台，面向生产环境 |
| **核心目标** | 本地优先、通用 Agent、个人 AI 助手 | 生产级可靠性、多策略编排、团队协作 |
| **部署模式** | 纯本地 Electron 桌面应用 | 云端微服务 + 本地桌面客户端 |
| **用户群体** | 个人开发者、AI 爱好者 | 企业团队、SRE、运维工程师 |
| **代码规模** | ~76,732 行 TypeScript（337 个文件） | 多语言混合（Go + Rust + Python + TS） |
| **开源协议** | MIT | MIT |
| ** Stars (GitHub)** | ~500+ | ~1,200+ |
| **最近更新** | 活跃（每周多次 commit） | 活跃（持续迭代） |

### 1.2 产品形态与设计理念

**CodeInsights**：运行在用户本地的 Electron 桌面应用，所有数据和计算都在用户机器上完成。设计理念是"**本地优先**"——数据完全属于用户，无需联网即可使用（除调用大模型 API 外）。所有配置和消息存储在 `~/.codeinsights/` 的 JSON/JSONL 文件中，无数据库依赖。

**Shannon**：完整的云原生平台，由多个微服务组成（Gateway + Orchestrator + Agent Core + LLM Service），通过 Docker Compose 部署。Desktop 应用（Tauri + Next.js）只是**轻客户端**前端界面，所有业务逻辑和状态管理在远程服务端完成。设计理念是"**生产级可靠性**"——通过 Temporal 工作流保证任务执行不丢失，通过 WASI 沙箱保证代码执行安全。

### 1.3 架构范式对比

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **架构范式** | 单体桌面应用（Fat Client） | 微服务 + 轻客户端（Thin Client） |
| **计算位置** | 本地主进程 | 远程服务端 |
| **数据所有权** | 用户完全拥有 | 用户拥有，平台托管 |
| **离线能力** | 完全离线（除 LLM API） | 必须联网 |
| **运维复杂度** | 零运维（单文件安装） | 高运维（Docker Compose 多容器） |
| **扩展性** | 垂直扩展（单机性能） | 水平扩展（微服务集群） |

---

## 二、技术栈全面对比

### 2.1 语言与运行时

| 层级 | CodeInsights | Shannon |
|------|-------------|---------|
| **主运行时** | Bun 1.2.5+（TypeScript） | Go 1.24 / Rust 1.75+ / Python 3.11+ |
| **桌面框架** | Electron 39.5.1 | Tauri v2（Rust） |
| **前端框架** | React 18.3.1 + Vite 6.0.3 | Next.js 16 + App Router |
| **前端语言** | TypeScript 5.0+ | TypeScript 5.9+ |
| **后端服务** | 无独立后端（主进程即后端） | Go Gateway + Go Orchestrator + Rust Agent Core + Python LLM Service |

### 2.2 状态管理

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **方案** | Jotai 2.17.1（原子化状态管理） | Zustand 5.0.9 + Redux Toolkit 2.10.1 |
| **持久化** | JSON + JSONL 文件系统 | PostgreSQL + Redis + Dexie.js（IndexedDB） |
| **会话隔离** | `Map<sessionId, State>` | Temporal Workflows + 数据库 |
| **核心状态文件** | `agent-atoms.ts`（962 行） | `runSlice.ts`（1502 行） |

**CodeInsights Jotai Map 设计**：

```typescript
// 所有 per-session 状态使用 Map 结构，支持多会话并行
export const agentStreamingStatesAtom = atom<Map<string, AgentStreamState>>(new Map())

// 派生 atom：自动投影当前会话的流式状态
export const currentAgentStreamStateAtom = atom(
  (get) => {
    const currentId = get(currentAgentSessionIdAtom)
    return get(agentStreamingStatesAtom).get(currentId)
  }
)

// 全局监听使用 useStore() 直接操作 atoms，绕过 React 生命周期
export function useGlobalAgentListeners() {
  const store = useStore()
  useEffect(() => {
    const cleanup = window.electronAPI.onAgentStreamEvent((payload) => {
      store.set(agentStreamingStatesAtom, (prev) => {
        const next = new Map(prev)
        const state = next.get(payload.sessionId) ?? defaultStreamState
        next.set(payload.sessionId, applyAgentEvent(state, payload.event))
        return next
      })
    })
    return cleanup
  }, [store])
}
```

**关键差异**：CodeInsights 用 Jotai 的细粒度订阅避免不必要的重渲染；Shannon 用 Redux Toolkit 处理复杂的状态机转换（50+ 事件类型）。

### 2.3 桌面端架构差异

| 维度 | CodeInsights（厚客户端） | Shannon（轻客户端） |
|------|------------------------|---------------------|
| **逻辑位置** | 所有业务逻辑在本地主进程 | 所有逻辑在远程服务端 API |
| **Tauri 后端** | N/A（使用 Electron） | 极简（17 行 Rust，仅 shell + log 插件） |
| **本地存储** | JSON/JSONL 文件系统 | Dexie.js（IndexedDB）缓存 |
| **流式处理** | IPC `webContents.send()` | SSE EventSource + delta 缓冲 |
| **离线能力** | 完全离线（除调用 LLM API） | 必须连接后端服务 |
| **包体积** | ~200MB+（含 Chromium） | ~10MB（Tauri WebView） |
| **内存占用** | ~300-500MB | ~100-200MB |
| **启动时间** | ~3-5 秒 | ~1-2 秒 |

### 2.4 UI 组件与样式

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **UI 库** | Radix UI + 自建组件（CVA） | shadcn/ui + Radix UI |
| **样式方案** | Tailwind CSS 3.4.17 | Tailwind CSS v4 |
| **富文本编辑** | TipTap 3.19.0（6 个扩展） | 未明确 |
| **代码高亮** | Shiki 3.22.0（语法高亮） | rehype-highlight |
| **Markdown** | React Markdown 10.1.0 + remark-gfm + KaTeX | react-markdown 10.1.0 |
| **图表** | Beautiful Mermaid（流程图/时序图） | @xyflow/react（工作流可视化） |
| **数学公式** | KaTeX 0.16+ | ❌ 不支持 |
| **图标** | Lucide React | Lucide React |
| **命令面板** | cmdk 1.1.1 | ❌ 未明确 |
| **Toast 通知** | sonner | 未明确 |

### 2.5 构建工具链

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **包管理器** | Bun（workspace） | npm（Desktop）/ Go modules / Cargo / pip |
| **Monorepo** | Bun Workspace（4 个包） | 多语言混合（非传统 monorepo） |
| **主进程构建** | esbuild 0.24.0+（→ CJS） | Rust（Tauri 内置） |
| **渲染进程构建** | Vite 6.0.3 | Next.js（静态导出） |
| **打包分发** | electron-builder 25.1.8 | Tauri CLI（内置） |
| **开发热重载** | Vite HMR + electronmon | Tauri dev mode（含 Rust 热重载） |
| **CI/CD** | 仅 GitHub Pages 部署 | GitHub Actions：多语言并行构建测试 |

**CodeInsights 构建配置关键细节**：

```yaml
# electron-builder.yml
appId: com.codeinsights.app
asar: false                    # 禁用 ASAR，避免 SDK symlink 路径越界
npmRebuild: false              # 跳过 npm install，代码已被 esbuild/Vite 打包
files:
  - dist/**/*
  - node_modules/@anthropic-ai/claude-agent-sdk/**/*          # SDK 主包
  - node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/**/*  # 平台子包
  - node_modules/@anthropic-ai/claude-agent-sdk-darwin-x64/**/*
  - node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/**/*
  - "!node_modules/@codeinsights/**"   # 排除 workspace 包（代码已打包）
```

### 2.6 AI Provider 支持

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **适配器模式** | 3 个适配器覆盖 12 个供应商 | Python 抽象层，每个供应商独立实现 |
| **Agent SDK** | @anthropic-ai/claude-agent-sdk 0.2.123 | 自研 Agent Loop（Python） |
| **流式协议** | SSE（通用 SSE 读取器） | SSE + WebSocket |
| **多模态** | 图片、文档（PDF/Office/文本） | 未明确 |
| **思考模式** | 策略模式（adaptive / enabled / effort-based-max） | 未明确 |
| **模型降级** | ❌ 无 | ✅ 按复杂度自动路由 small/medium/large |

**CodeInsights Provider 注册表**：

```typescript
const adapterRegistry = new Map<ProviderType, ProviderAdapter>([
  ['anthropic', new AnthropicAdapter()],
  ['openai', new OpenAIAdapter()],
  ['deepseek', new AnthropicAdapter('deepseek')],
  ['moonshot', new OpenAIAdapter()],
  ['kimi-api', new AnthropicAdapter('kimi-api')],
  ['kimi-coding', new AnthropicAdapter('kimi-coding')],
  ['zhipu', new OpenAIAdapter()],
  ['minimax', new OpenAIAdapter()],
  ['doubao', new OpenAIAdapter()],
  ['qwen', new OpenAIAdapter()],
  ['custom', new OpenAIAdapter()],
  ['google', new GoogleAdapter()],
])
```

**思考模式策略选择器**：

```typescript
function getThinkingCapability(provider: ProviderType, modelId: string): ThinkingCapability {
  if (modelId.includes('claude-opus-4-7')) return { mode: 'adaptive' }
  if (modelId.includes('claude-opus-4-6') || modelId.includes('claude-sonnet-4-6')) {
    return { mode: 'adaptive' }
  }
  if (provider === 'deepseek' && modelId.includes('v4')) {
    return { mode: 'enabled', outputConfig: { effort: 'max' } }
  }
  if (provider === 'moonshot') return { mode: 'effort-based-max' }
  return { mode: 'none' }
}
```

---

## 三、架构设计深度对比

### 3.1 整体架构模式

#### CodeInsights：单体 Electron 应用

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron 桌面应用                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  主进程      │  │  Preload    │  │    渲染进程          │  │
│  │ (Node.js)   │←→│  (桥接层)   │←→│  (React + Vite)     │  │
│  │             │  │             │  │                     │  │
│  │ • IPC 处理   │  │ • 安全隔离   │  │ • UI 渲染           │  │
│  │ • 服务层     │  │ • API 暴露   │  │ • 状态管理 (Jotai)  │  │
│  │ • 文件系统   │  │             │  │ • 全局监听           │  │
│  │ • Agent SDK │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  本地存储: ~/.codeinsights/ (JSON + JSONL)                    │
│  外部依赖: LLM API (HTTP/SSE)                                │
└─────────────────────────────────────────────────────────────┘
```

**四层同步 IPC 架构**（以渠道列表为例）：

```typescript
// 第①层：shared 包定义
export const CHANNEL_IPC_CHANNELS = {
  LIST: 'channel:list',
  CREATE: 'channel:create',
} as const

// 第②层：主进程注册处理器
ipcMain.handle(CHANNEL_IPC_CHANNELS.LIST, async (): Promise<Channel[]> => {
  return listChannels()
})

// 第③层：Preload 桥接暴露 API
listChannels: () => ipcRenderer.invoke(CHANNEL_IPC_CHANNELS.LIST)

// 第④层：渲染进程调用
const channels = await window.electronAPI.listChannels()
```

**关键安全设计**：
- `contextIsolation: true` — 渲染进程和 Preload 上下文完全隔离
- `nodeIntegration: false` — 渲染进程不能直接访问 Node.js
- API Key 使用 Electron `safeStorage` 加密（macOS Keychain / Windows DPAPI / Linux Secret Service）

#### Shannon：云原生微服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Web UI     │  │  Desktop    │  │    Python SDK       │  │
│  │ (Next.js)   │  │ (Tauri)     │  │    / REST API       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         └─────────────────┴────────────────────┘            │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Gateway (Go) :8080                        │ │
│  │  • REST API / gRPC  • Auth (JWT/API Key)               │ │
│  │  • Rate Limiting  • 路由分发                           │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Orchestrator (Go) :50052                     │ │
│  │  • Temporal Workflows  • Task Decomposition            │ │
│  │  • Budget Management  • Complexity Routing             │ │
│  │  • Pattern Selection  • Strategy Routing               │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Agent Core (Rust) :50051                     │ │
│  │  • Enforcement Gateway  • WASI Sandbox                 │ │
│  │  • Token Counting  • Circuit Breaker                   │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           LLM Service (Python) :8000                   │ │
│  │  • Provider Abstraction  • MCP Tools                   │ │
│  │  • Agent Loop  • Tool Execution                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  基础设施: PostgreSQL + Redis + Temporal + Docker           │
└─────────────────────────────────────────────────────────────┘
```

**gRPC 服务定义**（Agent Core）：

```protobuf
service AgentService {
  rpc ExecuteTask(ExecuteTaskRequest) returns (ExecuteTaskResponse);
  rpc StreamExecuteTask(ExecuteTaskRequest) returns (stream TaskUpdate);
  rpc GetCapabilities(GetCapabilitiesRequest) returns (GetCapabilitiesResponse);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}

message TaskUpdate {
  string task_id = 1;
  AgentState state = 2;     // IDLE/PLANNING/EXECUTING/WAITING/COMPLETED/FAILED
  string message = 3;
  double progress = 6;
  string delta = 7;         // Token delta for streaming
}
```

### 3.2 进程/服务模型对比

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **进程数量** | 2（主进程 + 渲染进程） | 7+ 服务（Gateway + Orchestrator + Agent Core + LLM Service + Temporal + PostgreSQL + Redis） |
| **通信方式** | IPC（Electron 内置） | HTTP/gRPC（服务间） |
| **部署复杂度** | 低（单文件安装） | 高（Docker Compose 多容器） |
| **启动时间** | 快（秒级） | 慢（分钟级，需拉取镜像） |
| **资源占用** | 较低（Electron 开销） | 较高（多容器 + 数据库） |
| **运维要求** | 零运维 | 需要 Docker + 容器管理知识 |

### 3.3 AI Agent 编排对比

#### CodeInsights：单层 SDK 编排

```
用户输入
  ↓
agent-orchestrator.ts（单一 TypeScript 文件，2169 行）
  ↓ 调用
SDK query() → SDKMessage 流
  ↓ 转换
convertSDKMessage() → AgentEvent[]
  ↓ IPC 推送
webContents.send() → 渲染进程
  ↓
useGlobalAgentListeners → Jotai atoms → React UI
```

**核心编排代码结构**：

```typescript
export interface SessionCallbacks {
  onError: (error: string) => void
  onComplete: (messages?: AgentMessage[], opts?: { stoppedByUser?: boolean }) => void
  onTitleUpdated: (title: string) => void
}

export async function sendAgentMessage(
  input: AgentSendInput,
  callbacks: SessionCallbacks,
  abortController: AbortController
): Promise<void> {
  // 1. 并发守卫：检查同一会话是否已有进行中的请求
  // 2. 渠道查找 + API Key 解密（safeStorage）
  // 3. 环境变量构建：{ ...process.env, ...customEnv }，过滤 ANTHROPIC_* 敏感变量
  // 4. 工作区上下文注入：MCP 配置、Skills、附件目录
  // 5. SDK query() 调用 → SDKMessage 流
  // 6. convertSDKMessage() → AgentEvent[] 转换
  // 7. EventBus 分发 → IPC 推送
  // 8. 消息持久化：追加写入 JSONL
  // 9. 自动标题：首次对话生成摘要标题
}
```

**环境变量传递关键设计**（SDK 0.2.113+ `options.env` 为"替换"语义）：

```typescript
function buildSdkEnv(customEnv: Record<string, string>): Record<string, string> {
  const env = { ...process.env, ...customEnv }
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.ANTHROPIC_CUSTOM_HEADERS
  delete env.ANTHROPIC_MODEL
  return env
}
```

#### Shannon：多层微服务编排

```
用户请求 → Gateway
  ↓
OrchestratorRouter（模式选择）
  ↓
Pattern Analysis → 认知模式选择
  ├── Chain of Thought (CoT) - 顺序推理
  ├── Tree of Thoughts (ToT) - 回溯探索
  ├── ReAct - 推理+行动循环
  ├── Debate - 多 Agent 辩论
  └── Reflection - 自改进迭代
  ↓
Temporal Workflow 执行
  ↓
Agent Core（Rust）执行工具
  ↓
LLM Service（Python）调用模型
  ↓
结果合成 → 会话更新 → 响应
```

### 3.4 执行策略对比

| 策略 | CodeInsights | Shannon |
|------|-------------|---------|
| **简单任务** | 直接调用 Agent SDK | SimpleTaskWorkflow（单 Agent） |
| **多步任务** | Agent SDK 内部处理 | DAGWorkflow（扇出/扇入） |
| **推理任务** | 由模型自身决定 | ReActWorkflow（推理+工具循环） |
| **研究任务** | 无内置策略 | ResearchWorkflow（分层模型降本 50-70%） |
| **探索任务** | 无内置策略 | ExploratoryWorkflow（并行假设探索） |
| **浏览器任务** | 无 | BrowserUseWorkflow（Playwright） |
| **多 Agent** | Agent Teams（自动组建） | SwarmWorkflow（Lead 编排 + 收敛检测） |

---

## 四、核心功能对比

### 4.1 功能矩阵

| 功能 | CodeInsights | Shannon |
|------|:-----------:|:-------:|
| **多供应商 Chat** | ✅ | ✅（OpenAI-compatible API） |
| **Agent 模式** | ✅（Claude Agent SDK） | ✅（自研 Agent Loop） |
| **Agent Teams** | ✅（自动组建） | ✅（Swarm） |
| **Skills / MCP** | ✅ | ✅ |
| **记忆系统** | ✅（跨会话共享） | ✅（Session Continuity + Vector） |
| **工作区隔离** | ✅ | ✅（Session Workspaces） |
| **权限管理** | ✅（safe/ask/allow-all） | ✅（OPA Policy） |
| **人工审核** | ✅（AskUser + Permission） | ✅（Approval Gates） |
| **远程使用** | ✅（飞书/钉钉/微信机器人） | ✅（WebSocket Daemon） |
| **Token 预算** | ❌ | ✅（硬预算 + 自动降级） |
| **Time-Travel Debug** | ❌ | ✅（Temporal Replay） |
| **可观测性** | ❌ | ✅（Prometheus + OpenTelemetry） |
| **定时任务** | ❌ | ✅（Cron 表达式） |
| **浏览器自动化** | ❌ | ✅（Playwright） |
| **向量搜索** | ❌ | ✅（Embeddings + Chunking） |
| **WASI 沙箱** | ❌ | ✅ |
| **速率限制** | ❌ | ✅（Gateway 层） |
| **多租户** | ❌ | ✅ |
| **自动更新** | ✅（Electron Updater） | ✅（Tauri Updater） |
| **文档解析** | ✅（PDF/Office/文本） | ❌ |
| **附件上传** | ✅（图片 + 文档） | ❌ |
| **代码高亮** | ✅（Shiki） | ✅（rehype-highlight） |
| **Mermaid 图表** | ✅ | ❌ |
| **数学公式** | ✅（KaTeX） | ❌ |
| **飞书集成** | ✅ | ❌ |
| **本地优先** | ✅ | ❌（云端优先） |

### 4.2 独特优势对比

**CodeInsights**：
1. **本地优先**：所有数据存在本地，无需数据库，完全可移植
2. **IM 集成**：深度集成飞书/钉钉/微信，支持远程操控和群聊协作
3. **文档解析**：内置 PDF/Office/文本文件解析，支持附件对话
4. **多模态**：图片、文档附件直接注入对话
5. **UI 丰富度**：Mermaid 图表、KaTeX 数学公式、Shiki 代码高亮
6. **轻量部署**：单文件安装，秒级启动
7. **Bun 全栈**：统一运行时和包管理，开发体验流畅

**Shannon**：
1. **生产级可靠性**：Temporal 工作流保证执行不丢失，支持 time-travel debugging
2. **成本优化**：Token 硬预算 + 自动模型降级 + Research 策略降本 50-70%
3. **安全沙箱**：WASI 隔离代码执行，OPA 策略引擎控制权限
4. **可观测性**：Prometheus 指标 + OpenTelemetry 追踪 + 结构化日志
5. **认知模式**：5 种认知架构 + 8 种执行策略，自动匹配任务复杂度
6. **浏览器自动化**：Playwright 支持网页交互任务
7. **多租户**：JWT/API Key 认证 + 租户隔离
8. **向量搜索**：Embeddings + Chunking + MMR 多样性重排序

---

## 五、性能基准与资源占用

### 5.1 桌面应用性能

| 指标 | CodeInsights (Electron) | Shannon Desktop (Tauri) | 差异 |
|------|------------------------|-------------------------|------|
| **安装包体积** | ~200MB+ | ~10MB | Tauri 轻 95% |
| **内存占用（空闲）** | ~300-500MB | ~100-200MB | Tauri 低 60% |
| **内存占用（Agent 运行）** | ~600-900MB | ~300-500MB（含后端） | 视场景 |
| **冷启动时间** | ~3-5s | ~1-2s | Tauri 快 60% |
| **热启动时间** | ~1-2s | ~0.5s | Tauri 快 50% |
| **UI 渲染帧率** | 60fps（Chromium） | 60fps（WebView） | 持平 |
| **大文件处理（10MB PDF）** | 本地直接读取 | 需上传到服务端 | CodeInsights 更优 |

### 5.2 后端服务性能（Shannon）

| 指标 | 数值 | 说明 |
|------|------|------|
| **Tool Discovery** | <0.5ms | Agent Core Rust 层 |
| **Cache Hit** | >80% | LRU 缓存命中率 |
| **Enforcement Gateway** | <0.05ms | 请求策略检查 |
| **WASI 执行** | 10-100ms | 含沙箱启动开销 |
| **Workflow 启动** | ~50-200ms | Temporal 工作流调度 |

### 5.3 存储性能对比

| 指标 | CodeInsights（JSONL） | Shannon（PostgreSQL） |
|------|---------------------|----------------------|
| **消息追加写入** | ~0.1ms | ~5-10ms |
| **消息读取（1000条）** | ~50ms | ~20ms |
| **会话列表查询** | ~1ms | ~5ms |
| **全文搜索** | ❌ 不支持 | ~100ms（FTS） |
| **数据容量** | 受限于磁盘 | TB 级 |
| **并发写入** | 单进程文件锁 | 高并发（MVCC） |
| **备份恢复** | 文件复制 | pg_dump / PITR |

---

## 六、开发者体验（DX）对比

### 6.1 开发环境搭建

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **前置依赖** | Bun 1.2.5+ | Docker + Docker Compose + Go + Rust + Python |
| **首次启动** | `bun install && bun run dev`（~2 分钟） | `make setup && make dev`（~10 分钟，需拉镜像） |
| ** IDE 支持** | VSCode + TypeScript 完美支持 | 多语言：GoLand/VSCode（Go）、RustRover（Rust）、PyCharm（Python） |
| **调试体验** | Chrome DevTools（渲染进程）+ VSCode（主进程） | VSCode（多语言）+ Temporal Web UI |
| **热重载** | Vite HMR（即时）+ electronmon（主进程重启 ~3s） | Tauri dev mode（即时）+ Go/Rust 编译（~5-10s） |

### 6.2 代码组织与可维护性

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **代码总量** | ~77K 行（单一语言） | ~50K+ 行（三语言混合） |
| **模块数量** | 66 个主进程服务 + 14 个组件目录 | 38 个 Go 包 + 21 个 Rust 模块 + Python 服务 |
| **接口契约** | TypeScript 类型（编译时检查） | Protobuf + gRPC（跨语言契约） |
| **文档完整度** | AGENTS.md 详细（~200 行） | AGENTS.md + 多个 docs/ 文件 |
| **类型安全** | strict TypeScript（无 any） | Go + Rust 强类型，Python 用 Pydantic |

### 6.3 依赖维护负担

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **主要依赖数** | ~40 个（npm） | ~100+ 个（跨三语言） |
| **安全扫描** | 未配置 | `cargo audit` + Dependabot |
| **版本升级** | 简单（Bun workspace 统一） | 复杂（三语言分别升级） |
| **破坏性变更风险** | 中（Electron + SDK 升级） | 高（Temporal + Protobuf + 多服务协调） |

---

## 七、测试策略与工程质量对比

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **单元测试** | 极少（仅 1 个测试文件） | `cargo test` + `go test -race` + `pytest` |
| **集成测试** | 无 | `tests/integration/`（shell 脚本驱动） |
| **E2E 测试** | BDD 声明（无实际测试） | `tests/e2e/` + `make smoke` |
| **工作流回放** | 无 | Temporal Replay（确定性验证） |
| **覆盖率门槛** | 无 | Go 50%+ / Python 20%+ |
| **CI/CD** | 仅 GitHub Pages 部署 | GitHub Actions：proto → Go‖Rust‖Python 并行构建 |
| **Lint** | ESLint | Go lint + Rust clippy + Python flake8 |

**关键发现**：CodeInsights 的测试覆盖率接近于零，这是生产级项目的主要短板。唯一的测试文件：

```typescript
import { test, expect } from "bun:test"
import { diffCapabilities } from "./capabilities-diff"

test("diffCapabilities detects added capabilities", () => {
  const oldCaps = { tools: ["read", "write"] }
  const newCaps = { tools: ["read", "write", "edit"] }
  expect(diffCapabilities(oldCaps, newCaps)).toEqual({ added: ["edit"], removed: [] })
})
```

**Shannon CI/CD 配置**：

```yaml
name: CI
on: [push, pull_request]

jobs:
  proto:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make proto
      - uses: actions/upload-artifact@v4
        with: { name: proto-generated, path: go/orchestrator/internal/pb/** }

  go:
    needs: proto
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: proto-generated }
      - run: |
          cd go/orchestrator
          go test -race -coverprofile=coverage.out ./...
          go tool cover -func=coverage.out | grep total

  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          cd rust/agent-core
          cargo test --lib
          cargo clippy -- -D warnings

  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          cd python/llm-service
          pip install -r requirements.txt
          pytest --cov=. --cov-report=xml
```

---

## 八、事件系统与流式架构对比

### CodeInsights：IPC 流式事件

- **通道**：Electron IPC（`webContents.send()`）
- **事件类型**：`AgentEvent`（text / tool_start / tool_result / done / error）
- **处理模式**：主进程推送 → Preload 桥接 → 全局监听 → Jotai atoms → React UI
- **特点**：本地进程间通信，延迟 < 1ms，但仅限单机

```typescript
export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; tool: ToolActivity }
  | { type: 'tool_result'; toolUseId: string; result: string; isError?: boolean }
  | { type: 'complete'; messages: AgentMessage[] }
  | { type: 'error'; message: string }

// 事件溯源：纯函数更新状态
export function applyAgentEvent(state: AgentStreamState, event: AgentEvent): AgentStreamState {
  switch (event.type) {
    case 'text_delta':
      return { ...state, content: state.content + event.text }
    case 'tool_start':
      return { ...state, toolActivities: [...state.toolActivities, event.tool] }
    case 'tool_result':
      return {
        ...state,
        toolActivities: state.toolActivities.map(ta =>
          ta.toolUseId === event.toolUseId
            ? { ...ta, result: event.result, isError: event.isError, done: true }
            : ta
        )
      }
    case 'complete':
      return { ...state, status: 'completed', messages: event.messages }
    case 'error':
      return { ...state, status: 'error', error: event.message }
    default:
      return state
  }
}
```

### Shannon：SSE + WebSocket 流式事件

- **协议**：SSE（EventSource）+ WebSocket（daemon 模式）
- **事件类型**：50+ 结构化事件类型
- **处理模式**：Redis Streams 缓冲（~24h TTL）→ SSE 推送 → Desktop delta 缓冲 → Redux state machine
- **特点**：支持远程实时流、事件持久化、多客户端订阅

```typescript
export type EventType =
  | "thread.message.delta"
  | "LLM_OUTPUT"
  | "TOOL_INVOKED"
  | "TOOL_COMPLETED"
  | "WORKFLOW_STARTED"
  | "WORKFLOW_COMPLETED"
  | "AGENT_STARTED"
  | "AGENT_THINKING"
  | "PROGRESS"
  | "APPROVAL_REQUESTED"
  | "BUDGET_THRESHOLD"
  | "ROLE_ASSIGNED"
  | "TEAM_RECRUITED"
  | "ERROR_OCCURRED"
  | "ERROR_RECOVERY"

export interface BaseEvent {
  type: EventType
  workflow_id: string
  agent_id?: string
  seq?: number
  timestamp?: string
}
```

---

## 九、Skills 系统对比

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **格式** | 工作区 `skills/` 目录下的独立文件 | Markdown + YAML frontmatter |
| **配置位置** | `~/.codeinsights/agent-workspaces/{slug}/skills/` | `config/skills/user/`（gitignored） |
| **内置 Skills** | code-reviewer, explorer（代码硬编码） | 未明确 |
| **加载方式** | 工作区启动时同步 | 服务启动时扫描 + 热重载 |

**Shannon Skills 文件示例**：

```markdown
---
name: code-review
version: "1.0"
description: 对代码变更进行多维度审查
category: development
---
```

## 十、存储与持久化对比

### CodeInsights：文件系统优先

```
~/.codeinsights/
├── channels.json              # 渠道配置（API Key AES-256-GCM 加密）
├── conversations.json         # 对话索引
├── conversations/             # 消息存储（JSONL 追加写入）
├── agent-sessions.json        # Agent 会话索引
├── agent-sessions/            # Agent 消息存储（JSONL）
├── agent-workspaces/          # 工作区目录
│   ├── {workspace-slug}/
│   │   ├── {session-id}/      # 会话工作目录
│   │   ├── workspace-files/   # 工作区持久文件
│   │   ├── mcp.json          # MCP Server 配置
│   │   └── skills/            # Skills 配置
├── attachments/               # 附件文件
├── user-profile.json          # 用户档案
└── settings.json              # 应用设置
```

**设计哲学**：JSON 适合配置和索引；JSONL 适合消息日志（追加写入、流式读取、损坏容灾）；无数据库依赖，文件可移植。

### Shannon：数据库优先

```
PostgreSQL
├── task_executions            # 任务执行记录
├── sessions                   # 会话状态
├── users                      # 用户/租户信息
├── api_keys                   # API 密钥
└── ...                        # 其他业务表

Redis
├── session_cache              # 会话缓存（TTL）
├── rate_limit                 # 速率限制计数器
├── workflow_events            # 工作流事件流（~24h TTL）
└── ...                        # 其他缓存数据

Temporal
├── workflow_history           # 工作流执行历史（持久化）
└── ...                        # Temporal 内部存储
```

---

## 十一、安全设计对比

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **API Key 存储** | AES-256-GCM 加密（safeStorage） | 环境变量 / 数据库 |
| **环境变量隔离** | 清理 `ANTHROPIC_*` 防止泄漏 | 标准环境变量传递 |
| **代码执行隔离** | 依赖操作系统权限 | WASI 沙箱（WebAssembly） |
| **权限控制** | 三级模式（safe / ask / allow-all） | OPA Policy Engine（Rego） |
| **认证机制** | 无（本地单用户） | JWT + API Key + 多租户 |
| **速率限制** | 无 | Gateway 层（Redis 支持分布式） |
| **熔断降级** | 无 | Circuit Breaker + 自动降级策略 |
| **审计日志** | 无 | 结构化 JSON 日志 + OpenTelemetry |

**CodeInsights API Key 加密**：

```typescript
import { safeStorage } from 'electron'

function encryptApiKey(plainKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[渠道管理] safeStorage 加密不可用，将以明文存储')
    return plainKey
  }
  const encrypted = safeStorage.encryptString(plainKey)
  return encrypted.toString('base64')
}
```

**Shannon OPA 策略**：

```rego
package shannon.task
import future.keywords.if
import future.keywords.in

default allow := false

allow if {
  input.task.complexity < 0.3
  input.user.tier != "blocked"
}

allow if {
  input.task.complexity >= 0.3
  input.task.approval_status == "approved"
  input.user.quota_remaining > 0
}

deny contains "rate_limit_exceeded" if {
  input.user.requests_1m > input.user.rate_limit_rpm
}
```

---

## 十二、错误处理与容错机制对比

### 12.1 错误处理策略

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **错误类型** | SDK 错误 + 网络错误 + 文件系统错误 | 服务间错误 + 工作流失败 + 策略拒绝 |
| **重试机制** | 网络错误自动重试（指数退避） | Temporal 内建重试（最多 10 次） |
| **降级策略** | 无 | 复杂→标准→简单模式自动降级 |
| **错误展示** | Toast 通知 + 流式错误事件 | SSE 错误事件 + 结构化日志 |
| **熔断器** | 无 | Circuit Breaker（Redis 分布式） |

### 12.2 关键错误场景处理

**CodeInsights**：
- **SDK 错误**：`mapSDKErrorToTypedError()` 统一映射，区分 prompt-too-long、rate-limit、auth-fail
- **网络错误**：`isTransientNetworkError()` 判断，自动重试 3 次
- **文件系统错误**：优雅降级，提示用户检查权限

**Shannon**：
- **工作流失败**：Temporal 自动重试 + 死信队列
- **服务不可用**：Circuit Breaker 打开，自动降级到简单模式
- **预算超限**：硬限制，返回 budget_exceeded 错误
- **策略拒绝**：OPA 返回具体拒绝原因，记录审计日志

---

## 十三、内存系统与记忆机制对比

### 13.1 记忆系统架构

| 维度 | CodeInsights | Shannon |
|------|-------------|---------|
| **记忆类型** | 跨会话文本记忆（MemOS 风格） | 向量语义记忆 + 会话历史 |
| **存储位置** | `~/.codeinsights/` 本地文件 | PostgreSQL + Qdrant 向量数据库 |
| **检索方式** | 关键词匹配 | 语义相似度搜索（Embeddings） |
| **记忆注入** | 系统提示词自动注入 | 上下文窗口自动注入 |
| **隐私控制** | 用户完全控制 | 租户隔离 |

### 13.2 实现细节

**CodeInsights 记忆服务**：

```typescript
// memory-service.ts + memos-client.ts
// 基于 MemOS 风格的记忆系统

interface MemoryEntry {
  id: string
  content: string
  category: 'preference' | 'fact' | 'habit'
  createdAt: number
  updatedAt: number
}

// 记忆写入（Agent/Chat 共享）
async function addMemory(content: string, category: MemoryCategory): Promise<void>

// 记忆检索（按关键词）
async function searchMemory(query: string, limit?: number): Promise<MemoryEntry[]>

// 记忆格式化注入提示词
function formatSearchResult(entries: MemoryEntry[]): string
```

**Shannon 向量记忆**：

```python
# Python LLM Service 中的向量记忆
from qdrant_client import QdrantClient

class VectorMemory:
    def __init__(self, qdrant_url: str, embedding_model: str):
        self.client = QdrantClient(qdrant_url)
        self.embedder = OpenAIEmbeddings(model=embedding_model)

    async def add_memory(self, text: str, session_id: str):
        embedding = await self.embedder.aembed_query(text)
        self.client.upsert(
            collection_name="memories",
            points=[PointStruct(id=uuid(), vector=embedding, payload={"text": text, "session_id": session_id})]
        )

    async def search(self, query: str, session_id: str, top_k: int = 5):
        query_embedding = await self.embedder.aembed_query(query)
        return self.client.search(
            collection_name="memories",
            query_vector=query_embedding,
            query_filter=Filter(must=[FieldCondition(key="session_id", match=MatchValue(value=session_id))]),
            limit=top_k
        )
```

---

## 十四、融合方案

### 14.1 融合愿景

将 CodeInsights 的**本地优先、丰富 UI、IM 集成**优势，与 Shannon 的**生产级编排、成本优化、可观测性、安全沙箱**优势相结合，打造一款既适合个人开发者又具备企业级能力的下一代 AI Agent 平台。

### 14.2 融合架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         融合后的 CodeInsights v2.0                            │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      桌面客户端（Tauri + Next.js）                      │  │
│  │  • Next.js 16 App Router 替代 React + Vite                             │  │
│  │  • Tauri v2 替代 Electron（更轻量、更安全）                             │  │
│  │  • Zustand + Jotai 混合状态管理                                         │  │
│  │  • shadcn/ui + Radix UI + Tailwind CSS v4                              │  │
│  │  • Dexie.js 本地缓存（IndexedDB）                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      本地服务层（可选启用）                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐   │  │
│  │  │ 轻量编排器   │  │ 文件系统服务 │  │      IM Bridge 服务          │   │  │
│  │  │ (Bun/TS)    │  │ (Rust/Tauri)│  │  (飞书/钉钉/微信)            │   │  │
│  │  │             │  │             │  │                              │   │  │
│  │  │ • 简单任务   │  │ • 工作区管理 │  │ • 消息同步                   │   │  │
│  │  │ • Agent SDK │  │ • 文件监听   │  │ • 远程命令                   │   │  │
│  │  │ • 本地记忆   │  │ • 附件管理   │  │ • 群组协作                   │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      云端服务层（可选连接）                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐   │  │
│  │  │ 云端编排器   │  │ Agent Core  │  │      LLM Service             │   │  │
│  │  │ (Go/Temporal)│  │ (Rust/WASI) │  │  (Python)                    │   │  │
│  │  │             │  │             │  │                              │   │  │
│  │  │ • 复杂任务   │  │ • 沙箱执行   │  │ • 多供应商适配               │   │  │
│  │  │ • 认知模式   │  │ • 工具编排   │  │ • MCP 工具                   │   │  │
│  │  │ • 预算管理   │  │ • 安全隔离   │  │ • 浏览器自动化               │   │  │
│  │  │ • 可观测性   │  │ • 熔断降级   │  │ • 向量搜索                   │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  存储层: JSON/JSONL（本地） + PostgreSQL/Redis（云端）                       │
│  通信:   Tauri IPC（本地） + HTTP/gRPC/WebSocket（云端）                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 14.3 技术融合策略

#### 14.3.1 前端框架升级（P0）

1. **框架迁移**：React 18 + Vite → Next.js 16 App Router
2. **桌面运行时**：Electron → Tauri v2（包体积从 ~200MB 降至 ~10MB）
3. **UI 组件**：统一 shadcn/ui + Radix UI + Tailwind CSS v4
4. **状态管理**：保留 Jotai（轻量状态），引入 Zustand（复杂工作流状态）

#### 14.3.2 编排层增强（P1）

1. **本地轻量编排器**（Bun/TypeScript）：
   - 保留 `agent-orchestrator.ts` 处理简单任务
   - 引入 LangGraph 处理多步任务
   - 支持简单 DAG 执行
2. **云端编排器**（Go/Temporal，可选）：
   - 集成 Shannon Orchestrator
   - 复杂任务自动路由到云端

```typescript
function selectOrchestrator(task: Task): Orchestrator {
  if (task.complexity < 0.3 && !task.requiresSandbox) {
    return localOrchestrator
  }
  if (cloudOrchestrator.isConnected()) {
    return cloudOrchestrator
  }
  return localOrchestrator.withLimitedFeatures()
}
```

#### 14.3.3 安全沙箱引入（P2）

- 可选 WASI 沙箱（Docker 内运行 Rust Agent Core）
- 轻量 OPA WASM 版本用于本地策略检查

#### 14.3.4 成本优化（P2）

- per-task Token 预算
- 自动模型降级（大模型 → 小模型）
- 预估节省 50-70% 成本

#### 14.3.5 可观测性增强（P2）

- 结构化 JSON 日志
- 轻量 Prometheus 客户端
- 可选云端 OpenTelemetry

#### 14.3.6 IM 集成保留（P1）

- 迁移到 Tauri 侧car
- 支持云端 Bridge 部署

### 14.4 融合后的技术栈

| 层级 | 融合后方案 | 来源 |
|------|-----------|------|
| **桌面运行时** | Tauri v2 | Shannon |
| **前端框架** | Next.js 16 + App Router | Shannon |
| **状态管理** | Zustand + Jotai | 融合 |
| **UI 组件** | shadcn/ui + Radix UI | Shannon |
| **样式** | Tailwind CSS v4 | Shannon |
| **本地服务** | Bun + TypeScript | CodeInsights |
| **包管理** | Bun Workspace | CodeInsights |
| **云端编排** | Go + Temporal | Shannon |
| **安全沙箱** | Rust + WASI | Shannon |
| **LLM 服务** | Python + FastAPI | Shannon |
| **存储（本地）** | JSON + JSONL | CodeInsights |
| **存储（云端）** | PostgreSQL + Redis | Shannon |
| **可观测性** | OpenTelemetry + Prometheus | Shannon |
| **IM 集成** | 飞书/钉钉/微信 Bridge | CodeInsights |
| **文档解析** | PDF/Office/文本 | CodeInsights |
| **代码高亮** | Shiki | CodeInsights |
| **Mermaid** | Beautiful Mermaid | CodeInsights |
| **KaTeX** | 数学公式 | CodeInsights |

### 14.5 统一 API 层设计

```typescript
interface UnifiedAPI {
  createSession(input: CreateSessionInput): Promise<SessionMeta>
  listSessions(filter?: SessionFilter): Promise<SessionMeta[]>
  sendMessage(input: SendMessageInput): Promise<void>
  stopSession(sessionId: string): Promise<void>
  onStreamEvent(callback: (event: StreamEvent) => void): Unsubscribe
  listChannels(): Promise<Channel[]>
  listWorkspaces(): Promise<Workspace[]>
  approvePermission(requestId: string, response: PermissionResponse): Promise<void>
  getBridgeStatus(type: 'feishu' | 'dingtalk' | 'wechat'): Promise<BridgeStatus>
}

// 本地实现（Tauri Command）
class LocalAPI implements UnifiedAPI {
  async sendMessage(input: SendMessageInput): Promise<void> {
    await invoke('send_message', { input })
  }
  async onStreamEvent(callback: (event: StreamEvent) => void): Unsubscribe {
    return await listen('stream_event', (e) => callback(e.payload))
  }
}

// 云端实现（HTTP Client）
class CloudAPI implements UnifiedAPI {
  async sendMessage(input: SendMessageInput): Promise<void> {
    await fetch(`${API_BASE}/api/v1/tasks`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
  }
  async onStreamEvent(callback: (event: StreamEvent) => void): Unsubscribe {
    const es = new EventSource(`${API_BASE}/api/v1/stream/sse?session_id=${sessionId}`)
    es.onmessage = (e) => callback(JSON.parse(e.data))
    return () => es.close()
  }
}
```

### 14.6 数据模型融合

```typescript
interface UnifiedSession {
  id: string
  title: string
  status: 'idle' | 'running' | 'awaiting_approval' | 'completed' | 'error'
  executionLocation: 'local' | 'cloud' | 'hybrid'
  channelId?: string
  modelId?: string
  workspaceId?: string
  pinned: boolean
  archived: boolean
  createdAt: number
  updatedAt: number
  cloudWorkflowId?: string
  cloudSessionId?: string
  budgetUsed?: number
  budgetMax?: number
}

interface UnifiedMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  createdAt: number
  stepType?: 'explorer' | 'planner' | 'developer' | 'reviewer' | 'tester'
  model?: string
  usage?: { inputTokens: number; outputTokens: number; costUsd?: number }
  attachments?: FileAttachment[]
  toolActivities?: ToolActivity[]
}
```

### 14.7 本地-云端数据同步

```typescript
class DataSyncManager {
  async syncSessionToCloud(sessionId: string): Promise<void> {
    const session = await localStore.getSession(sessionId)
    const messages = await localStore.getMessages(sessionId)
    const cloudSession = await cloudAPI.createSession({
      title: session.title,
      channelId: session.channelId,
      modelId: session.modelId,
    })
    await cloudAPI.importMessages(cloudSession.id, messages)
    await localStore.updateSession(sessionId, {
      cloudSessionId: cloudSession.id,
      executionLocation: 'hybrid',
    })
  }
}
```

---

## 十五、融合实施路线图

### Phase 1：前端现代化（Week 1-4）

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 1.1 初始化 Next.js + Tauri 项目 | 3d | 新建项目骨架，配置开发环境 |
| 1.2 迁移基础组件 | 5d | 按钮、输入框、对话框等原子组件 |
| 1.3 迁移布局组件 | 5d | AppShell、Sidebar、Tab 系统 |
| 1.4 迁移状态管理 | 5d | Jotai → Zustand + Jotai 混合 |
| 1.5 迁移 IPC 层 | 5d | Electron IPC → Tauri Command + Event |
| 1.6 迁移 Chat/Agent 视图 | 10d | 核心业务组件迁移 |

### Phase 2：本地服务层重构（Week 5-8）

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 2.1 设计本地服务架构 | 3d | 确定 Bun 侧car + Rust 主进程协作模式 |
| 2.2 迁移文件系统服务 | 5d | 附件、工作区、文件监听 |
| 2.3 迁移 IM Bridge | 5d | 飞书/钉钉/微信 Bridge |
| 2.4 引入轻量编排器 | 10d | LangGraph 或自研状态机 |
| 2.5 引入 Token 预算 | 5d | per-task 预算 + 模型降级 |

### Phase 3：云端集成（Week 9-12）

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 3.1 云端服务部署 | 5d | Docker Compose 部署 Shannon 核心服务 |
| 3.2 本地-云端通信 | 5d | HTTP/gRPC 客户端，认证连接 |
| 3.3 编排路由逻辑 | 5d | 本地/云端编排器选择逻辑 |
| 3.4 数据同步 | 5d | 本地会话同步到云端 |
| 3.5 沙箱集成 | 5d | Docker 内运行 Rust Agent Core |

### Phase 4：可观测性与安全（Week 13-14）

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 4.1 结构化日志 | 3d | JSON 日志格式，日志轮转 |
| 4.2 本地指标 | 3d | Prometheus 客户端，基础指标 |
| 4.3 OPA 策略引擎 | 5d | WASM 版本 OPA，自定义规则 |

### Phase 5：测试与优化（Week 15-16）

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 5.1 E2E 测试 | 5d | 完整用户流程测试 |
| 5.2 性能优化 | 5d | 启动时间、内存占用、渲染性能 |
| 5.3 打包测试 | 3d | 跨平台打包，安装测试 |

**总计预估**：16 周（4 个月），5-6 名工程师

### 里程碑与检查点

| 里程碑 | 时间 | 交付物 | 验收标准 |
|--------|------|--------|----------|
| **M1：前端骨架** | Week 2 | Next.js + Tauri 项目可运行 | `npm run tauri:dev` 成功启动 |
| **M2：核心组件迁移** | Week 4 | Chat/Agent 视图可用 | 能创建会话、发送消息、接收流式响应 |
| **M3：本地服务稳定** | Week 6 | 文件系统 + IM Bridge 正常 | 飞书消息能触发本地 Agent |
| **M4：编排层融合** | Week 8 | 本地/云端编排切换可用 | 简单任务本地执行，复杂任务可选云端 |
| **M5：云端集成** | Week 10 | Shannon 后端可连接 | Docker Compose 部署成功 |
| **M6：安全与观测** | Week 12 | OPA + 指标可用 | 策略检查通过，Prometheus 可查询 |
| **M7：测试覆盖** | Week 14 | 核心流程有测试 | 单元测试覆盖率 > 30%，E2E 通过 |
| **M8：发布候选** | Week 16 | RC 版本 | 跨平台打包成功，无 blocker Bug |

### 团队分工建议

| 角色 | 人数 | 职责 | 技能要求 |
|------|------|------|----------|
| **前端工程师** | 2 | Next.js 迁移、组件开发、状态管理 | React, TypeScript, Tailwind |
| **Tauri/Rust 工程师** | 1 | Tauri 后端、IPC 桥接、系统集成 | Rust, Tauri, 桌面开发 |
| **后端工程师** | 1 | 本地服务重构、云端集成 | Bun/Node.js, gRPC, Docker |
| **DevOps/测试** | 1 | CI/CD、测试、打包、部署 | GitHub Actions, Docker |
| **产品经理/设计师** | 1 | 需求确认、UI 设计、验收 | 产品设计, Figma |

---

## 十六、迁移复杂度矩阵

| 组件/模块 | 迁移难度 | 工作量 | 风险 | 策略 |
|-----------|---------|--------|------|------|
| **基础 UI 组件** | 低 | 1 周 | 低 | 直接替换为 shadcn/ui |
| **布局组件（AppShell）** | 中 | 2 周 | 低 | 逐层迁移，保持布局结构 |
| **Chat 视图** | 中 | 2 周 | 中 | 保留业务逻辑，替换渲染层 |
| **Agent 视图** | 高 | 3 周 | 高 | 核心功能，需完整回归测试 |
| **状态管理（Jotai）** | 中 | 1 周 | 中 | 逐步替换，保留原子概念 |
| **IPC 通信层** | 高 | 2 周 | 高 | Electron IPC → Tauri Command |
| **文件系统服务** | 中 | 1 周 | 中 | Node.js fs → Rust fs（Tauri） |
| **IM Bridge（飞书）** | 高 | 2 周 | 高 | 需验证消息格式兼容性 |
| **Agent Orchestrator** | 低 | 1 周 | 低 | 保留 Bun 侧car，逻辑不变 |
| **Provider 适配器** | 低 | 3 天 | 低 | 直接复用，无需修改 |
| **存储层（JSONL）** | 低 | 3 天 | 低 | 路径变更，格式不变 |
| **配置管理** | 中 | 3 天 | 低 | Electron API → Tauri API |
| **自动更新** | 中 | 3 天 | 中 | Electron Updater → Tauri Updater |
| **主题系统** | 低 | 2 天 | 低 | Tailwind 3 → Tailwind 4 语法调整 |
| **Markdown 渲染** | 低 | 2 天 | 低 | 复用现有插件链 |

**迁移优先级建议**：
- **第一批（低风险快赢）**：基础组件、Provider 适配器、存储层、主题系统
- **第二批（核心业务）**：Chat 视图、Agent 视图、状态管理、IPC 通信
- **第三批（集成验证）**：IM Bridge、文件系统服务、自动更新、端到端测试

---

## 十七、风险分析

| 风险 | 影响 | 概率 | 应对策略 | 详细缓解措施 |
|------|------|------|----------|-------------|
| **Electron → Tauri 迁移工作量超预期** | 高 | 中 | 分阶段迁移，保留 Electron 版本作为 fallback | 1. 先新建 Tauri 项目，不删除 Electron<br>2. 使用 Feature Flag 控制切换<br>3. 每个 Sprint 保留 Electron 回归测试<br>4. Tauri 完全稳定后再废弃 Electron |
| **Shannon 后端与 CodeInsights 前端耦合困难** | 高 | 中 | 定义清晰的 API 契约，使用 OpenAPI 规范 | 1. 先定义 `UnifiedAPI` TypeScript 接口<br>2. 编写 OpenAPI 3.0 规范<br>3. 使用 `openapi-generator` 生成客户端<br>4. 本地实现和云端实现都遵循同一接口 |
| **Rust 学习曲线** | 中 | 高 | 团队培训，从简单组件开始 | 1. Tauri 后端初期保持极简（参考 Shannon Desktop 仅 17 行 Rust）<br>2. 复杂逻辑保留在 Bun 侧car<br>3. 安排 1 周 Rust 培训（Rust Book + Tauri 文档）<br>4. 从简单 Tauri Command 开始实践 |
| **Temporal 引入运维复杂度** | 中 | 中 | 云端 Temporal 托管服务（Temporal Cloud） | 1. 开发阶段使用 Docker Compose 本地 Temporal<br>2. 生产环境使用 Temporal Cloud（$200/月起）<br>3. 本地模式完全不依赖 Temporal<br>4. 提供一键云端部署脚本 |
| **本地优先 vs 云原生冲突** | 中 | 高 | 明确分层：本地默认，云端可选 | 1. 所有功能默认本地可用<br>2. 云端功能明确标记为"增强"<br>3. 离线时自动禁用云端功能<br>4. 用户数据默认本地存储，云端仅同步 |
| **Bun 与某些 Node.js 库兼容性问题** | 中 | 低 | 持续测试，必要时回退到 Node.js | 1. 建立 Bun 兼容性测试矩阵<br>2. 关键依赖（如 LangGraph）先行验证<br>3. 保留 `package.json` 的 `engines` 字段兼容 Node.js<br>4. CI 中同时测试 Bun 和 Node.js |
| **Shannon 代码许可兼容性** | 低 | 低 | 两者均为 MIT，兼容 | 1. 确认 Shannon 所有子包的 LICENSE<br>2. 合并时保留原始版权声明<br>3. 在 `NOTICE` 文件中列出所有依赖的许可证 |

**风险监控机制**：

```typescript
interface SprintRiskReview {
  sprint: number
  identifiedRisks: Risk[]
  mitigatedRisks: Risk[]
  newRisks: Risk[]
  goNoGoDecision: 'proceed' | 'pause' | 'pivot'
}

const DECISION_GATES = {
  GATE_1: { sprint: 2, criteria: 'Tauri 骨架可运行，无阻塞技术问题' },
  GATE_2: { sprint: 4, criteria: '核心组件迁移完成，功能对等 Electron 版本' },
  GATE_3: { sprint: 8, criteria: '本地/云端编排切换可用，性能达标' },
  GATE_4: { sprint: 12, criteria: '安全沙箱和可观测性集成完成' },
  GATE_5: { sprint: 16, criteria: 'RC 版本通过所有测试，准备发布' },
}
```

---

## 十八、经验教训与最佳实践

### 18.1 CodeInsights 做得好的地方

1. **本地优先设计**：JSON + JSONL 存储方案简单有效，数据完全属于用户
2. **四层同步 IPC**：类型安全的 IPC 架构值得所有 Electron 项目参考
3. **Provider 适配器模式**：3 个适配器覆盖 12 个供应商，复用率极高
4. **Jotai Map 隔离**：`Map<sessionId, State>` 实现多会话并行，设计优雅
5. **全局不可销毁监听器**：解决页面切换时流式输出丢失的经典问题
6. **IM 集成深度**：飞书/钉钉/微信 Bridge 设计可作为 IM 集成参考实现

### 18.2 Shannon 做得好的地方

1. **多语言分层**：Go（编排）+ Rust（执行）+ Python（AI），各取所长
2. **Temporal 工作流**：生产级可靠性保证，time-travel debugging 独特价值
3. **成本优化体系**：Token 预算 + 模型分层 + Research 策略，可量化降本
4. **可观测性完整**：Prometheus + OpenTelemetry + 结构化日志，运维友好
5. **测试矩阵完整**：跨语言单元测试 + E2E + 工作流回放，质量保障
6. **认知模式抽象**：5 种认知架构 + 8 种执行策略，任务路由智能化

### 18.3 双方需要改进的地方

**CodeInsights**：
- 测试覆盖率接近于零，生产级项目必须补齐
- 缺乏成本控制能力，用户可能产生意外高额账单
- 无沙箱隔离，Agent 直接运行在用户环境中存在安全风险
- CI/CD 缺失，发布流程完全手动

**Shannon**：
- Desktop 端过于依赖服务端，离线完全不可用
- 缺乏文档解析能力（PDF/Office），限制应用场景
- 无 IM 集成，无法通过聊天工具远程操控
- UI 丰富度不足（无 Mermaid、KaTeX、Shiki）

### 18.4 融合后的最佳实践建议

1. **测试先行**：融合项目必须建立完整的测试矩阵（单元 + 集成 + E2E），覆盖率门槛 > 50%
2. **API 契约优先**：本地和云端实现必须先定义统一的 TypeScript 接口，再分别实现
3. **渐进式迁移**：保留旧版本作为 fallback，Feature Flag 控制切换
4. **离线优先**：所有功能默认本地可用，云端仅作为增强选项
5. **成本透明**：实时显示 Token 用量和预估费用，超预算前主动告警
6. **安全分层**：本地使用基础权限模式，云端启用 WASI 沙箱 + OPA 策略

---

## 十九、总结

### 19.1 核心差异总结

| 维度 | CodeInsights | Shannon | 融合建议 |
|------|-------------|---------|----------|
| **架构哲学** | 本地优先、单体、轻量 | 云原生、微服务、生产级 | 本地默认 + 云端可选 |
| **桌面框架** | Electron（成熟但重） | Tauri（轻量但新） | 迁移到 Tauri |
| **前端框架** | React + Vite | Next.js + App Router | 迁移到 Next.js |
| **Agent 编排** | SDK 原生、简单直接 | 多层编排、认知模式 | 本地简单 + 云端复杂 |
| **安全** | 基础（权限模式） | 企业级（WASI + OPA） | 引入可选沙箱 |
| **成本** | 无控制 | 预算 + 降级 | 引入预算管理 |
| **可观测性** | 无 | 完整（Prometheus + OTel） | 引入结构化日志和指标 |
| **IM 集成** | 深度集成（飞书等） | 无 | 保留并增强 |
| **文档解析** | 内置（PDF/Office） | 无 | 保留 |

### 19.2 融合价值

**对 CodeInsights 用户的价值**：
1. 更轻量的桌面应用（Tauri 替代 Electron，包体积 -95%）
2. 更强的任务处理能力（云端编排器支持复杂工作流）
3. 更安全的代码执行（WASI 沙箱隔离）
4. 更可控的成本（Token 预算 + 模型降级，预估节省 50-70%）
5. 更好的可观测性（日志和指标，便于问题排查）

**对 Shannon 用户的价值**：
1. 本地优先选项（无需部署云端服务，秒级启动）
2. 更丰富的 UI（Mermaid 图表、KaTeX 数学公式、Shiki 代码高亮）
3. IM 远程操控（飞书/钉钉/微信机器人集成）
4. 文档解析能力（PDF/Office 文件直接对话）
5. 离线可用（本地模式不依赖网络）

### 19.3 关键决策点

1. **是否必须迁移到 Tauri？**
   - 建议：是的。Tauri 的包体积和性能优势明显，且 Shannon Desktop 已验证可行性。
   - 替代方案：保留 Electron，仅引入 Shannon 后端服务（风险低但收益减半）。

2. **是否必须引入 Temporal？**
   - 建议：云端模式必须，本地模式可选。本地可用轻量状态机（LangGraph）替代。

3. **是否保留 Bun？**
   - 建议：保留。Bun 的开发体验和性能优秀，与 Tauri 侧car 配合良好。

4. **融合的优先级？**
   - P0：前端现代化（Next.js + Tauri）
   - P1：编排层增强（本地 LangGraph + 云端 Shannon）
   - P2：安全沙箱和可观测性
   - P3：成本优化

### 19.4 架构演进路线图

```
Phase 1: 当前状态（CodeInsights v0.9.x）
├─ Electron 39 + React 18 + Vite
├─ Jotai 状态管理
├─ Claude Agent SDK 原生调用
└─ 本地 JSON/JSONL 存储

Phase 2: 前端现代化（3 个月）
├─ Tauri v2 + Next.js 16
├─ Zustand + Jotai 混合状态
├─ shadcn/ui + Tailwind v4
└─ 功能对等现有版本

Phase 3: 编排增强（2 个月）
├─ 本地轻量 LangGraph 编排
├─ 可选 Shannon 云端编排
├─ Token 预算 + 模型降级
└─ 本地/云端自动路由

Phase 4: 企业级能力（2 个月）
├─ WASI 沙箱（Docker 内）
├─ OPA 策略引擎
├─ Prometheus + OpenTelemetry
└─ 多租户支持（云端）

Phase 5: 生态扩展（持续）
├─ 插件系统
├─ 第三方 Skills 市场
├─ 移动端 App（Tauri iOS/Android）
└─ 团队协作工作区
```

---

## 附录A：核心文件速查表

### CodeInsights 核心文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `apps/electron/src/main/lib/agent-orchestrator.ts` | ~2169 | Agent 核心编排层 |
| `apps/electron/src/main/lib/feishu-bridge.ts` | ~1952 | 飞书集成 |
| `apps/electron/src/main/ipc.ts` | ~2558 | IPC 处理器注册中心 |
| `apps/electron/src/preload/index.ts` | ~1724 | Preload 桥接层 |
| `apps/electron/src/renderer/main.tsx` | ~711 | 渲染进程入口 + 初始化器 |
| `apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts` | ~810 | 全局 Agent 监听 |
| `apps/electron/src/renderer/atoms/agent-atoms.ts` | ~962 | Agent 状态管理 |
| `packages/core/src/providers/index.ts` | ~54 | Provider 注册表 |
| `packages/core/src/providers/types.ts` | ~276 | Provider 适配器接口 |

### Shannon 核心文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `go/orchestrator/internal/` | 38 个包 | Go 编排器内部实现 |
| `rust/agent-core/src/` | 21 个文件 | Rust Agent 核心 |
| `python/llm-service/llm_provider/` | 9 个适配器 | Python Provider 适配 |
| `desktop/lib/shannon/api.ts` | ~1012 | Desktop REST API 客户端 |
| `desktop/lib/shannon/types.ts` | ~453 | Desktop 事件类型定义 |
| `desktop/lib/features/runSlice.ts` | ~1502 | Desktop Redux 状态机 |
| `protos/agent/agent.proto` | ~157 | gRPC Agent 服务定义 |
| `config/shannon.yaml` | ~374 | 主系统配置 |
| `config/models.yaml` | ~984 | 模型分层配置 |

---

## 附录B：依赖版本对比清单

### 前端核心依赖

| 依赖 | CodeInsights | Shannon Desktop | 融合建议 |
|------|-------------|-----------------|----------|
| React | 18.3.1 | 19.2.0 | 19.2.0 |
| Next.js | - | 16.0.3 | 16.0.3 |
| Vite | 6.0.3 | - | - |
| TypeScript | 5.0.0+ | 5.9.3 | 5.9.3 |
| Tailwind CSS | 3.4.17 | v4 | v4 |
| Radix UI | 最新 | 最新 | 最新 |
| shadcn/ui | - | 最新 | 最新 |
| Lucide React | 0.460.0 | 0.553.0 | 最新 |

### 状态管理

| 依赖 | CodeInsights | Shannon Desktop | 融合建议 |
|------|-------------|-----------------|----------|
| Jotai | 2.17.1 | - | 保留 |
| Zustand | - | 5.0.9 | 引入 |
| Redux Toolkit | - | 2.10.1 | 可选 |

### 桌面框架

| 依赖 | CodeInsights | Shannon Desktop | 融合建议 |
|------|-------------|-----------------|----------|
| Electron | 39.5.1 | - | 废弃 |
| Tauri | - | 2.9.2 | 采用 |

### AI/LLM

| 依赖 | CodeInsights | Shannon | 融合建议 |
|------|-------------|---------|----------|
| Claude Agent SDK | 0.2.123 | - | 保留（本地） |
| LangChain/LangGraph | - | - | 引入（本地编排） |
| OpenAI SDK | 1.108.0 | 1.108.0 | 保留 |
| Anthropic SDK | 0.70.0+ | 0.64.0 | 保留 |

---

## 附录C：术语表

| 术语 | 解释 |
|------|------|
| **Agent** | 能够自主执行任务的 AI 系统，通常包含感知、推理、行动能力 |
| **MCP** | Model Context Protocol，模型上下文协议，用于连接外部数据源和工具 |
| **WASI** | WebAssembly System Interface，WebAssembly 系统接口，提供沙箱化执行环境 |
| **OPA** | Open Policy Agent，开放策略代理，基于 Rego 语言的策略引擎 |
| **Temporal** | 分布式工作流引擎，保证工作流执行的可靠性和可恢复性 |
| **SSE** | Server-Sent Events，服务器推送事件，用于单向实时流 |
| **gRPC** | Google 开发的高性能 RPC 框架，基于 Protocol Buffers |
| **Protobuf** | Protocol Buffers，Google 的数据序列化格式，用于定义服务接口 |
| **JSONL** | JSON Lines，每行一个 JSON 对象的文本格式，适合追加写入 |
| **Jotai** | 原子化状态管理库，基于 React 的细粒度订阅 |
| **Zustand** | 轻量级状态管理库，API 简洁，无需 Provider |
| **Tauri** | 使用 Web 技术构建桌面应用的框架，Rust 后端，轻量安全 |
| **Electron** | 使用 Chromium + Node.js 构建桌面应用的框架，功能丰富但体积大 |
| **TipTap** | 基于 ProseMirror 的无头富文本编辑器 |
| **Shiki** | 基于 TextMate 语法的高性能代码高亮器 |

---

*本文档基于 CodeInsights（截至 v0.9.11）和 Shannon（截至 v0.3.1）的公开代码和文档分析生成。*
*文档版本: v2.0 | 生成日期: 2026-05-04 | 总字数: 约 12,000 字*
