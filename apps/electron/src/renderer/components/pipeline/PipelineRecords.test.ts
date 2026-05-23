import { describe, expect, test } from 'bun:test'
import { buildPipelineLiveOutputViewModel } from './PipelineRecords'

describe('PipelineRecords live output model', () => {
  test('节点已启动但暂未产生文本时展示明确的静默运行说明', () => {
    const viewModel = buildPipelineLiveOutputViewModel('explorer', '')

    expect(viewModel.title).toBe('探索节点正在运行')
    expect(viewModel.hasOutput).toBe(false)
    expect(viewModel.body).toContain('探索节点已启动')
    expect(viewModel.body).toContain('模型执行工具或等待首个响应时可能暂时没有文本输出')
  })

  test('节点已有文本输出时展示原始内容', () => {
    const viewModel = buildPipelineLiveOutputViewModel('planner', '正在生成 plan.md')

    expect(viewModel.title).toBe('计划节点正在输出')
    expect(viewModel.hasOutput).toBe(true)
    expect(viewModel.body).toBe('正在生成 plan.md')
  })

  test('节点只有启动进度时仍按运行态展示', () => {
    const viewModel = buildPipelineLiveOutputViewModel('explorer', [
      '进度：探索节点已启动，正在准备模型与工作区。',
      '进度：模型执行工具或等待首个响应时可能暂时没有文本输出。',
      '',
    ].join('\n'))

    expect(viewModel.title).toBe('探索节点正在运行')
    expect(viewModel.hasOutput).toBe(false)
    expect(viewModel.body).toContain('探索节点已启动')
  })
})
