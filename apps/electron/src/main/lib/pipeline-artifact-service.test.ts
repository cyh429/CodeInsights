import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PipelineStageArtifactRecord } from '@codeinsights/shared'
import {
  persistPipelineStageArtifactRecord,
  readPipelineArtifactContent,
  readPipelineArtifactManifest,
  resolvePipelineSessionArtifactsDir,
} from './pipeline-artifact-service'

describe('pipeline-artifact-service', () => {
  const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  let tempConfigDir = ''

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-artifacts-'))
    process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
  })

  afterEach(() => {
    if (originalConfigDir == null) {
      delete process.env.CODEINSIGHTS_CONFIG_DIR
    } else {
      process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
    }

    rmSync(tempConfigDir, { recursive: true, force: true })
  })

  test('会把阶段产物写成 Markdown / JSON 文件，并在记录中返回文件引用', () => {
    const record: PipelineStageArtifactRecord = {
      id: 'session-1-planner-100-artifact',
      sessionId: 'session-1',
      type: 'stage_artifact',
      node: 'planner',
      artifact: {
        node: 'planner',
        summary: '按三步实现',
        steps: ['补测试', '改实现'],
        risks: ['状态回归'],
        verification: ['bun test'],
        content: '{"summary":"按三步实现"}',
      },
      createdAt: 100,
    }

    const persisted = persistPipelineStageArtifactRecord(record)

    expect(persisted.artifactFiles?.map((file) => ({
      kind: file.kind,
      displayName: file.displayName,
      relativePath: file.relativePath,
    }))).toEqual([
      {
        kind: 'markdown',
        displayName: '计划阶段产物.md',
        relativePath: 'planner-100.md',
      },
      {
        kind: 'json',
        displayName: '计划阶段产物.json',
        relativePath: 'planner-100.json',
      },
      {
        kind: 'content',
        displayName: '计划原始内容.txt',
        relativePath: 'planner-100.content.txt',
      },
    ])

    const artifactDir = join(tempConfigDir, 'pipeline-artifacts', 'session-1')
    const markdownPath = join(artifactDir, 'planner-100.md')
    const jsonPath = join(artifactDir, 'planner-100.json')

    expect(existsSync(markdownPath)).toBe(true)
    expect(existsSync(jsonPath)).toBe(true)
    expect(readFileSync(markdownPath, 'utf-8')).toContain('# 计划阶段产物')
    expect(readFileSync(markdownPath, 'utf-8')).toContain('- 补测试')
    expect(JSON.parse(readFileSync(jsonPath, 'utf-8'))).toMatchObject({
      node: 'planner',
      summary: '按三步实现',
    })
  })

  test('大阶段产物正文只写入 content 文件，record / JSON / Markdown 只保留预览和引用', () => {
    const uniqueTail = '只应存在于 content 文件的唯一尾部'
    const longContent = `${'很长的阶段正文'.repeat(1200)}${uniqueTail}`
    const record: PipelineStageArtifactRecord = {
      id: 'session-large-developer-300-artifact',
      sessionId: 'session-large',
      type: 'stage_artifact',
      node: 'developer',
      artifact: {
        node: 'developer',
        summary: '实现完成',
        changes: ['拆分正文'],
        tests: ['bun test'],
        risks: [],
        content: longContent,
      },
      createdAt: 300,
    }

    const persisted = persistPipelineStageArtifactRecord(record)
    const artifactDir = join(tempConfigDir, 'pipeline-artifacts', 'session-large')
    const jsonContent = readFileSync(join(artifactDir, 'developer-300.json'), 'utf-8')
    const markdownContent = readFileSync(join(artifactDir, 'developer-300.md'), 'utf-8')
    const rawContent = readFileSync(join(artifactDir, 'developer-300.content.txt'), 'utf-8')

    expect(persisted.artifact.content).not.toContain(uniqueTail)
    expect(persisted.artifactContentRef).toMatchObject({
      kind: 'content',
      relativePath: 'developer-300.content.txt',
    })
    expect(persisted.artifactFiles?.map((file) => file.kind)).toEqual(['markdown', 'json', 'content'])
    expect(jsonContent).not.toContain(uniqueTail)
    expect(markdownContent).not.toContain(uniqueTail)
    expect(rawContent).toBe(longContent)
  })

  test('readPipelineArtifactContent 会校验相对路径并读取 content 文件', () => {
    const record: PipelineStageArtifactRecord = {
      id: 'session-read-tester-400-artifact',
      sessionId: 'session-read',
      type: 'stage_artifact',
      node: 'tester',
      artifact: {
        node: 'tester',
        summary: '验证完成',
        commands: ['bun test'],
        results: ['通过'],
        blockers: [],
        content: '完整验证正文',
      },
      createdAt: 400,
    }

    const persisted = persistPipelineStageArtifactRecord(record)

    expect(readPipelineArtifactContent('session-read', persisted.artifactContentRef!)).toBe('完整验证正文')
    expect(() => readPipelineArtifactContent('session-read', {
      kind: 'content',
      displayName: '越界.txt',
      relativePath: '../escape.txt',
    })).toThrow('无效 Pipeline 产物文件引用')
  })

  test('重复持久化同一条阶段产物时 manifest 会按相对路径去重', () => {
    const record: PipelineStageArtifactRecord = {
      id: 'session-2-reviewer-200-artifact',
      sessionId: 'session-2',
      type: 'stage_artifact',
      node: 'reviewer',
      artifact: {
        node: 'reviewer',
        summary: '缺少验证',
        approved: false,
        issues: ['没有说明回归测试'],
        content: '{"approved":false}',
      },
      createdAt: 200,
    }

    persistPipelineStageArtifactRecord(record)
    persistPipelineStageArtifactRecord(record)

    const manifest = readPipelineArtifactManifest('session-2')

    expect(manifest.files.map((file) => file.relativePath)).toEqual([
      'reviewer-200.md',
      'reviewer-200.json',
      'reviewer-200.content.txt',
    ])
  })

  test('拒绝解析越界的 Pipeline 产物目录', () => {
    expect(() => resolvePipelineSessionArtifactsDir('../../Documents')).toThrow('无效 Pipeline 会话 ID')
    expect(existsSync(join(tempConfigDir, 'Documents'))).toBe(false)
  })

  test('读取 manifest 时会校验 schema 并覆盖文件内 sessionId', () => {
    const artifactDir = resolvePipelineSessionArtifactsDir('session-3')
    writeFileSync(
      join(artifactDir, 'manifest.json'),
      JSON.stringify({
        version: 1,
        sessionId: '../../evil',
        files: [
          {
            kind: 'markdown',
            displayName: '计划阶段产物.md',
            relativePath: 'planner-300.md',
          },
          {
            kind: 'markdown',
            displayName: '恶意文件.md',
            relativePath: '../escape.md',
          },
        ],
        updatedAt: 123,
      }),
      'utf-8',
    )

    const manifest = readPipelineArtifactManifest('session-3')

    expect(manifest.sessionId).toBe('session-3')
    expect(manifest.updatedAt).toBe(123)
    expect(manifest.files.map((file) => file.relativePath)).toEqual(['planner-300.md'])
  })
})
