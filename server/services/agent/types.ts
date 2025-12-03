/**
 * Agent Orchestrator Types
 *
 * Types for the agent execution orchestration layer.
 */

import type { ModelMessage } from "ai";
import type { AgentLogger, StreamWriter } from "../../tools/types";
import type { DrizzleDB } from "../../db/client";
import type { ServiceContainer } from "../service-container";
import type { VectorIndexService } from "../vector-index";
import type { SessionService } from "../session-service";

// ============================================================================
// Execute Options
// ============================================================================

/**
 * Options for agent execution
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
 * Internal options with resolved values
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
// Stream Events (SSE)
// ============================================================================

export interface BaseStreamEvent {
	type: string;
	timestamp: string;
}

export interface TextDeltaEvent extends BaseStreamEvent {
	type: "text-delta";
	delta: string;
}

export interface ToolCallEvent extends BaseStreamEvent {
	type: "tool-call";
	toolName: string;
	toolCallId: string;
	args: unknown;
}

export interface ToolResultEvent extends BaseStreamEvent {
	type: "tool-result";
	toolCallId: string;
	toolName: string;
	result: unknown;
}

export interface ToolErrorEvent extends BaseStreamEvent {
	type: "tool-error";
	toolCallId: string;
	toolName: string;
	error: string;
}

export interface StepStartEvent extends BaseStreamEvent {
	type: "step-start";
	stepNumber: number;
}

export interface StepFinishEvent extends BaseStreamEvent {
	type: "step-finish";
	stepNumber: number;
	duration: number;
	finishReason?: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
	};
}

export interface FinishEvent extends BaseStreamEvent {
	type: "finish";
	finishReason: string;
	usage: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
	toolCallsCount: number;
}

export interface SystemPromptEvent extends BaseStreamEvent {
	type: "system-prompt";
	prompt: string;
	promptLength: number;
	tokens: number;
	workingMemory: string;
	workingMemoryTokens: number;
}

export interface UserPromptEvent extends BaseStreamEvent {
	type: "user-prompt";
	prompt: string;
	tokens: number;
	messageHistoryTokens: number;
	messageCount: number;
}

export interface ModelInfoEvent extends BaseStreamEvent {
	type: "model-info";
	modelId: string;
	pricing: {
		prompt: number;
		completion: number;
	} | null;
}

export interface LogEvent extends BaseStreamEvent {
	type: "log";
	traceId: string;
	level: "info" | "warn" | "error";
	message: string;
	metadata?: Record<string, unknown>;
}

export interface ResultEvent {
	type: "result";
	traceId: string;
	sessionId: string;
	text: string;
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
	finishReason: string;
	usage: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
}

export interface DoneEvent {
	type: "done";
	traceId: string;
	sessionId: string;
}

export interface ErrorEvent {
	type: "error";
	traceId: string;
	error: string;
}

/**
 * Union type for all stream events
 */
export type StreamEvent =
	| TextDeltaEvent
	| ToolCallEvent
	| ToolResultEvent
	| ToolErrorEvent
	| StepStartEvent
	| StepFinishEvent
	| FinishEvent
	| SystemPromptEvent
	| UserPromptEvent
	| ModelInfoEvent
	| LogEvent
	| ResultEvent
	| DoneEvent
	| ErrorEvent;

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
// Orchestrator Dependencies
// ============================================================================

/**
 * Dependencies required by the orchestrator
 */
export interface OrchestratorDependencies {
	db: DrizzleDB;
	services: ServiceContainer;
	sessionService: SessionService;
	vectorIndex: VectorIndexService;
}
