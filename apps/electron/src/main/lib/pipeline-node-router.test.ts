import { describe, expect, mock, test } from 'bun:test'
import type { PipelineNodeKind } from '@codeinsights/shared'

mock.module('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
  app: {
    isPackaged: false,
    getPath: () => '',
  },
}))

const {
  getPipelineNodeRuntimeStrategy,
  RoutedPipelineNodeRunner,
} = await import('./pipeline-node-router')

import type {
  PipelineNodeExecutionContext,
  PipelineNodeExecutionResult,
  PipelineNodeRunner,
} from './pipeline-node-runner'

function context(node: PipelineNodeKind): PipelineNodeExecutionContext {
  return {
    sessionId: 'session-router',
    userInput: '执行 v2 Pipeline',
    currentNode: node,
    reviewIteration: 0,
  }
}

class FakePipelineRunner implements PipelineNodeRunner {
  readonly nodes: PipelineNodeKind[] = []

  constructor(private readonly summary: string) {}

  async runNode(
    node: PipelineNodeKind,
    _context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    this.nodes.push(node)
    return {
      output: this.summary,
      summary: this.summary,
      approved: true,
    }
  }
}

describe('pipeline-node-router', () => {
  test('v1 strategy 保持 tester 使用 Claude，保护旧 Pipeline 行为', () => {
    expect([
      'explorer',
      'planner',
      'developer',
      'reviewer',
      'tester',
    ].map((node) => [node, getPipelineNodeRuntimeStrategy(node as PipelineNodeKind, 1)])).toEqual([
      ['explorer', 'claude'],
      ['planner', 'claude'],
      ['developer', 'codex'],
      ['reviewer', 'codex'],
      ['tester', 'claude'],
    ])
  })

  test('v2 strategy 表驱动映射六节点 runtime', () => {
    expect([
      'explorer',
      'planner',
      'developer',
      'reviewer',
      'tester',
      'committer',
    ].map((node) => [node, getPipelineNodeRuntimeStrategy(node as PipelineNodeKind, 2)])).toEqual([
      ['explorer', 'claude'],
      ['planner', 'claude'],
      ['developer', 'codex'],
      ['reviewer', 'codex'],
      ['tester', 'codex'],
      ['committer', 'codex'],
    ])
  })

  test('v2 RoutedPipelineNodeRunner 将后四节点路由到 Codex runner', async () => {
    const claudeRunner = new FakePipelineRunner('claude')
    const codexRunner = new FakePipelineRunner('codex')
    const runner = new RoutedPipelineNodeRunner({
      version: 2,
      claudeRunner,
      codexRunner,
    })

    await runner.runNode('explorer', context('explorer'))
    await runner.runNode('planner', context('planner'))
    await runner.runNode('developer', context('developer'))
    await runner.runNode('reviewer', context('reviewer'))
    await runner.runNode('tester', context('tester'))
    await runner.runNode('committer', context('committer'))

    expect(claudeRunner.nodes).toEqual(['explorer', 'planner'])
    expect(codexRunner.nodes).toEqual(['developer', 'reviewer', 'tester', 'committer'])
  })
})
