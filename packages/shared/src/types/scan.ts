/**
 * 扫描工作台相关类型定义
 *
 * 定义 CodeInsights 安全/漏洞扫描的会话元数据、发现项、报告和 IPC 通道常量。
 */

/** 扫描会话状态 */
export type ScanSessionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** 漏洞严重程度 */
export type ScanSeverity =
  | 'critical'    // 严重
  | 'high'        // 高危
  | 'medium'      // 中危
  | 'low'         // 低危
  | 'info'        // 信息

/** 漏洞状态 */
export type FindingStatus =
  | 'open'        // 待处理
  | 'triaged'     // 已分诊
  | 'confirmed'   // 已确认
  | 'fixed'       // 已修复
  | 'false_positive' // 误报
  | 'suppressed'  // 已忽略

/** 源码位置引用 */
export interface SourceLocation {
  filePath: string
  line: number
  column?: number
  endLine?: number
  endColumn?: number
  snippet?: string
}

/** 单个漏洞发现项 */
export interface ScanFinding {
  id: string
  scanId: string
  ruleId?: string
  title: string
  description: string
  severity: ScanSeverity
  status: FindingStatus
  category: string
  location: SourceLocation
  recommendation?: string
  references?: string[]
  cvssScore?: number
  cweId?: string
  createdAt: number
  updatedAt: number
  triagedAt?: number
  fixedAt?: number
  assignee?: string
  tags?: string[]
}

/** 扫描会话元数据 */
export interface ScanSessionMeta {
  id: string
  title: string
  description?: string
  target: string // 目标项目/软件名称
  targetPath?: string
  status: ScanSessionStatus
  scanner: string // 扫描器类型
  totalFindings: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  infoCount: number
  startedAt?: number
  completedAt?: number
  failedAt?: number
  errorMessage?: string
  pinned?: boolean
  archived?: boolean
  createdAt: number
  updatedAt: number
}

/** 扫描会话详情（含发现项列表） */
export interface ScanSessionDetail extends ScanSessionMeta {
  findings: ScanFinding[]
}

/** 扫描过滤器选项 */
export interface ScanFilterOptions {
  severities?: ScanSeverity[]
  statuses?: FindingStatus[]
  categories?: string[]
  searchQuery?: string
}

/** 扫描排序选项 */
export interface ScanSortOptions {
  field: 'severity' | 'createdAt' | 'updatedAt' | 'status' | 'filePath'
  direction: 'asc' | 'desc'
}

/** 创建扫描会话请求 */
export interface CreateScanRequest {
  title: string
  description?: string
  target: string
  targetPath?: string
  scanner: string
}

/** 更新扫描发现项状态请求 */
export interface UpdateFindingStatusRequest {
  scanId: string
  findingId: string
  status: FindingStatus
  comment?: string
}

/** 扫描统计摘要 */
export interface ScanStatistics {
  totalScans: number
  totalFindings: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  infoCount: number
  openCount: number
  fixedCount: number
}

// ===== IPC 通道常量 =====

export const SCAN_IPC_CHANNELS = {
  // 扫描会话 CRUD
  LIST_SCANS: 'scan:list',
  GET_SCAN: 'scan:get',
  CREATE_SCAN: 'scan:create',
  UPDATE_SCAN: 'scan:update',
  DELETE_SCAN: 'scan:delete',

  // 发现项操作
  LIST_FINDINGS: 'scan:findings:list',
  GET_FINDING: 'scan:findings:get',
  UPDATE_FINDING_STATUS: 'scan:findings:update-status',
  ADD_FINDING_COMMENT: 'scan:findings:add-comment',

  // 统计
  GET_STATISTICS: 'scan:statistics',

  // 导入/导出
  IMPORT_SCAN: 'scan:import',
  EXPORT_SCAN: 'scan:export',
} as const

export type ScanIpcChannel = typeof SCAN_IPC_CHANNELS[keyof typeof SCAN_IPC_CHANNELS]

/** 扫描发现项评论 */
export interface FindingComment {
  id: string
  findingId: string
  author: string
  content: string
  createdAt: number
}
