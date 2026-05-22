import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  acceptPatchWorkDocuments,
  assertPatchWorkDocumentsAcceptable,
  initializePatchWork,
  listPatchWorkExplorerReports,
  readPatchWorkFile,
  readPatchWorkManifestFile,
  readPatchWorkManifest,
  selectPatchWorkTask,
  writePatchWorkFile,
} from './pipeline-patch-work-service'

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

describe('pipeline-patch-work-service', () => {
  let repoRoot = ''
  let extraDirs: string[] = []

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-patch-work-repo-'))
    extraDirs = []
  })

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true })
    for (const dir of extraDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('初始化 patch-work 并创建 manifest', () => {
    const manifest = initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })

    expect(manifest).toMatchObject({
      version: 1,
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      files: [],
    })
    expect(existsSync(join(repoRoot, 'patch-work', 'manifest.json'))).toBe(true)
  })

  test('固定文件写入会更新 checksum、revision 和修订归档', () => {
    const first = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n\n第一版\n',
    })
    const second = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n\n第二版\n',
    })

    const manifest = readPatchWorkManifest(repoRoot)

    expect(first).toMatchObject({
      relativePath: 'plan.md',
      revision: 1,
    })
    expect(second).toMatchObject({
      relativePath: 'plan.md',
      revision: 2,
    })
    expect(second.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.files).toHaveLength(1)
    expect(manifest.files[0]).toMatchObject({
      kind: 'implementation_plan',
      relativePath: 'plan.md',
      revision: 2,
      checksum: second.checksum,
    })
    expect(manifest.checksums['plan.md']).toBe(second.checksum)
    expect(readPatchWorkFile({
      repositoryRoot: repoRoot,
      relativePath: 'plan.md',
    })).toContain('第二版')
    expect(readFileSync(join(repoRoot, 'patch-work', 'revisions', 'planner', '001-plan.md'), 'utf-8')).toContain('第一版')
    expect(readFileSync(join(repoRoot, 'patch-work', 'revisions', 'planner', '002-plan.md'), 'utf-8')).toContain('第二版')
  })

  test('支持所有 Phase 1 固定 Markdown 文件', () => {
    const fixedKinds = [
      ['selected_task', 'selected-task.md'],
      ['test_plan', 'test-plan.md'],
      ['dev_doc', 'dev.md'],
      ['review_doc', 'review.md'],
      ['test_result', 'result.md'],
      ['commit_doc', 'commit.md'],
      ['pr_doc', 'pr.md'],
    ] as const

    for (const [kind, relativePath] of fixedKinds) {
      const ref = writePatchWorkFile({
        contributionTaskId: 'task-1',
        pipelineSessionId: 'session-1',
        repositoryRoot: repoRoot,
        kind,
        createdByNode: kind === 'commit_doc' || kind === 'pr_doc' ? 'committer' : 'planner',
        content: `# ${kind}\n`,
      })

      expect(ref.relativePath).toBe(relativePath)
      expect(existsSync(join(repoRoot, 'patch-work', relativePath))).toBe(true)
    }
  })

  test('支持 Phase 5 patch-set 固定文件并登记 manifest checksum', () => {
    const fixedPatchSetKinds = [
      ['patch', 'patch-set/changes.patch', '代码补丁.patch'],
      ['changed_files', 'patch-set/changed-files.json', '变更文件.json'],
      ['diff_summary', 'patch-set/diff-summary.md', 'Diff 摘要.md'],
      ['test_evidence', 'patch-set/test-evidence.json', '测试证据.json'],
    ] as const

    for (const [kind, relativePath, displayName] of fixedPatchSetKinds) {
      const ref = writePatchWorkFile({
        contributionTaskId: 'task-1',
        pipelineSessionId: 'session-1',
        repositoryRoot: repoRoot,
        kind,
        createdByNode: 'tester',
        content: relativePath.endsWith('.json') ? '{"ok":true}\n' : `# ${kind}\n`,
      })

      expect(ref).toMatchObject({
        kind,
        displayName,
        relativePath,
        createdByNode: 'tester',
        revision: 1,
      })
      expect(existsSync(join(repoRoot, 'patch-work', relativePath))).toBe(true)
      expect(readPatchWorkManifest(repoRoot).checksums[relativePath]).toBe(ref.checksum)
    }
  })

  test('拒绝绝对路径、上级路径和读取软链越界文件', () => {
    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      relativePath: '../escape.md',
      createdByNode: 'planner',
      content: '越界',
    })).toThrow('patch-work 文件路径越界')

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      relativePath: join(repoRoot, 'outside.md'),
      createdByNode: 'planner',
      content: '越界',
    })).toThrow('patch-work 文件路径越界')

    const patchWorkDir = join(repoRoot, 'patch-work')
    initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })
    const outsidePath = join(repoRoot, 'outside.md')
    writeFileSync(outsidePath, '外部文件', 'utf-8')

    try {
      symlinkSync(outsidePath, join(patchWorkDir, 'linked.md'))
      expect(() => readPatchWorkFile({
        repositoryRoot: repoRoot,
        relativePath: 'linked.md',
      })).toThrow('patch-work 文件路径越界')
    } catch (error) {
      console.warn('[测试] 当前平台不支持创建 symlink，已跳过软链越界断言:', error)
    }
  })

  test('拒绝 patch-work 目录自身软链到仓库外', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'codeinsights-patch-work-outside-'))
    extraDirs.push(outsideDir)
    symlinkSync(outsideDir, join(repoRoot, 'patch-work'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 不应写入外部目录\n',
    })).toThrow('patch-work 目录越界')
    expect(existsSync(join(outsideDir, 'plan.md'))).toBe(false)
  })

  test('拒绝 patch-work 目录软链到仓库内部目录', () => {
    const srcDir = join(repoRoot, 'src')
    mkdirSync(srcDir, { recursive: true })
    symlinkSync(srcDir, join(repoRoot, 'patch-work'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 不应写入 src\n',
    })).toThrow('patch-work 目录越界')
    expect(existsSync(join(srcDir, 'plan.md'))).toBe(false)
  })

  test('拒绝 manifest 软链且不会把仓库外内容复制到 bak', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'codeinsights-patch-work-secret-'))
    extraDirs.push(outsideDir)
    const secretPath = join(outsideDir, 'secret.txt')
    writeFileSync(secretPath, 'SECRET-DATA', 'utf-8')
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    symlinkSync(secretPath, join(repoRoot, 'patch-work', 'manifest.json'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 不应触发 manifest backup\n',
    })).toThrow('patch-work manifest 不能是软链')
    expect(existsSync(join(repoRoot, 'patch-work', 'manifest.json.bak'))).toBe(false)
  })

  test('拒绝 manifest tmp / bak 软链，避免写入或备份仓库外文件', () => {
    initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })

    for (const companionName of ['manifest.json.tmp', 'manifest.json.bak']) {
      const outsideDir = mkdtempSync(join(tmpdir(), `codeinsights-patch-work-${companionName}-`))
      extraDirs.push(outsideDir)
      const outsidePath = join(outsideDir, 'outside.txt')
      writeFileSync(outsidePath, 'SECRET-DATA', 'utf-8')
      symlinkSync(outsidePath, join(repoRoot, 'patch-work', companionName))

      expect(() => writePatchWorkFile({
        contributionTaskId: 'task-1',
        pipelineSessionId: 'session-1',
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: `# 不应触发 ${companionName}\n`,
      })).toThrow('patch-work manifest 不能是软链')
      expect(readFileSync(outsidePath, 'utf-8')).toBe('SECRET-DATA')

      rmSync(join(repoRoot, 'patch-work', companionName), { force: true })
    }
  })

  test('拒绝 dangling manifest 软链', () => {
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    symlinkSync(join(repoRoot, 'missing-manifest-target.json'), join(repoRoot, 'patch-work', 'manifest.json'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 不应替换 dangling symlink\n',
    })).toThrow('patch-work manifest 不能是软链')
  })

  test('拒绝父目录中的软链，且不会先在仓库外创建目录', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'codeinsights-patch-work-linked-parent-'))
    extraDirs.push(outsideDir)
    initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })
    symlinkSync(outsideDir, join(repoRoot, 'patch-work', 'linked'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'explorer_report',
      relativePath: 'linked/nested/report.md',
      createdByNode: 'explorer',
      content: '# 不应越界创建目录\n',
    })).toThrow('patch-work 文件路径越界')
    expect(existsSync(join(outsideDir, 'nested'))).toBe(false)
  })

  test('拒绝覆盖 manifest、revisions 和临时文件等保留路径', () => {
    const reservedPaths = [
      'manifest.json',
      'manifest.json/evil.md',
      'manifest.json.tmp',
      'manifest.json.bak',
      'revisions/planner/001-plan.md',
      '.tmp-evil',
      '.tmp/evil.md',
    ]

    for (const relativePath of reservedPaths) {
      expect(() => writePatchWorkFile({
        contributionTaskId: 'task-1',
        pipelineSessionId: 'session-1',
        repositoryRoot: repoRoot,
        kind: 'explorer_report',
        relativePath,
        createdByNode: 'explorer',
        content: '保留路径',
      })).toThrow('patch-work 文件路径保留')
    }
  })

  test('运行时拒绝非法文件类型和节点类型', () => {
    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'bad_kind' as never,
      createdByNode: 'planner',
      content: '非法类型',
    })).toThrow('无效 patch-work 文件类型')

    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'bad_node' as never,
      content: '非法节点',
    })).toThrow('无效 patch-work 节点类型')
  })

  test('列出 explorer Markdown 报告并从报告内容提取标题和摘要', () => {
    writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'explorer_report',
      relativePath: 'explorer/report-001.md',
      displayName: '候选一.md',
      createdByNode: 'explorer',
      content: [
        '# 探索报告：修复 Pipeline task selection',
        '',
        '## 贡献点概述',
        '让用户选择报告后再进入 planner。',
      ].join('\n'),
    })
    writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'explorer_report',
      relativePath: 'explorer/report-002.md',
      displayName: '候选二.md',
      createdByNode: 'explorer',
      content: [
        '# 探索报告：完善文档审核',
        '',
        '## 贡献点概述',
        '展示 plan.md 和 test-plan.md 的校验信息。',
      ].join('\n'),
    })

    const reports = listPatchWorkExplorerReports({ repositoryRoot: repoRoot })

    expect(reports.map((report) => report.reportId)).toEqual([
      'report-001',
      'report-002',
    ])
    expect(reports[0]).toMatchObject({
      title: '修复 Pipeline task selection',
      summary: '让用户选择报告后再进入 planner。',
      relativePath: 'explorer/report-001.md',
      revision: 1,
    })
    expect(reports[0]?.checksum).toMatch(/^[a-f0-9]{64}$/)
  })

  test('选择 explorer report 会更新 manifest 并生成 selected-task.md', () => {
    const report = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'explorer_report',
      relativePath: 'explorer/report-001.md',
      displayName: '候选一.md',
      createdByNode: 'explorer',
      content: [
        '# 探索报告：修复 Pipeline task selection',
        '',
        '## 贡献点概述',
        '让用户选择报告后再进入 planner。',
      ].join('\n'),
    })

    const result = selectPatchWorkTask({
      repositoryRoot: repoRoot,
      selectedReportId: 'report-001',
      gateId: 'gate-task',
    })
    const manifest = readPatchWorkManifest(repoRoot)
    const selectedTask = readPatchWorkFile({
      repositoryRoot: repoRoot,
      relativePath: 'selected-task.md',
    })

    expect(result.selectedReport.reportId).toBe('report-001')
    expect(result.selectedTaskRef).toMatchObject({
      kind: 'selected_task',
      relativePath: 'selected-task.md',
      revision: 1,
    })
    expect(manifest.selectedReportId).toBe('report-001')
    expect(manifest.files.find((file) => file.relativePath === report.relativePath)).toMatchObject({
      acceptedRevision: 1,
      acceptedByGateId: 'gate-task',
    })
    expect(selectedTask).toContain('来源报告：`explorer/report-001.md`')
    expect(selectedTask).toContain('修复 Pipeline task selection')
  })

  test('选择 explorer report 前会校验磁盘内容 checksum，拒绝篡改后的报告', () => {
    writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'explorer_report',
      relativePath: 'explorer/report-001.md',
      displayName: '候选一.md',
      createdByNode: 'explorer',
      content: '# 探索报告：原始任务\n\n## 贡献点概述\n原始内容。\n',
    })
    writeFileSync(
      join(repoRoot, 'patch-work', 'explorer', 'report-001.md'),
      '# 探索报告：被篡改任务\n\n## 贡献点概述\n篡改内容。\n',
      'utf-8',
    )

    expect(() => selectPatchWorkTask({
      repositoryRoot: repoRoot,
      selectedReportId: 'report-001',
      gateId: 'gate-task',
    })).toThrow('checksum 已变化')
  })

  test('选择不存在的 explorer report 会被拒绝', () => {
    initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })

    expect(() => selectPatchWorkTask({
      repositoryRoot: repoRoot,
      selectedReportId: 'missing-report',
      gateId: 'gate-task',
    })).toThrow('未找到 explorer report')
  })

  test('接受 planner 文档会记录当前 revision 和 gate checksum', () => {
    const planRef = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n\n第一版\n',
    })
    const testPlanRef = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'test_plan',
      createdByNode: 'planner',
      content: '# 测试方案\n\n第一版\n',
    })

    const accepted = acceptPatchWorkDocuments({
      repositoryRoot: repoRoot,
      gateId: 'gate-plan',
      kinds: ['implementation_plan', 'test_plan'],
    })
    const manifest = readPatchWorkManifest(repoRoot)

    expect(accepted.map((file) => file.relativePath)).toEqual(['plan.md', 'test-plan.md'])
    expect(manifest.files.find((file) => file.relativePath === 'plan.md')).toMatchObject({
      acceptedRevision: planRef.revision,
      acceptedByGateId: 'gate-plan',
      checksum: planRef.checksum,
    })
    expect(manifest.files.find((file) => file.relativePath === 'test-plan.md')).toMatchObject({
      acceptedRevision: testPlanRef.revision,
      acceptedByGateId: 'gate-plan',
      checksum: testPlanRef.checksum,
    })
  })

  test('只读校验 patch-work 文档不会写入 accepted 状态', () => {
    const commitRef = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'commit_doc',
      createdByNode: 'committer',
      content: '# Commit 准备\n',
    })
    const prRef = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'pr_doc',
      createdByNode: 'committer',
      content: '# PR 草稿\n',
    })

    const acceptable = assertPatchWorkDocumentsAcceptable({
      repositoryRoot: repoRoot,
      kinds: ['commit_doc', 'pr_doc'],
    })
    const manifest = readPatchWorkManifest(repoRoot)

    expect(acceptable.map((file) => file.relativePath)).toEqual(['commit.md', 'pr.md'])
    expect(manifest.files.find((file) => file.relativePath === 'commit.md')).toMatchObject({
      revision: commitRef.revision,
      checksum: commitRef.checksum,
      acceptedRevision: undefined,
    })
    expect(manifest.files.find((file) => file.relativePath === 'pr.md')).toMatchObject({
      revision: prRef.revision,
      checksum: prRef.checksum,
      acceptedRevision: undefined,
    })
  })

  test('接受 planner 文档前会校验磁盘内容 checksum，拒绝篡改后的文档', () => {
    writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n\n第一版\n',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'test_plan',
      createdByNode: 'planner',
      content: '# 测试方案\n\n第一版\n',
    })
    writeFileSync(join(repoRoot, 'patch-work', 'plan.md'), '# 开发方案\n\n被外部修改\n', 'utf-8')

    expect(() => acceptPatchWorkDocuments({
      repositoryRoot: repoRoot,
      gateId: 'gate-plan',
      kinds: ['implementation_plan', 'test_plan'],
    })).toThrow('checksum 已变化')
  })

  test('结构化读取只允许 manifest 登记且 checksum 未变化的文件', () => {
    writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n',
    })
    writeFileSync(join(repoRoot, 'patch-work', 'untracked.md'), '# 未登记文件\n', 'utf-8')

    expect(readPatchWorkManifestFile({
      repositoryRoot: repoRoot,
      relativePath: 'plan.md',
    })).toContain('开发方案')
    expect(() => readPatchWorkManifestFile({
      repositoryRoot: repoRoot,
      relativePath: 'untracked.md',
    })).toThrow('未登记')
    expect(() => readPatchWorkManifestFile({
      repositoryRoot: repoRoot,
      relativePath: 'manifest.json',
    })).toThrow('未登记')
  })

  test('结构化读取会忽略被篡改 manifest 中登记的保留路径', () => {
    initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })
    const revisionContent = '# 保留修订\n'
    mkdirSync(join(repoRoot, 'patch-work', 'revisions', 'planner'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'patch-work', 'revisions', 'planner', '001-plan.md'),
      revisionContent,
      'utf-8',
    )
    writeFileSync(
      join(repoRoot, 'patch-work', 'manifest.json'),
      JSON.stringify({
        version: 1,
        contributionTaskId: 'task-1',
        pipelineSessionId: 'session-1',
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        files: [
          {
            kind: 'implementation_plan',
            displayName: '保留修订.md',
            relativePath: 'revisions/planner/001-plan.md',
            createdByNode: 'planner',
            revision: 1,
            checksum: sha256(revisionContent),
            updatedAt: Date.now(),
          },
        ],
        checksums: {
          'revisions/planner/001-plan.md': sha256(revisionContent),
        },
        updatedAt: Date.now(),
      }, null, 2),
      'utf-8',
    )

    expect(() => readPatchWorkManifestFile({
      repositoryRoot: repoRoot,
      relativePath: 'revisions/planner/001-plan.md',
    })).toThrow('未登记')
  })
})
