import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { WebSocket } from 'undici'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = __dirname
const FRAMES_DIR = join(OUT_DIR, 'frames')
const PORT = Number(process.env.CDP_PORT ?? '9334')
const TARGET_URL = process.env.CDP_TARGET_URL ?? 'http://localhost:5173/'

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.nextId = 1
    this.pending = new Map()
    this.events = new Map()
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
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) {
        reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ''}`))
      } else {
        resolve(message.result ?? {})
      }
      return
    }
    if (message.method) {
      const handlers = this.events.get(message.method)
      if (handlers) {
        for (const handler of handlers) handler(message.params ?? {})
      }
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

  on(method, handler) {
    const handlers = this.events.get(method) ?? []
    handlers.push(handler)
    this.events.set(method, handlers)
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

  async screenshot(fileName) {
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    const path = join(OUT_DIR, fileName)
    await writeFile(path, Buffer.from(result.data, 'base64'))
    return path
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
    ?? targets.find((item) => item.type === 'page' && item.url.startsWith('http://localhost:5173/') && !item.url.includes('window=quick-task'))
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

async function captureScreencast(client, action, outputName) {
  await rm(FRAMES_DIR, { recursive: true, force: true })
  await mkdir(FRAMES_DIR, { recursive: true })
  let frameIndex = 0
  let recording = true
  const recorder = (async () => {
    while (recording) {
      const result = await client.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 92,
        fromSurface: true,
        captureBeyondViewport: false,
      })
      const framePath = join(FRAMES_DIR, `${String(frameIndex).padStart(5, '0')}.jpg`)
      frameIndex += 1
      await writeFile(framePath, Buffer.from(result.data, 'base64'))
      await wait(125)
    }
  })()

  await action()
  recording = false
  await recorder

  await runFfmpeg([
    '-y',
    '-framerate', '3',
    '-i', join(FRAMES_DIR, '%05d.jpg'),
    '-vf', 'scale=1600:-2,fps=30',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    join(OUT_DIR, outputName),
  ])
}

async function main() {
  const target = await findTarget()
  const client = new CdpClient(target.webSocketDebuggerUrl)
  await client.connect()

  try {
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
      // Electron 39 的 CDP target 不一定暴露 Browser window domain；保持当前窗口尺寸即可。
    }
    await wait(1200)

    await client.eval(`(() => {
      localStorage.setItem('codeinsights-theme-mode', 'dark')
      localStorage.setItem('codeinsights-theme-style', 'agent')
      localStorage.setItem('codeinsights-app-mode', 'pipeline')
      return true
    })()`)
    await client.send('Page.reload')
    await wait(3500)

    await client.eval(`(async () => {
      if (!document.body.innerText.includes('欢迎使用 CodeInsights')) return 'skipped'
      const startButton = [...document.querySelectorAll('button')]
        .find((el) => (el.textContent ?? '').includes('开始使用'))
      startButton?.click()
      return startButton?.textContent ?? null
    })()`)
    await wait(3000)

    const metadata = await client.eval(`(() => ({
      title: document.title,
      url: location.href,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      text: document.body.innerText.slice(0, 3000)
    }))()`)
    await writeFile(join(OUT_DIR, 'capture-metadata.json'), JSON.stringify(metadata, null, 2))

    await client.eval(`(() => {
      const later = [...document.querySelectorAll('button')]
        .find((el) => (el.textContent ?? '').includes('稍后再学'))
      later?.click()
      return later?.textContent ?? null
    })()`)
    await wait(700)

    await client.screenshot('01-pipeline-dashboard.png')

    await client.eval(`(() => {
      const buttons = [...document.querySelectorAll('button, [role="button"], a')]
      const target = buttons.find((el) => (el.textContent ?? '').trim() === 'Agent')
      target?.click()
      return target?.textContent ?? null
    })()`)
    await wait(900)
    await client.eval(`(() => {
      if (document.body.innerText.includes('AGENT MISSION')) return 'existing-agent-session'
      const newSession = [...document.querySelectorAll('button')]
        .find((el) => el.getAttribute('aria-label') === '新建 Agent 会话' || (el.textContent ?? '').includes('新会话'))
      newSession?.click()
      return newSession?.textContent ?? null
    })()`)
    await wait(2200)
    await client.screenshot('02-agent-workbench.png')

    await client.eval(`(() => {
      const buttons = [...document.querySelectorAll('button, [role="button"], a')]
      const target = buttons.find((el) => /(设置|Settings)/i.test(el.textContent ?? '') || el.getAttribute('aria-label')?.match(/设置|Settings/i))
      target?.click()
      return target?.textContent ?? target?.getAttribute('aria-label') ?? null
    })()`)
    await wait(1800)
    await client.eval(`(() => {
      const navButtons = [...document.querySelectorAll('nav[aria-label="设置分类"] button')]
      const channels = navButtons.find((el) => (el.textContent ?? '').includes('模型配置')) ?? navButtons[1]
      channels?.click()
      return channels?.textContent ?? null
    })()`)
    await wait(700)
    await client.screenshot('03-settings-overview.png')

    await client.eval(`(() => {
      const navButtons = [...document.querySelectorAll('nav[aria-label="设置分类"] button')]
      const target = navButtons.find((el) => (el.textContent ?? '').includes('Agent 配置')) ?? navButtons[4]
      target?.click()
      return target?.textContent ?? null
    })()`)
    await wait(1400)
    await client.screenshot('04-channels-and-agent-settings.png')

    await client.eval(`(() => {
      const close = [...document.querySelectorAll('button')].find((el) => el.getAttribute('aria-label') === '关闭设置')
      close?.click()
      return close?.getAttribute('aria-label') ?? null
    })()`)
    await wait(700)
    await client.eval(`(() => {
      const buttons = [...document.querySelectorAll('button, [role="button"], a')]
      const pipeline = buttons.find((el) => (el.textContent ?? '').trim() === 'Pipeline')
      pipeline?.click()
      return pipeline?.textContent ?? null
    })()`)
    await wait(1200)

    await captureScreencast(client, async () => {
      await wait(800)
      await client.eval(`(() => {
        const buttons = [...document.querySelectorAll('button, [role="button"], a')]
        const agent = buttons.find((el) => (el.textContent ?? '').trim() === 'Agent')
        agent?.click()
        return true
      })()`)
      await wait(1600)
      await client.eval(`(() => {
        if (document.body.innerText.includes('AGENT MISSION')) return true
        const newSession = [...document.querySelectorAll('button')]
          .find((el) => el.getAttribute('aria-label') === '新建 Agent 会话' || (el.textContent ?? '').includes('新会话'))
        newSession?.click()
        return true
      })()`)
      await wait(1200)
      await client.eval(`(() => {
        const buttons = [...document.querySelectorAll('button, [role="button"], a')]
        const settings = buttons.find((el) => /(设置|Settings)/i.test(el.textContent ?? '') || el.getAttribute('aria-label')?.match(/设置|Settings/i))
        settings?.click()
        return true
      })()`)
      await wait(1600)
      await client.eval(`(() => {
        const close = [...document.querySelectorAll('button')].find((el) => el.getAttribute('aria-label') === '关闭设置')
        close?.click()
        return true
      })()`)
      await wait(700)
      await client.eval(`(() => {
        const buttons = [...document.querySelectorAll('button, [role="button"], a')]
        const pipeline = buttons.find((el) => (el.textContent ?? '').trim() === 'Pipeline')
        pipeline?.click()
        return true
      })()`)
      await wait(1500)
    }, 'codeinsights-real-run-overview.mp4')

    const fileList = [
      '01-pipeline-dashboard.png',
      '02-agent-workbench.png',
      '03-settings-overview.png',
      '04-channels-and-agent-settings.png',
      'codeinsights-real-run-overview.mp4',
      'capture-metadata.json',
    ]
    await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({
      capturedAt: new Date().toISOString(),
      cdpPort: PORT,
      targetUrl: TARGET_URL,
      files: fileList,
      notes: [
        '截图和录屏来自真实 Electron dev 主窗口。',
        '本轮使用隔离 CODEINSIGHTS_CONFIG_DIR=/tmp/codeinsights-readme-capture-config，避免读取本机渠道密钥和历史会话。',
        'dev 模式主进程会打开 DevTools，本轮采集时已关闭 DevTools target，仅采集业务主窗口 target。',
      ],
    }, null, 2))
  } finally {
    client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
