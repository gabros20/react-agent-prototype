/**
 * Execution Types
 *
 * Types for the agent execution layer.
 * Moved from services/agent/types.ts and cleaned up.
 */

import type { ModelMessage } from 'ai';
import type { AgentLogger } from '../tools/types';
import type { DrizzleDB } from '../db/client';
import type { Services } from '../services/types';
import type { VectorIndexService } from '../services/vector-index';
import type { SessionService } from '../services/session-service';

// ============================================================================
// Execute Options
// ============================================================================

/**
 * Options for agent execution (from route handler)
 */
export interface ExecuteOptions {
  /** User's prompt/message */
  prompt: string;

  /** Session ID (creates new if not provided) */
  sessionId?: string;

  /** Model ID for dynamic model selection (e.g. "openai/gpt-4o") */
  modelId?: string;

  /** CMS target site/environment */
  cmsTarget?: {
    siteId?: string;
    environmentId?: string;
  };
}

/**
 * Internal options with all values resolved
 */
export interface ResolvedExecuteOptions {
  prompt: string;
  sessionId: string;
  traceId: string;
  modelId: string;
  cmsTarget: {
    siteId: string;
    environmentId: string;
  };
}

// ============================================================================
// Orchestrator Dependencies
// ============================================================================

/**
 * Dependencies required by the orchestrator
 */
export interface OrchestratorDependencies {
  db: DrizzleDB;
  services: Services;
  sessionService: SessionService;
  vectorIndex: VectorIndexService;
}

// ============================================================================
// Orchestrator Result
// ============================================================================

/**
 * Result from non-streaming execution
 */
export interface OrchestratorResult {
  traceId: string;
  sessionId: string;
  text: string;
  steps: unknown[];
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ============================================================================
// Stream Processing Types
// ============================================================================

/**
 * Accumulated data from stream processing
 */
export interface StreamProcessingResult {
  toolCalls: Array<{
    toolName: string;
    toolCallId: string;
    args: unknown;
  }>;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    result: unknown;
  }>;
  finalText: string;
  finishReason: string;
  usage: Record<string, unknown>;
  displayTexts: string[];
}

// ============================================================================
// Context Coordinator Types
// ============================================================================

/**
 * Result from context preparation
 */
export interface PreparedContext {
  /** Messages to send to the agent (trimmed) */
  messages: ModelMessage[];
  /** Working memory string for prompt injection */
  workingMemoryString: string;
  /** Discovered tools from working context */
  discoveredTools: string[];
  /** Previous messages before current prompt */
  previousMessages: ModelMessage[];
  /** Trim result info */
  trimInfo: {
    messagesRemoved: number;
    turnsRemoved: number;
    invalidTurnsRemoved: number;
    removedTools: string[];
    activeTools: string[];
  };
}

// ============================================================================
// Logger Factory
// ============================================================================

/**
 * Creates a logger instance for the execution
 */
export type LoggerFactory = (traceId: string) => AgentLogger;
