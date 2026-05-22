import { randomUUID } from 'node:crypto'
import {
  Annotation,
  Command,
  END,
  INTERRUPT,
  interrupt,
  isInterrupted,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph'
import type {
  BaseCheckpointSaver,
} from '@langchain/langgraph'
import type {
  PipelineGateRequest,
  PipelineGateKind,
  PipelineGateResponse,
  PipelineNodeKind,
  PipelineSessionStatus,
  PipelineStageOutputMap,
  PipelineStateSnapshot,
  PipelineVersion,
} from '@codeinsights/shared'
import type {
  PipelineNodeExecutionContext,
  PipelineNodeExecutionResult,
} from './pipeline-node-runner'

type PipelineGraphState = PipelineStateSnapshot & {
  userInput: string
  latestOutput?: string
  latestSummary?: string
  latestIssues?: string[]
  stageOutputs?: PipelineStageOutputMap
  feedback?: string
}

const MAX_REVIEW_ITERATIONS = 3

const PipelineGraphAnnotation = Annotation.Root({
  sessionId: Annotation<string>,
  userInput: Annotation<string>,
  version: Annotation<PipelineVersion | undefined>,
  currentNode: Annotation<PipelineNodeKind>,
  status: Annotation<PipelineSessionStatus>,
  reviewIteration: Annotation<number>,
  lastApprovedNode: Annotation<PipelineNodeKind | undefined>,
  pendingGate: Annotation<PipelineGateRequest | null>,
  updatedAt: Annotation<number>,
  latestOutput: Annotation<string | undefined>,
  latestSummary: Annotation<string | undefined>,
  latestIssues: Annotation<string[] | undefined>,
  stageOutputs: Annotation<PipelineStageOutputMap | undefined>,
  feedback: Annotation<string | undefined>,
})

export interface CreatePipelineGraphOptions {
  runNode: (
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ) => Promise<PipelineNodeExecutionResult>
  checkpointer?: BaseCheckpointSaver
  getSignal?: (sessionId: string) => AbortSignal | undefined
}

interface CreatePipelineGraphInternalOptions extends CreatePipelineGraphOptions {
  version: PipelineVersion
}

export interface PipelineGraphInvokeInput {
  sessionId: string
  userInput: string
}

export interface PipelineGraphResumeInput {
  sessionId: string
  response: PipelineGateResponse
}

export interface PipelineGraphRunResult {
  state: PipelineStateSnapshot
  interrupted?: PipelineGateRequest
}

function now(): number {
  return Date.now()
}

function buildContext(state: PipelineGraphState): PipelineNodeExecutionContext {
  return {
    sessionId: state.sessionId,
    userInput: state.userInput,
    currentNode: state.currentNode,
    version: state.version,
    reviewIteration: state.reviewIteration,
    lastApprovedNode: state.lastApprovedNode,
    feedback: state.feedback,
    stageOutputs: state.stageOutputs,
  }
}

function buildStateSnapshot(state: PipelineGraphState): PipelineStateSnapshot {
  return {
    sessionId: state.sessionId,
    ...(state.version ? { version: state.version } : {}),
    currentNode: state.currentNode,
    status: state.status,
    reviewIteration: state.reviewIteration,
    lastApprovedNode: state.lastApprovedNode,
    pendingGate: state.pendingGate,
    stageOutputs: state.stageOutputs ?? {},
    updatedAt: state.updatedAt,
  }
}

interface PipelineGraphCheckpointSnapshot {
  tasks: Array<{ interrupts: Array<{ value?: unknown }> }>
}

function extractPendingGateFromSnapshot(snapshot: PipelineGraphCheckpointSnapshot): PipelineGateRequest | undefined {
  return snapshot.tasks
    .flatMap((task) => task.interrupts)
    .map((interrupt) => interrupt.value)
    .find((value): value is PipelineGateRequest => value != null)
}

function createGateRequest(
  state: PipelineGraphState,
  node: PipelineNodeKind,
): PipelineGateRequest {
  const kind: PipelineGateKind | undefined = state.version === 2
    ? gateKindForV2Node(node, state)
    : undefined

  return {
    gateId: randomUUID(),
    sessionId: state.sessionId,
    node,
    ...(kind ? { kind } : {}),
    title: kind === 'review_iteration_limit'
      ? 'Reviewer 多轮未通过，等待人工接管'
      : `${node} 节点待审核`,
    summary: state.latestSummary,
    feedbackHint: kind === 'review_iteration_limit'
      ? '接受风险会进入 tester；填写反馈会回到 developer；也可重跑 reviewer。'
      : node === 'reviewer'
        ? '可填写 reviewer 反馈后回到 developer'
        : '可填写反馈后重跑当前节点',
    iteration: state.reviewIteration,
    createdAt: now(),
  }
}

function gateKindForV2Node(node: PipelineNodeKind, state: PipelineGraphState): PipelineGateKind {
  if (
    node === 'reviewer'
    && state.stageOutputs?.reviewer?.node === 'reviewer'
    && state.stageOutputs.reviewer.approved === false
    && state.reviewIteration >= MAX_REVIEW_ITERATIONS
  ) {
    return 'review_iteration_limit'
  }

  if (node === 'tester' && state.stageOutputs?.tester?.node === 'tester') {
    const testerOutput = state.stageOutputs.tester
    const evidence = testerOutput.patchSet?.testEvidence ?? testerOutput.testEvidence ?? []
    const hasNonPassingEvidence = evidence.some((item) => item.status !== 'passed')
    const patchSetUnsafe = testerOutput.patchSet ? !testerOutput.patchSet.excludesPatchWork : false
    const testDidNotPass = testerOutput.passed !== true || hasNonPassingEvidence || patchSetUnsafe
    const testWasBlocked = testerOutput.blockers.length > 0 || testerOutput.commands.length === 0
    if (testDidNotPass || testWasBlocked) {
      return 'test_blocked'
    }
  }

  switch (node) {
    case 'explorer':
      return 'task_selection'
    case 'committer':
      return 'submission_review'
    case 'planner':
    case 'developer':
    case 'reviewer':
    case 'tester':
    default:
      return 'document_review'
  }
}

function createWorkerNode(
  node: PipelineNodeKind,
  runNode: CreatePipelineGraphOptions['runNode'],
  getSignal: CreatePipelineGraphOptions['getSignal'],
): (state: PipelineGraphState) => Promise<Record<string, unknown> | Command> {
  return async (state) => {
    const result = await runNode(node, {
      ...buildContext(state),
      signal: getSignal?.(state.sessionId),
    })
    const timestamp = now()
    const stageOutputs = result.stageOutput
      ? {
          ...(state.stageOutputs ?? {}),
          [node]: result.stageOutput,
        }
      : state.stageOutputs

    if (node === 'reviewer') {
      if (state.version === 2) {
        if (result.approved === false) {
          const nextIteration = state.reviewIteration + 1
          if (nextIteration >= MAX_REVIEW_ITERATIONS) {
            return new Command({
              goto: 'gate_reviewer',
              update: {
                currentNode: 'reviewer',
                latestOutput: result.output,
                latestSummary: result.summary,
                latestIssues: result.issues,
                reviewIteration: nextIteration,
                stageOutputs,
                status: 'waiting_human',
                updatedAt: timestamp,
              },
            })
          }

          return new Command({
            goto: 'developer',
            update: {
              currentNode: 'developer',
              latestOutput: result.output,
              latestSummary: result.summary,
              latestIssues: result.issues,
              feedback: result.issues?.join('\n') || result.summary,
              reviewIteration: nextIteration,
              stageOutputs,
              status: 'running',
              updatedAt: timestamp,
            },
          })
        }

        return new Command({
          goto: 'tester',
          update: {
            currentNode: 'tester',
            latestOutput: result.output,
            latestSummary: result.summary,
            latestIssues: result.issues,
            lastApprovedNode: 'reviewer',
            stageOutputs,
            status: 'running',
            updatedAt: timestamp,
          },
        })
      }

      if (result.approved === false) {
        return new Command({
          goto: 'gate_reviewer',
          update: {
            currentNode: 'reviewer',
            latestOutput: result.output,
            latestSummary: result.summary,
            latestIssues: result.issues,
            stageOutputs,
            status: 'waiting_human',
            updatedAt: timestamp,
          },
        })
      }

      return new Command({
        goto: 'gate_reviewer',
        update: {
          currentNode: 'reviewer',
          latestOutput: result.output,
          latestSummary: result.summary,
          latestIssues: result.issues,
          stageOutputs,
          status: 'waiting_human',
          updatedAt: timestamp,
        },
      })
    }

    return {
      currentNode: node,
      latestOutput: result.output,
      latestSummary: result.summary,
      latestIssues: result.issues,
      stageOutputs,
      status: 'running',
      updatedAt: timestamp,
    }
  }
}

function createGateNode(
  node: PipelineNodeKind,
  nextNode: PipelineNodeKind | typeof END,
): (state: PipelineGraphState) => Command {
  return (state) => {
    const request = createGateRequest(state, node)
    const response = interrupt<PipelineGateRequest, PipelineGateResponse>(request)
    const timestamp = now()

    if (response.action === 'approve') {
      const nextStageOutputs = request.kind === 'test_blocked' && node === 'tester'
        ? {
            ...(state.stageOutputs ?? {}),
            tester: state.stageOutputs?.tester?.node === 'tester'
              ? {
                  ...state.stageOutputs.tester,
                  riskAccepted: true,
                }
              : state.stageOutputs?.tester,
          }
        : state.stageOutputs

      if (nextNode === END) {
        return new Command({
          goto: END,
          update: {
            currentNode: node,
            lastApprovedNode: node,
            stageOutputs: nextStageOutputs,
            status: 'completed',
            updatedAt: timestamp,
          },
        })
      }

      return new Command({
        goto: nextNode,
        update: {
          currentNode: nextNode,
          lastApprovedNode: node,
          feedback: undefined,
          stageOutputs: nextStageOutputs,
          status: 'running',
          updatedAt: timestamp,
        },
      })
    }

    if (node === 'reviewer' && response.action === 'reject_with_feedback') {
      return new Command({
        goto: 'developer',
        update: {
          currentNode: 'developer',
          feedback: response.feedback,
          reviewIteration: state.reviewIteration + 1,
          status: 'running',
          updatedAt: timestamp,
        },
      })
    }

    if (state.version === 2 && node === 'tester' && response.action === 'reject_with_feedback') {
      return new Command({
        goto: 'developer',
        update: {
          currentNode: 'developer',
          feedback: response.feedback,
          status: 'running',
          updatedAt: timestamp,
        },
      })
    }

    return new Command({
      goto: node,
      update: {
        currentNode: node,
        feedback: response.feedback,
        status: 'running',
        updatedAt: timestamp,
      },
    })
  }
}

function graphConfig(sessionId: string) {
  return {
    configurable: {
      thread_id: sessionId,
    },
    recursionLimit: 25,
  }
}

function createPipelineGraphForVersion(options: CreatePipelineGraphInternalOptions) {
  const testerNextNode = options.version === 2 ? 'committer' : END
  const builder = new StateGraph(PipelineGraphAnnotation)
    .addNode('explorer', createWorkerNode('explorer', options.runNode, options.getSignal))
    .addNode('gate_explorer', createGateNode('explorer', 'planner'), {
      ends: ['explorer', 'planner'],
    })
    .addNode('planner', createWorkerNode('planner', options.runNode, options.getSignal))
    .addNode('gate_planner', createGateNode('planner', 'developer'), {
      ends: ['planner', 'developer'],
    })
    .addNode('developer', createWorkerNode('developer', options.runNode, options.getSignal))
    .addNode('reviewer', createWorkerNode('reviewer', options.runNode, options.getSignal), {
      ends: ['developer', 'gate_reviewer', 'tester'],
    })
    .addNode('gate_reviewer', createGateNode('reviewer', 'tester'), {
      ends: ['developer', 'reviewer', 'tester'],
    })
    .addNode('tester', createWorkerNode('tester', options.runNode, options.getSignal))
    .addNode('gate_tester', createGateNode('tester', testerNextNode), {
      ends: options.version === 2 ? ['tester', 'developer', 'committer'] : ['tester', END],
    })
    .addEdge(START, 'explorer')
    .addEdge('explorer', 'gate_explorer')
    .addEdge('planner', 'gate_planner')
    .addEdge('tester', 'gate_tester')
    .addEdge('gate_explorer', 'planner')
    .addEdge('gate_planner', 'developer')

  if (options.version === 2) {
    builder
      .addNode('gate_developer', createGateNode('developer', 'reviewer'), {
        ends: ['developer', 'reviewer'],
      })
      .addEdge('developer', 'gate_developer')
      .addNode('committer', createWorkerNode('committer', options.runNode, options.getSignal))
      .addNode('gate_committer', createGateNode('committer', END), {
        ends: ['committer', END],
      })
      .addEdge('committer', 'gate_committer')
  } else {
    builder.addEdge('developer', 'reviewer')
  }

  const graph = builder.compile({
    checkpointer: options.checkpointer ?? new MemorySaver(),
  })

  async function getSnapshot(sessionId: string): Promise<PipelineStateSnapshot> {
    const snapshot = await graph.getState(graphConfig(sessionId))
    const values = snapshot.values as PipelineGraphState
    if (!values || typeof values.sessionId !== 'string') {
      throw new Error(`未找到 Pipeline checkpoint state: ${sessionId}`)
    }

    const state = buildStateSnapshot(values)
    const pendingGate = extractPendingGateFromSnapshot(snapshot)
    if (!pendingGate) {
      return state
    }

    return {
      ...state,
      currentNode: pendingGate.node,
      status: 'waiting_human',
      reviewIteration: pendingGate.iteration,
      pendingGate,
      updatedAt: Math.max(state.updatedAt, pendingGate.createdAt),
    }
  }

  async function extractResult(
    sessionId: string,
    raw: unknown,
  ): Promise<PipelineGraphRunResult> {
    const state = await getSnapshot(sessionId)
    const interrupted = isInterrupted<PipelineGateRequest>(raw)
      ? raw[INTERRUPT]?.[0]?.value
      : undefined

    if (interrupted) {
      return { state, interrupted }
    }

    const snapshot = await graph.getState(graphConfig(sessionId))
    const gate = extractPendingGateFromSnapshot(snapshot)
    return {
      state,
      interrupted: gate,
    }
  }

  return {
    async invoke(input: PipelineGraphInvokeInput): Promise<PipelineGraphRunResult> {
      const initialState: PipelineGraphState = {
        sessionId: input.sessionId,
        userInput: input.userInput,
        ...(options.version === 2 ? { version: 2 as const } : {}),
        currentNode: 'explorer',
        status: 'running',
        reviewIteration: 0,
        pendingGate: null,
        stageOutputs: {},
        updatedAt: now(),
      }

      const result = await graph.invoke(initialState, graphConfig(input.sessionId))
      return extractResult(input.sessionId, result)
    },

    async resume(input: PipelineGraphResumeInput): Promise<PipelineGraphRunResult> {
      const result = await graph.invoke(
        new Command({ resume: input.response }),
        graphConfig(input.sessionId),
      )
      return extractResult(input.sessionId, result)
    },

    getState(sessionId: string): Promise<PipelineStateSnapshot> {
      return getSnapshot(sessionId)
    },
  }
}

export function createPipelineGraph(options: CreatePipelineGraphOptions) {
  return createPipelineGraphForVersion({ ...options, version: 1 })
}

export function createPipelineGraphV2(options: CreatePipelineGraphOptions) {
  return createPipelineGraphForVersion({ ...options, version: 2 })
}
