import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { WebSocket } from 'undici'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = __dirname
const FRAMES_DIR = join(OUT_DIR, 'feature-frames')
const PORT = Number(process.env.CDP_PORT ?? '9334')
const TARGET_URL = process.env.CDP_TARGET_URL ?? 'http://localhost:5173/'

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.nextId = 1
    this.pending = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket 连接超时')), 10000)
      this.ws.addEventListener('open', () => {
        clearTimeout(timer)
        resolve()
      }, { once: true })
      this.ws.addEventListener('error', (event) => {
        clearTimeout(timer)
        reject(event.error ?? new Error('CDP WebSocket 连接失败'))
      }, { once: true })
    })
    this.ws.addEventListener('message', (event) => this.handleMessage(String(event.data)))
  }

  handleMessage(raw) {
    const message = JSON.parse(raw)
    if (!message.id || !this.pending.has(message.id)) return
    const { resolve, reject } = this.pending.get(message.id)
    this.pending.delete(message.id)
    if (message.error) {
      reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ''}`))
    } else {
      resolve(message.result ?? {})
    }
  }

  send(method, params = {}) {
    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`${method} 超时`))
        }
      }, 30000)
    })
  }

  async eval(expression, awaitPromise = true) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? 'Runtime.evaluate 失败')
    }
    return result.result?.value
  }

  close() {
    this.ws?.close()
  }
}

async function findTarget() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
  if (!response.ok) throw new Error(`无法读取 CDP target: ${response.status}`)
  const targets = await response.json()
  const target = targets.find((item) => item.type === 'page' && item.url === TARGET_URL)
    ?? targets.find((item) => item.type === 'page' && item.url.startsWith('http://localhost:5173/') && !item.url.includes('window=quick-task') && !item.url.startsWith('devtools:'))
  if (!target) {
    throw new Error(`未找到主窗口 target。当前 target: ${targets.map((item) => item.url).join(', ')}`)
  }
  return target
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `ffmpeg 退出码 ${code}`))
    })
  })
}

async function clickText(client, selector, text, exact = false) {
  return client.eval(`(() => {
    const expected = ${JSON.stringify(text)}
    const exact = ${JSON.stringify(exact)}
    const elements = [...document.querySelectorAll(${JSON.stringify(selector)})]
    const target = elements.find((el) => {
      const label = (el.textContent ?? el.getAttribute('aria-label') ?? '').trim()
      return exact ? label === expected : label.includes(expected)
    })
    target?.scrollIntoView({ block: 'center', inline: 'center' })
    target?.click()
    return target ? (target.textContent ?? target.getAttribute('aria-label') ?? '').trim() : null
  })()`)
}

async function clickAria(client, aria) {
  return client.eval(`(() => {
    const target = [...document.querySelectorAll('button,[role="button"],a')]
      .find((el) => el.getAttribute('aria-label') === ${JSON.stringify(aria)})
    target?.scrollIntoView({ block: 'center', inline: 'center' })
    target?.click()
    return target ? (target.textContent ?? target.getAttribute('aria-label') ?? '').trim() : null
  })()`)
}

async function dismissPanels(client) {
  await client.eval(`(() => {
    const closeSettings = [...document.querySelectorAll('button')].find((el) => el.getAttribute('aria-label') === '关闭设置')
    closeSettings?.click()
    const tutorialLater = [...document.querySelectorAll('button')].find((el) => (el.textContent ?? '').includes('稍后再学'))
    tutorialLater?.click()
    return true
  })()`)
  await wait(500)
}

async function openMode(client, label) {
  await dismissPanels(client)
  await clickText(client, 'button', label, true)
  await wait(1200)
}

async function openSettings(client, tabLabel) {
  await dismissPanels(client)
  await clickText(client, 'button,[role="button"],a', '用户设置')
  await wait(900)
  await clickText(client, 'nav[aria-label="设置分类"] button', tabLabel)
  await wait(900)
}

async function prepareApp(client) {
  await mkdir(OUT_DIR, { recursive: true })
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await client.send('Page.bringToFront')
  try {
    const { windowId } = await client.send('Browser.getWindowForTarget')
    await client.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'normal', width: 1600, height: 1000, left: 80, top: 40 },
    })
  } catch {
    // Electron 的页面 target 可能不暴露 Browser window domain；保持当前窗口尺寸即可。
  }

  await client.eval(`(async () => {
    localStorage.setItem('codeinsights-theme-mode', 'dark')
    localStorage.setItem('codeinsights-theme-style', 'agent')
    localStorage.setItem('codeinsights-app-mode', 'pipeline')
    await window.electronAPI?.updateSettings?.({
      onboardingCompleted: true,
      tutorialBannerDismissed: true,
    })
    return true
  })()`)
  await client.send('Page.reload')
  await wait(3500)
  await dismissPanels(client)
}

async function captureScreencast(client, outputName, action) {
  await rm(FRAMES_DIR, { recursive: true, force: true })
  await mkdir(FRAMES_DIR, { recursive: true })
  let frameIndex = 0
  let recording = true

  const recorder = (async () => {
    while (recording) {
      const result = await client.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 90,
        fromSurface: true,
        captureBeyondViewport: false,
      })
      const framePath = join(FRAMES_DIR, `${String(frameIndex).padStart(5, '0')}.jpg`)
      frameIndex += 1
      await writeFile(framePath, Buffer.from(result.data, 'base64'))
      await wait(160)
    }
  })()

  await wait(350)
  await action()
  await wait(450)
  recording = false
  await recorder

  await runFfmpeg([
    '-y',
    '-framerate', '6',
    '-i', join(FRAMES_DIR, '%05d.jpg'),
    '-vf', 'scale=1600:-2,fps=30',
    '-c:v', 'libx264',
    '-crf', '24',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    join(OUT_DIR, outputName),
  ])
}

async function createPoster(videoName, posterName) {
  await runFfmpeg([
    '-y',
    '-ss', '00:00:01',
    '-i', join(OUT_DIR, videoName),
    '-frames:v', '1',
    '-vf', 'scale=1200:-2',
    '-q:v', '4',
    join(OUT_DIR, posterName),
  ])
}

async function main() {
  const target = await findTarget()
  const client = new CdpClient(target.webSocketDebuggerUrl)
  await client.connect()

  const demos = [
    {
      title: 'Pipeline 工作流',
      video: 'feature-01-pipeline-workflow.mp4',
      poster: 'feature-01-pipeline-workflow-poster.jpg',
      description: 'Pipeline 工作台、六阶段 Mission Route、记录过滤与阶段产物/运行日志切换。',
      run: async () => {
        await openMode(client, 'Pipeline')
        await wait(700)
        await clickAria(client, '定位计划节点：待处理记录')
        await wait(800)
        await clickAria(client, '定位审查节点：待处理记录')
        await wait(800)
        await clickText(client, 'button,[role="tab"]', '运行日志')
        await wait(800)
        await clickText(client, 'button,[role="tab"]', '阶段产物')
        await wait(800)
        await clickText(client, 'button', '06测试')
        await wait(800)
        await clickText(client, 'button', '00全部')
      },
    },
    {
      title: 'Agent 工作区',
      video: 'feature-02-agent-workspace.mp4',
      poster: 'feature-02-agent-workspace-poster.jpg',
      description: 'Agent 模式、工作区矩阵、新会话入口、右侧资源和能力入口。',
      run: async () => {
        await openMode(client, 'Agent')
        await wait(700)
        await clickAria(client, '新建 Agent 会话')
        await wait(1400)
        await clickAria(client, '配置 MCP 与 Skills')
        await wait(1100)
        await dismissPanels(client)
        await wait(700)
        await openMode(client, 'Agent')
      },
    },
    {
      title: '模型与 Provider 配置',
      video: 'feature-03-provider-settings.mp4',
      poster: 'feature-03-provider-settings-poster.jpg',
      description: '模型配置页、DeepSeek 预设、Pipeline Codex 认证来源和 Agent 供应商区域。',
      run: async () => {
        await openSettings(client, '模型配置')
        await wait(900)
        await clickText(client, 'button', '添加配置')
        await wait(1300)
        await clickText(client, 'button', '取消')
        await wait(700)
      },
    },
    {
      title: 'Agent MCP / Skills 配置',
      video: 'feature-04-agent-mcp-skills.mp4',
      poster: 'feature-04-agent-mcp-skills-poster.jpg',
      description: 'Agent 高级设置、内置工具、MCP Server、Skills 列表和工作区隔离能力。',
      run: async () => {
        await openSettings(client, 'Agent 配置')
        await wait(900)
        await clickText(client, 'button', 'Agent 高级设置')
        await wait(700)
        await clickText(client, 'button', '添加服务器')
        await wait(1100)
        await clickText(client, 'button', '取消')
        await wait(700)
        await clickText(client, 'button', '从其他工作区导入')
        await wait(1200)
        await clickText(client, 'button', '取消')
        await wait(700)
      },
    },
  ]

  try {
    await prepareApp(client)
    for (const demo of demos) {
      console.log(`开始录制: ${demo.title}`)
      await captureScreencast(client, demo.video, demo.run)
      await createPoster(demo.video, demo.poster)
      console.log(`完成录制: ${demo.video}`)
    }

    await writeFile(join(OUT_DIR, 'feature-videos-manifest.json'), JSON.stringify({
      capturedAt: new Date().toISOString(),
      cdpPort: PORT,
      targetUrl: TARGET_URL,
      configDir: process.env.CODEINSIGHTS_CONFIG_DIR ?? null,
      files: demos.flatMap((demo) => [demo.video, demo.poster]),
      demos: demos.map(({ title, video, poster, description }) => ({ title, video, poster, description })),
      notes: [
        '视频来自真实 Electron dev 主窗口，通过 CDP 捕捉业务窗口帧。',
        '采集建议使用隔离 CODEINSIGHTS_CONFIG_DIR，避免读取本机真实渠道密钥、历史会话和 IM 凭证。',
        '本轮演示不调用真实模型、不连接外部 IM Bridge；Provider、MCP、Skills 只展示本地可验证配置界面。',
      ],
    }, null, 2))
  } finally {
    await rm(FRAMES_DIR, { recursive: true, force: true })
    client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
