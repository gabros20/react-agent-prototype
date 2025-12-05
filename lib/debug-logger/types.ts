/**
 * Debug Logger Types
 *
 * Provides a clean abstraction layer over the trace-store for debug logging.
 * Decouples logging concerns from SSE parsing and agent communication.
 */

import type { TraceEntryType, TraceLevel } from "@/app/assistant/_stores/trace-store";

export { type TraceEntryType, type TraceLevel };

/**
 * Metrics for a completed trace
 */
export interface TraceMetrics {
	totalDuration: number;
	toolCallCount: number;
	stepCount: number;
	tokens: { input: number; output: number };
	cost: number;
	errorCount: number;
}

/**
 * Model pricing information
 */
export interface ModelPricing {
	prompt: number; // $ per million tokens
	completion: number; // $ per million tokens
}

/**
 * Options for starting a trace
 */
export interface TraceStartOptions {
	sessionId?: string;
	userPrompt?: string;
}

/**
 * Options for completing a trace
 */
export interface TraceCompleteOptions {
	metrics?: Partial<TraceMetrics>;
	entries?: unknown[];
}

/**
 * TraceLogger - Scoped logger for a single agent execution trace
 *
 * Usage:
 * ```ts
 * const trace = debugLogger.trace(traceId);
 * trace.start({ sessionId, userPrompt });
 * trace.toolCall("cms_getPage", { slug: "home" }, "call-123");
 * trace.toolResult("call-123", { id: "page-1" });
 * trace.complete({ tokens: { input: 500, output: 200 } });
 * ```
 */
export interface TraceLogger {
	/** The trace ID this logger is scoped to */
	readonly traceId: string;

	/**
	 * Start the trace - creates trace-start entry and initializes conversation log
	 */
	start(options?: TraceStartOptions): void;

	// =========================================================================
	// Tool Lifecycle
	// =========================================================================

	/**
	 * Log a tool call - returns the entry ID for later updates
	 * @param name Tool name
	 * @param args Tool arguments
	 * @param callId Unique identifier for this tool call
	 * @returns Entry ID
	 */
	toolCall(name: string, args: unknown, callId: string): string;

	/**
	 * Log successful tool result - updates the original tool-call entry
	 * @param callId The tool call ID from toolCall()
	 * @param result The tool result
	 */
	toolResult(callId: string, result: unknown): void;

	/**
	 * Log tool error - updates the original tool-call entry with error
	 * @param callId The tool call ID from toolCall()
	 * @param error Error message
	 */
	toolError(callId: string, error: string): void;

	/**
	 * Log tool requiring confirmation
	 * @param callId The tool call ID
	 * @param toolName Tool name
	 * @param result Result containing confirmation details
	 * @param duration Duration of tool execution
	 */
	toolConfirmation(
		callId: string,
		toolName: string,
		result: unknown,
		duration?: number
	): void;

	// =========================================================================
	// Step Lifecycle
	// =========================================================================

	/**
	 * Log step start
	 * @param stepNumber Step number (1-indexed)
	 * @returns Entry ID for the streaming text entry
	 */
	stepStart(stepNumber: number): string;

	/**
	 * Log step completion
	 * @param stepNumber Step number
	 * @param options Optional metrics for the step
	 */
	stepComplete(
		stepNumber: number,
		options?: { duration?: number; tokens?: { input: number; output: number } }
	): void;

	// =========================================================================
	// Content Logging
	// =========================================================================

	/**
	 * Update streaming text - appends delta to current streaming entry
	 * @param delta Text delta to append
	 */
	textDelta(delta: string): void;

	/**
	 * Finalize streaming text for a step
	 * @param stepNumber Step number
	 * @param finalText Complete text
	 * @param duration Optional duration
	 */
	textFinalize(stepNumber: number, finalText: string, duration?: number): void;

	/**
	 * Remove empty streaming entry (when step had no text output)
	 * @param stepNumber Step number
	 */
	textRemoveEmpty(stepNumber: number): void;

	/**
	 * Log system prompt
	 * @param prompt The compiled system prompt
	 * @param tokens Token count
	 * @param workingMemoryTokens Optional working memory token count
	 */
	systemPrompt(
		prompt: string,
		tokens: number,
		workingMemoryTokens?: number
	): void;

	/**
	 * Log user prompt
	 * @param prompt User's prompt
	 * @param tokens Token count for prompt
	 * @param historyTokens Token count for message history
	 * @param messageCount Number of messages in history
	 */
	userPrompt(
		prompt: string,
		tokens: number,
		historyTokens?: number,
		messageCount?: number
	): void;

	/**
	 * Log LLM response
	 * @param text Response text
	 * @param tokens Token usage
	 */
	llmResponse(text: string, tokens: { input: number; output: number }): void;

	// =========================================================================
	// Metadata
	// =========================================================================

	/**
	 * Log model information and pricing
	 * @param modelId Model identifier
	 * @param pricing Optional pricing information
	 */
	modelInfo(modelId: string, pricing: ModelPricing | null): void;

	/**
	 * Log available tools
	 * @param tools List of tool names
	 */
	toolsAvailable(tools: string[]): void;

	// =========================================================================
	// Dynamic Tool Injection
	// =========================================================================

	/**
	 * Log tools discovered via tool_search
	 * @param tools List of discovered tool names
	 * @param categories Categories of discovered tools
	 * @param query The search query that found them
	 */
	toolsDiscovered(tools: string[], categories: string[], query: string): void;

	/**
	 * Log active tools changed in prepareStep
	 * @param stepNumber Current step number
	 * @param activeTools Current list of active tools
	 * @param newTools Tools added in this step
	 */
	activeToolsChanged(stepNumber: number, activeTools: string[], newTools: string[]): void;

	// =========================================================================
	// Working Memory
	// =========================================================================

	/**
	 * Log working memory update
	 * @param entityCount Number of entities
	 * @param metadata Optional metadata
	 */
	workingMemoryUpdate(entityCount: number, metadata?: unknown): void;

	/**
	 * Log memory trimming event
	 * @param originalCount Original message count
	 * @param newCount New message count
	 */
	memoryTrimmed(originalCount: number, newCount: number): void;

	// =========================================================================
	// Session Events
	// =========================================================================

	/**
	 * Log session loaded
	 * @param messageCount Number of messages loaded
	 */
	sessionLoaded(messageCount: number): void;

	/**
	 * Log checkpoint saved
	 * @param stepNumber Step number at checkpoint
	 */
	checkpointSaved(stepNumber: number): void;

	/**
	 * Log retry attempt
	 * @param message Retry message
	 * @param metadata Optional metadata
	 */
	retryAttempt(message: string, metadata?: unknown): void;

	// =========================================================================
	// System Logging
	// =========================================================================

	/**
	 * Log a system message
	 * @param message Message text
	 * @param metadata Optional metadata
	 */
	systemLog(message: string, metadata?: unknown): void;

	/**
	 * Log a warning
	 * @param message Warning message
	 * @param metadata Optional metadata
	 */
	warn(message: string, metadata?: unknown): void;

	// =========================================================================
	// Background Job Events (for worker/queue events)
	// =========================================================================

	/**
	 * Log job queued
	 * @param jobId Unique job identifier
	 * @param jobName Job name (e.g., "generate-metadata")
	 * @param imageId Related image ID
	 * @returns Entry ID for later updates
	 */
	jobQueued(jobId: string, jobName: string, imageId: string): string;

	/**
	 * Log job progress update
	 * @param jobId Job identifier
	 * @param progress Progress percentage (0-100)
	 */
	jobProgress(jobId: string, progress: number): void;

	/**
	 * Log job completed
	 * @param jobId Job identifier
	 * @param duration Duration in ms
	 */
	jobComplete(jobId: string, duration?: number): void;

	/**
	 * Log job failed
	 * @param jobId Job identifier
	 * @param error Error message
	 */
	jobFailed(jobId: string, error: string): void;

	// =========================================================================
	// Completion
	// =========================================================================

	/**
	 * Complete the trace successfully
	 * @param options Completion options including final metrics
	 */
	complete(options?: TraceCompleteOptions): void;

	/**
	 * Log an error
	 * @param error Error message or Error object
	 * @param stack Optional stack trace
	 */
	error(error: string | Error, stack?: string): void;
}

/**
 * DebugLogger - Main logger interface providing scoped trace loggers
 *
 * Usage:
 * ```ts
 * import { debugLogger } from "@/lib/debug-logger";
 *
 * // Quick logging (goes to active trace)
 * debugLogger.info("Something happened", { data });
 *
 * // Scoped trace logging
 * const trace = debugLogger.trace(traceId);
 * trace.start({ sessionId, userPrompt });
 * ```
 */
export interface DebugLogger {
	/**
	 * Create a scoped trace logger for a specific trace ID
	 * @param traceId Unique identifier for the trace
	 */
	trace(traceId: string): TraceLogger;

	/**
	 * Quick info log - goes to active trace if one exists
	 * @param message Log message
	 * @param data Optional data
	 */
	info(message: string, data?: unknown): void;

	/**
	 * Quick warn log - goes to active trace if one exists
	 * @param message Warning message
	 * @param data Optional data
	 */
	warn(message: string, data?: unknown): void;

	/**
	 * Quick error log - goes to active trace if one exists
	 * @param message Error message
	 * @param error Optional error object
	 */
	error(message: string, error?: Error): void;

	/**
	 * Get the currently active trace ID
	 */
	getActiveTraceId(): string | null;

	/**
	 * Set the active trace ID (usually set automatically when trace.start() is called)
	 */
	setActiveTraceId(traceId: string | null): void;
}
