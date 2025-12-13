/**
 * TraceLogger Implementation
 *
 * Scoped logger for a single agent execution trace.
 * Wraps trace-store actions with a cleaner API.
 */

import { useTraceStore, type TraceEntry } from "@/app/assistant/_stores/trace-store";
import { formatTokenCount } from "@/lib/tokenizer";
import type {
	TraceLogger,
	TraceStartOptions,
	TraceCompleteOptions,
	ModelPricing,
} from "./types";

/**
 * Create a TraceLogger instance for a specific trace ID
 */
export function createTraceLogger(traceId: string): TraceLogger {
	// Internal state for tracking
	let traceStartTime = Date.now();
	let currentUserPrompt = "";
	let currentSessionId = "";
	let streamingText = "";
	let currentStreamingEntryId: string | null = null;
	const toolTimings = new Map<string, number>();

	// Get store actions (called once, not subscribed)
	const getStore = () => useTraceStore.getState();

	return {
		traceId,

		// =========================================================================
		// Trace Lifecycle
		// =========================================================================

		start(options?: TraceStartOptions) {
			traceStartTime = Date.now();
			currentUserPrompt = options?.userPrompt || "";
			currentSessionId = options?.sessionId || "";

			const store = getStore();
			store.setActiveTrace(traceId);

			// Add trace-start entry
			store.addEntry({
				traceId,
				timestamp: traceStartTime,
				type: "trace-start",
				level: "info",
				summary: "Trace started",
				input: { sessionId: currentSessionId },
			});

			// Create live conversation log
			const existingLogs = store.conversationLogs;
			const maxIndex =
				existingLogs.length > 0
					? Math.max(...existingLogs.map((l) => l.conversationIndex))
					: 0;

			store.addConversationLog({
				id: traceId,
				sessionId: currentSessionId,
				conversationIndex: maxIndex + 1,
				userPrompt: currentUserPrompt,
				startedAt: new Date(traceStartTime),
				completedAt: null,
				metrics: null,
				modelInfo: null,
				entries: [],
				isLive: true,
			});
		},

		// =========================================================================
		// Tool Lifecycle
		// =========================================================================

		toolCall(name: string, input: unknown, callId: string): string {
			const timestamp = Date.now();
			toolTimings.set(callId, timestamp);

			const entryId = callId; // Use callId as entry ID for easy lookup
			getStore().addEntry({
				id: entryId,
				traceId,
				timestamp,
				type: "tool-call",
				level: "info",
				toolName: name,
				toolCallId: callId,
				summary: `Calling ${name}`,
				input,
			});

			return entryId;
		},

		toolResult(callId: string, result: unknown) {
			const startTime = toolTimings.get(callId);
			const duration = startTime ? Date.now() - startTime : undefined;
			toolTimings.delete(callId);

			getStore().completeEntry(callId, result, undefined);
		},

		toolError(callId: string, error: string) {
			toolTimings.delete(callId);
			getStore().completeEntry(callId, undefined, { message: error });
		},

		toolConfirmation(
			callId: string,
			toolName: string,
			result: unknown,
			duration?: number
		) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				duration,
				type: "confirmation-required",
				level: "warn",
				toolName,
				toolCallId: callId,
				summary: `${toolName}: Confirmation required`,
				output: result,
			});
		},

		// =========================================================================
		// Step Lifecycle
		// =========================================================================

		stepStart(stepNumber: number, options?: { activeTools?: string[]; discoveredTools?: string[] }): string {
			const store = getStore();
			const activeCount = options?.activeTools?.length || 0;
			const discoveredCount = options?.discoveredTools?.length || 0;

			// Add step-start entry with tool info
			store.addEntry({
				traceId,
				timestamp: Date.now(),
				type: "step-start",
				level: "info",
				stepNumber,
				summary: discoveredCount > 0
					? `Step ${stepNumber} | ${activeCount} active tools (${discoveredCount} discovered)`
					: `Step ${stepNumber} | ${activeCount} active tools`,
				input: options?.discoveredTools?.length ? { discoveredTools: options.discoveredTools } : undefined,
				output: options?.activeTools?.length ? { activeTools: options.activeTools } : undefined,
			});

			// Create streaming entry for text output
			const streamId = `stream-step-${stepNumber}`;
			currentStreamingEntryId = streamId;
			streamingText = "";

			store.addEntry({
				id: streamId,
				traceId,
				timestamp: Date.now(),
				type: "text-streaming",
				level: "info",
				stepNumber,
				summary: "Generating...",
			});

			return streamId;
		},

		stepComplete(
			stepNumber: number,
			options?: { duration?: number; tokens?: { input: number; output: number } }
		) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				duration: options?.duration,
				type: "step-complete",
				level: "info",
				stepNumber,
				summary: `Step ${stepNumber} complete`,
				tokens: options?.tokens,
			});
		},

		// =========================================================================
		// Content Logging
		// =========================================================================

		textDelta(delta: string) {
			streamingText += delta;

			if (currentStreamingEntryId) {
				// Clean text for preview
				const cleanText = streamingText
					.replace(/\*\*/g, "")
					.replace(/\*/g, "")
					.replace(/`/g, "")
					.replace(/\n/g, " ")
					.replace(/\s+/g, " ")
					.trim();
				const preview = cleanText.slice(0, 60);
				const truncated = cleanText.length > 60 ? "..." : "";

				getStore().updateEntry(currentStreamingEntryId, {
					summary: `"${preview}${truncated}"`,
					output: streamingText,
				});
			}
		},

		textFinalize(stepNumber: number, finalText: string, duration?: number) {
			const streamId = `stream-step-${stepNumber}`;

			if (finalText) {
				// Clean text for preview
				const cleanText = finalText
					.replace(/\*\*/g, "")
					.replace(/\*/g, "")
					.replace(/`/g, "")
					.replace(/\n/g, " ")
					.replace(/\s+/g, " ")
					.trim();
				const preview = cleanText.slice(0, 80);
				const truncated = cleanText.length > 80 ? "..." : "";

				getStore().updateEntry(streamId, {
					summary: `"${preview}${truncated}"`,
					output: finalText,
					duration,
				});
			}

			// Reset streaming state
			currentStreamingEntryId = null;
			streamingText = "";
		},

		textRemoveEmpty(stepNumber: number) {
			const streamId = `stream-step-${stepNumber}`;
			getStore().deleteEntry(streamId);
			currentStreamingEntryId = null;
			streamingText = "";
		},

		systemPrompt(prompt: string, tokens: number, workingMemoryTokens?: number) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "system-prompt",
				level: "info",
				summary: `System prompt (${formatTokenCount(tokens)} tokens${
					workingMemoryTokens
						? `, incl. ${formatTokenCount(workingMemoryTokens)} working memory`
						: ""
				})`,
				input: prompt,
				tokens: { input: tokens, output: 0 },
				output: {
					totalTokens: tokens,
					workingMemoryTokens: workingMemoryTokens || 0,
					promptLength: prompt.length,
				},
			});
		},

		userPrompt(
			prompt: string,
			tokens: number,
			historyTokens?: number,
			messageCount?: number,
			messages?: Array<{ role: string; content: unknown }>
		) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "user-prompt",
				level: "info",
				summary: `User prompt (${formatTokenCount(tokens)} tokens${
					historyTokens ? `, +${formatTokenCount(historyTokens)} history` : ""
				})`,
				input: prompt,
				tokens: { input: tokens + (historyTokens || 0), output: 0 },
				output: {
					promptTokens: tokens,
					messageHistoryTokens: historyTokens || 0,
					messageCount: messageCount || 0,
					messages: messages || [], // Actual messages sent to LLM (for trimmed view)
				},
			});
		},

		llmResponse(text: string, tokens: { input: number; output: number }) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "llm-response",
				level: "info",
				summary: `LLM response (${formatTokenCount(tokens.input)} in / ${formatTokenCount(tokens.output)} out)`,
				output: text,
				tokens,
			});
		},

		// =========================================================================
		// Metadata
		// =========================================================================

		modelInfo(modelId: string, pricing: ModelPricing | null) {
			const store = getStore();
			store.setModelInfo(traceId, modelId, pricing);

			store.addEntry({
				traceId,
				timestamp: Date.now(),
				type: "model-info",
				level: "info",
				summary: modelId || "Unknown model",
				output: pricing
					? {
							modelId,
							promptPrice: `$${pricing.prompt.toFixed(4)}/M tokens`,
							completionPrice: `$${pricing.completion.toFixed(4)}/M tokens`,
						}
					: { modelId, pricing: "unavailable" },
			});
		},

		toolsAvailable(tools: string[]) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "tools-available",
				level: "info",
				summary: `${tools.length} tools available`,
				output: tools,
			});
		},

		// =========================================================================
		// Dynamic Tool Injection
		// =========================================================================

		toolsDiscovered(tools: string[]) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "tools-discovered",
				level: "info",
				summary: `Discovered ${tools.length} tools`,
				output: { tools },
			});
		},

		activeToolsChanged(stepNumber: number, activeTools: string[], newTools: string[]) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "active-tools-changed",
				level: "info",
				stepNumber,
				summary: `+${newTools.length} tools → ${activeTools.length} active`,
				input: { newTools },
				output: { activeTools, totalCount: activeTools.length },
			});
		},

		instructionsInjected(stepNumber: number, tools: string[], instructions: string, updatedSystemPrompt?: string) {
			const store = getStore();

			// Update the system-prompt entry with the full dynamic content
			// This shows what the agent actually sees (base prompt + injected instructions)
			if (updatedSystemPrompt) {
				const entries = store.entriesByTrace[traceId] || [];
				const systemPromptEntry = entries.find((e) => e.type === "system-prompt");
				if (systemPromptEntry) {
					store.updateEntry(systemPromptEntry.id, {
						input: updatedSystemPrompt,
					});
				}
			}

			store.addEntry({
				traceId,
				timestamp: Date.now(),
				type: "instructions-injected",
				level: "info",
				stepNumber,
				summary: `${tools.length} tool instructions injected`,
				input: { tools },
				output: instructions, // Full instructions in output for expandable view
			});
		},

		// =========================================================================
		// Context Management
		// =========================================================================

		llmContext(
			messages: Array<{ role: string; content: unknown }>,
			messageCount: number,
			tokens: number
		) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "llm-context",
				level: "info",
				summary: `Sent to LLM: ${messageCount} messages (${formatTokenCount(tokens)} tokens)`,
				output: { messages, messageCount, tokens },
			});
		},

		contextCleanup(
			messagesRemoved: number,
			removedTools: string[],
			activeTools: string[]
		) {
			if (messagesRemoved === 0 && removedTools.length === 0) return;

			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "context-cleanup",
				level: removedTools.length > 0 ? "warn" : "info",
				summary: removedTools.length > 0
					? `Cleanup: -${messagesRemoved} msgs, -${removedTools.length} tools`
					: `Cleanup: -${messagesRemoved} msgs`,
				input: { messagesRemoved, removedTools },
				output: { activeTools, activeToolCount: activeTools.length },
			});
		},

		// =========================================================================
		// Compaction Events
		// =========================================================================

		compactionStart(tokensBefore: number, modelLimit: number) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "compaction-start",
				level: "info",
				summary: `Compaction starting: ${formatTokenCount(tokensBefore)} tokens (limit: ${formatTokenCount(modelLimit)})`,
				input: { tokensBefore, modelLimit },
			});
		},

		compactionProgress(stage: 'pruning' | 'summarizing', progress: number) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "compaction-progress",
				level: "info",
				summary: `Compacting: ${stage} (${progress}%)`,
				input: { stage, progress },
			});
		},

		compactionComplete(result: {
			tokensBefore: number;
			tokensAfter: number;
			tokensSaved: number;
			compressionRatio: number;
			wasPruned: boolean;
			wasCompacted: boolean;
			prunedOutputs: number;
			compactedMessages: number;
			removedTools: string[];
		}) {
			const actions: string[] = [];
			if (result.wasPruned) actions.push(`pruned ${result.prunedOutputs} outputs`);
			if (result.wasCompacted) actions.push(`summarized ${result.compactedMessages} msgs`);

			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "compaction-complete",
				level: "info",
				summary: `Compacted: ${formatTokenCount(result.tokensBefore)} → ${formatTokenCount(result.tokensAfter)} (${result.compressionRatio}% saved)`,
				input: actions.length > 0 ? { actions } : undefined,
				output: {
					tokensBefore: result.tokensBefore,
					tokensAfter: result.tokensAfter,
					tokensSaved: result.tokensSaved,
					compressionRatio: result.compressionRatio,
					wasPruned: result.wasPruned,
					wasCompacted: result.wasCompacted,
					prunedOutputs: result.prunedOutputs,
					compactedMessages: result.compactedMessages,
					removedTools: result.removedTools,
				},
			});
		},

		// =========================================================================
		// Working Memory
		// =========================================================================

		workingMemoryUpdate(entityCount: number, metadata?: unknown) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "working-memory-update",
				level: "info",
				summary: `Working memory: +${entityCount} entities`,
				input: metadata,
			});
		},

		memoryTrimmed(originalCount: number, newCount: number) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "memory-trimmed",
				level: "warn",
				summary: `Messages trimmed: ${originalCount} → ${newCount}`,
				input: { originalCount, newCount },
			});
		},

		// =========================================================================
		// Session Events
		// =========================================================================

		sessionLoaded(messageCount: number) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "session-loaded",
				level: "info",
				summary: `Session loaded: ${messageCount} messages`,
				input: { messageCount },
			});
		},

		checkpointSaved(stepNumber: number) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "checkpoint-saved",
				level: "info",
				stepNumber,
				summary: `Checkpoint saved at step ${stepNumber}`,
				input: { stepNumber },
			});
		},

		retryAttempt(message: string, metadata?: unknown) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "retry-attempt",
				level: "warn",
				summary: message,
				input: metadata,
			});
		},

		// =========================================================================
		// System Logging
		// =========================================================================

		systemLog(message: string, metadata?: unknown) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "system-log",
				level: "info",
				summary: message,
				output: metadata,
			});
		},

		warn(message: string, metadata?: unknown) {
			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "system-log",
				level: "warn",
				summary: message,
				output: metadata,
			});
		},

		// =========================================================================
		// Background Job Events
		// =========================================================================

		jobQueued(jobId: string, jobName: string, imageId: string): string {
			const entryId = `job-${jobId}`;
			const shortJobName = jobName.replace("generate-", "");
			const shortImageId = imageId.substring(0, 8);

			getStore().addEntry({
				id: entryId,
				traceId,
				timestamp: Date.now(),
				type: "job-queued",
				level: "info",
				jobId,
				jobProgress: 0,
				summary: `${shortJobName} for ${shortImageId}`,
				input: { imageId, jobName },
			});

			return entryId;
		},

		jobProgress(jobId: string, progress: number) {
			const entryId = `job-${jobId}`;
			getStore().updateEntry(entryId, {
				type: "job-progress",
				jobProgress: progress,
			});
		},

		jobComplete(jobId: string, duration?: number) {
			const entryId = `job-${jobId}`;
			getStore().updateEntry(entryId, {
				type: "job-complete",
				jobProgress: 100,
				duration,
			});
		},

		jobFailed(jobId: string, error: string) {
			const entryId = `job-${jobId}`;
			getStore().updateEntry(entryId, {
				type: "job-failed",
				level: "error",
				error: { message: error },
			});
		},

		// =========================================================================
		// Completion
		// =========================================================================

		complete(options?: TraceCompleteOptions) {
			const completedAt = Date.now();
			const store = getStore();

			// Get final entries and metrics (no trace-complete entry - we use completedAt timestamp instead)
			const entries = store.entriesByTrace[traceId] || [];
			const modelInfo = store.modelInfoByTrace[traceId];
			const metrics = store.getMetrics();

			// Calculate total duration
			const totalDuration = completedAt - traceStartTime;

			// Update conversation log with final data
			const existingLog = store.conversationLogs.find((l) => l.id === traceId);
			store.addConversationLog({
				id: traceId,
				sessionId: currentSessionId,
				conversationIndex: existingLog?.conversationIndex || 1,
				userPrompt: currentUserPrompt,
				startedAt: new Date(traceStartTime),
				completedAt: new Date(completedAt),
				metrics: options?.metrics
					? { ...metrics, ...options.metrics, totalDuration }
					: { ...metrics, totalDuration },
				modelInfo: modelInfo || null,
				entries: (options?.entries as TraceEntry[]) || entries,
				isLive: false,
			});
		},

		error(error: string | Error, stack?: string) {
			const message = error instanceof Error ? error.message : error;
			const errorStack = error instanceof Error ? error.stack : stack;

			getStore().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "error",
				level: "error",
				summary: message,
				error: { message, stack: errorStack },
			});
		},
	};
}
