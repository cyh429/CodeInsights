import { describe, expect, test } from 'bun:test'
import { buildPipelineComposerViewModel } from './PipelineComposer'

describe('PipelineComposer', () => {
  test('停止请求处理中要给出立即可见反馈', () => {
    const viewModel = buildPipelineComposerViewModel({
      disabled: true,
      currentTask: '探索 linux riscv 内存相关的潜在贡献点',
      stopping: true,
      status: 'running',
    })

    expect(viewModel.currentTaskLabel).toBe('探索 linux riscv 内存相关的潜在贡献点')
    expect(viewModel.stopButtonLabel).toBe('正在停止...')
    expect(viewModel.stopButtonDisabled).toBe(true)
    expect(viewModel.notice).toEqual({
      tone: 'neutral',
      message: '正在停止当前 Pipeline...',
    })
  })

  test('停止完成后在输入区保留已停止提示', () => {
    const viewModel = buildPipelineComposerViewModel({
      disabled: false,
      currentTask: '探索 linux riscv 内存相关的潜在贡献点',
      stopping: false,
      status: 'terminated',
    })

    expect(viewModel.stopButtonLabel).toBe('停止运行')
    expect(viewModel.stopButtonDisabled).toBe(false)
    expect(viewModel.notice).toEqual({
      tone: 'neutral',
      message: 'Pipeline 已停止运行，可以调整任务后重新启动。',
    })
  })
})
