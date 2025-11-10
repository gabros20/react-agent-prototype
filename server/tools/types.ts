import type { DrizzleDB } from '../db/client'
import type { VectorIndexService } from '../services/vector-index'

// Agent modes
export type AgentMode = 'architect' | 'cms-crud' | 'debug' | 'ask'

// Tool metadata
export interface ToolMetadata {
  id: string // "cms.createPage"
  category: 'cms' | 'memory' | 'http' | 'planning'
  riskLevel: 'safe' | 'moderate' | 'high'
  requiresApproval: boolean // HITL flag
  allowedModes: AgentMode[] // ['cms-crud', 'architect']
  tags: string[] // ['write', 'page', 'cms']
}

// Agent context passed to all tool executions
export interface AgentContext {
  // Database access
  db: DrizzleDB

  // Vector index
  vectorIndex: VectorIndexService

  // Logging
  logger: {
    info: (msg: string | object, meta?: any) => void
    warn: (msg: string | object, meta?: any) => void
    error: (msg: string | object, meta?: any) => void
  }

  // Streaming (for real-time updates)
  stream?: {
    write: (event: any) => void
  }

  // Tracing
  traceId: string
  sessionId: string

  // Current mode
  currentMode: AgentMode

  // Services
  services: any // ServiceContainer (avoid circular dependency)
}

// Log entry types
export interface LogEntry {
  id: string
  traceId: string
  stepId: string
  timestamp: Date
  level: 'info' | 'warn' | 'error'
  message: string
  metadata?: Record<string, any>
}

// Stream event types
export interface StepCompleteEvent {
  type: 'step-complete'
  traceId: string
  stepId: string
  stepNumber: number
  toolCalls?: Array<{
    toolName: string
    input: any
  }>
  toolResults?: Array<{
    success: boolean
    output: any
  }>
}

export interface ErrorEvent {
  type: 'error'
  traceId: string
  error: string
  details?: any
}

export interface LogEvent {
  type: 'log'
  traceId: string
  level: 'info' | 'warn' | 'error'
  message: string
  metadata?: Record<string, any>
}

export type StreamEvent = StepCompleteEvent | ErrorEvent | LogEvent
