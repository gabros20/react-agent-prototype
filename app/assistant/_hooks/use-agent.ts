"use client";

import { useCallback, useState, useRef } from "react";
import { useChatStore } from "../_stores/chat-store";
import { useTraceStore, type TraceEntry } from "../_stores/trace-store";
import { useSessionStore } from "../_stores/session-store";
import { agentApi, sessionsApi } from "@/lib/api";
import { debugLogger } from "@/lib/debug-logger";
import type { SSEEvent } from "@/lib/api";
import type { TraceLogger } from "@/lib/debug-logger";

// Custom message type that's simpler than UIMessage
export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: Date;
}

export function useAgent() {
	// Store selectors
	const messages = useChatStore((state) => state.messages);
	const sessionId = useChatStore((state) => state.sessionId);
	const streamingMessage = useChatStore((state) => state.streamingMessage);
	const addMessage = useChatStore((state) => state.addMessage);
	const setIsStreaming = useChatStore((state) => state.setIsStreaming);
	const setSessionId = useChatStore((state) => state.setSessionId);
	const setCurrentTraceId = useChatStore((state) => state.setCurrentTraceId);
	const setAgentStatus = useChatStore((state) => state.setAgentStatus);
	const startStreamingMessage = useChatStore((state) => state.startStreamingMessage);
	const appendToStreamingMessage = useChatStore((state) => state.appendToStreamingMessage);
	const finalizeStreamingMessage = useChatStore((state) => state.finalizeStreamingMessage);
	const clearStreamingMessage = useChatStore((state) => state.clearStreamingMessage);
	const loadSessions = useSessionStore((state) => state.loadSessions);
	const getCurrentSessionModel = useSessionStore((state) => state.getCurrentSessionModel);

	const [error, setError] = useState<Error | null>(null);

	// Refs for tracking state across SSE events
	const traceRef = useRef<TraceLogger | null>(null);
	const traceStartTimeRef = useRef<number>(0);
	const userPromptRef = useRef<string>("");
	const streamingTextRef = useRef<string>("");

	const sendMessage = useCallback(
		async (prompt: string) => {
			if (!prompt.trim()) return;

			setError(null);
			setIsStreaming(true);
			setAgentStatus({ state: "thinking" });

			// Store user prompt for conversation log
			userPromptRef.current = prompt;
			traceStartTimeRef.current = Date.now();
			streamingTextRef.current = "";

			// Add user message
			const userMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content: prompt,
				createdAt: new Date(),
			};
			addMessage(userMessage as unknown as Parameters<typeof addMessage>[0]);

			try {
				const modelId = getCurrentSessionModel();
				const stream = await agentApi.stream({
					sessionId: sessionId || undefined,
					prompt,
					modelId: modelId || undefined,
				});

				let currentTraceId = "";
				let assistantText = "";

				for await (const event of stream) {
					const result = processSSEEvent(event, {
						currentTraceId,
						assistantText,
						sessionId,
					});
					if (result.traceId) currentTraceId = result.traceId;
					if (result.text !== undefined) assistantText = result.text;
				}
			} catch (err) {
				const error = err as Error;
				console.error("Agent error:", error);
				setError(error);
				debugLogger.error(error.message, error);
			} finally {
				setIsStreaming(false);
				setAgentStatus(null);
			}
		},
		[sessionId, addMessage, setIsStreaming, setSessionId, setCurrentTraceId, setAgentStatus, clearStreamingMessage, loadSessions, getCurrentSessionModel]
	);

	// Helper to ensure trace is initialized
	function ensureTrace(
		d: Record<string, unknown>,
		state: { currentTraceId: string; sessionId: string | null }
	): string | undefined {
		if (d.traceId && !state.currentTraceId) {
			const traceId = d.traceId as string;
			traceRef.current = debugLogger.trace(traceId);
			traceRef.current.start({
				sessionId: state.sessionId || undefined,
				userPrompt: userPromptRef.current,
			});
			return traceId;
		}
		return undefined;
	}

	// Process a single SSE event
	function processSSEEvent(
		event: SSEEvent,
		state: { currentTraceId: string; assistantText: string; sessionId: string | null }
	): { traceId?: string; text?: string } {
		const { type, data } = event;
		const d = data as Record<string, unknown>;

		// Initialize trace on first event with traceId (could be system-prompt, model-info, etc.)
		const newTraceId = ensureTrace(d, state);
		if (newTraceId) {
			state.currentTraceId = newTraceId;
		}

		switch (type) {
			case "log": {
				// Process log messages for trace entries
				const message = (d.message as string) || "";
				const metadata = d.metadata as Record<string, unknown> | undefined;
				const trace = traceRef.current;
				if (!trace) break;

				if (message.includes("Extracted entities to working memory")) {
					trace.workingMemoryUpdate((metadata?.entityCount as number) || 0, metadata);
				} else if (message.includes("Trimming message history")) {
					trace.memoryTrimmed((metadata?.originalCount as number) || 0, (metadata?.newCount as number) || 0);
				} else if (message.includes("Checkpoint saved")) {
					trace.checkpointSaved((metadata?.stepNumber as number) || 0);
				} else if (message.includes("Retry")) {
					trace.retryAttempt(message, metadata);
				} else if (message.includes("Loaded session history")) {
					trace.sessionLoaded((metadata?.messageCount as number) || 0);
				} else if (message.includes("Creating agent")) {
					trace.systemLog(`Agent created: ${metadata?.toolCount || 0} tools, model: ${metadata?.modelId || "unknown"}`, metadata);
				} else if ((d.level === "warn" || d.level === "error") && !message.includes("Tool") && !message.includes("failed")) {
					trace.warn(message, metadata);
				}
				break;
			}

			case "message-start": {
				// Start a new streaming message for UI display
				const messageId = (d.messageId as string) || crypto.randomUUID();
				startStreamingMessage(messageId);
				break;
			}

			case "text-delta": {
				const delta = (d.delta as string) || (d.text as string) || "";
				streamingTextRef.current += delta;
				// Update streaming message for real-time UI display
				appendToStreamingMessage(delta);
				traceRef.current?.textDelta(delta);
				return { text: state.assistantText + delta };
			}

			case "message-complete": {
				// Finalize the streaming message - move to messages array
				finalizeStreamingMessage();
				break;
			}

			case "system-prompt": {
				traceRef.current?.systemPrompt(
					d.prompt as string,
					(d.tokens as number) || 0,
					d.workingMemoryTokens as number | undefined
				);
				break;
			}

			case "user-prompt": {
				traceRef.current?.userPrompt(
					d.prompt as string,
					(d.tokens as number) || 0,
					d.messageHistoryTokens as number | undefined,
					d.messageCount as number | undefined,
					d.messages as Array<{ role: string; content: unknown }> | undefined
				);
				break;
			}

			case "tools-available": {
				traceRef.current?.toolsAvailable(d.tools as string[]);
				break;
			}

			case "tools-discovered": {
				// Handle dynamic tool discovery via tool_search
				const tools = (d.tools as string[]) || [];
				traceRef.current?.toolsDiscovered(tools);
				break;
			}

			case "model-info": {
				if (d.modelId) {
					const pricing = d.pricing as { prompt: number; completion: number } | null;
					traceRef.current?.modelInfo(d.modelId as string, pricing);
				}
				break;
			}

			case "tool-call": {
				setAgentStatus({ state: "tool-call", toolName: d.toolName as string });
				const callId = (d.toolCallId as string) || crypto.randomUUID();
				traceRef.current?.toolCall(d.toolName as string, d.args, callId);
				break;
			}

			case "tool-result": {
				setAgentStatus({ state: "thinking" });
				const callId = d.toolCallId as string;
				const result = (d.result as Record<string, unknown>) || {};

				if (result.requiresConfirmation === true) {
					traceRef.current?.toolConfirmation(callId, d.toolName as string, result);
				} else {
					traceRef.current?.toolResult(callId, result);
				}
				break;
			}

			case "tool-error": {
				setAgentStatus({ state: "thinking" });
				traceRef.current?.toolError(d.toolCallId as string, (d.error as string) || "Tool execution failed");
				break;
			}

			case "step-start": {
				traceRef.current?.stepStart(d.stepNumber as number, {
					activeTools: d.activeTools as string[] | undefined,
					discoveredTools: d.discoveredTools as string[] | undefined,
				});
				streamingTextRef.current = "";
				break;
			}

			case "instructions-injected": {
				// Handle injected instructions for debug panel
				const tools = (d.tools as string[]) || [];
				const instructions = (d.instructions as string) || "";
				const stepNumber = d.stepNumber as number;
				const updatedSystemPrompt = d.updatedSystemPrompt as string | undefined;
				traceRef.current?.instructionsInjected(stepNumber, tools, instructions, updatedSystemPrompt);
				break;
			}

			case "llm-context": {
				// Actual messages sent to LLM (after trimming)
				const messages = (d.messages as Array<{ role: string; content: unknown }>) || [];
				const messageCount = (d.messageCount as number) || messages.length;
				const tokens = (d.tokens as number) || 0;
				traceRef.current?.llmContext(messages, messageCount, tokens);
				break;
			}

			case "context-cleanup": {
				// Context cleanup: messages trimmed and/or tools removed
				const messagesRemoved = (d.messagesRemoved as number) || 0;
				const removedTools = (d.removedTools as string[]) || [];
				const activeTools = (d.activeTools as string[]) || [];
				traceRef.current?.contextCleanup(messagesRemoved, removedTools, activeTools);
				break;
			}

			case "step-finish": {
				const stepNumber = d.stepNumber as number;
				const finalText = streamingTextRef.current;

				if (finalText) {
					traceRef.current?.textFinalize(stepNumber, finalText, d.duration as number | undefined);
				} else {
					traceRef.current?.textRemoveEmpty(stepNumber);
				}
				streamingTextRef.current = "";

				const usage = d.usage as { promptTokens?: number; completionTokens?: number } | undefined;
				traceRef.current?.stepComplete(stepNumber, {
					duration: d.duration as number | undefined,
					tokens: usage ? { input: usage.promptTokens || 0, output: usage.completionTokens || 0 } : undefined,
				});
				break;
			}

			case "step":
			case "step-complete":
			case "step-completed":
				break; // Legacy events - ignore

			case "result": {
				const traceId = d.traceId as string;
				setCurrentTraceId(traceId);
				const text = (d.text as string) || "";

				if (d.sessionId && d.sessionId !== state.sessionId) {
					setSessionId(d.sessionId as string);
				}

				// Clear any remaining streaming message (shouldn't happen, but safety net)
				clearStreamingMessage();

				// NOTE: We no longer add assistant message here
				// message-complete events handle adding messages during streaming

				const usage = d.usage as { promptTokens?: number; completionTokens?: number; inputTokens?: number; outputTokens?: number } | undefined;
				const inputTokens = usage?.promptTokens || usage?.inputTokens || 0;
				const outputTokens = usage?.completionTokens || usage?.outputTokens || 0;
				traceRef.current?.llmResponse(text, { input: inputTokens, output: outputTokens });

				return { traceId, text };
			}

			case "error": {
				traceRef.current?.error((d.error as string) || "Unknown error", d.stack as string | undefined);
				setError(new Error((d.error as string) || "Unknown error"));
				break;
			}

			case "done": {
				const trace = traceRef.current;
				if (!trace) break;

				const completedAt = Date.now();

				// Call complete() first - it adds the trace-complete entry
				// Don't pass entries here - let trace.complete() capture them AFTER adding trace-complete
				trace.complete({ metrics: useTraceStore.getState().getMetrics() });

				// Now get entries AFTER trace-complete was added
				const store = useTraceStore.getState();
				const entries = store.entriesByTrace[trace.traceId] || [];
				const metrics = store.getMetrics();

				// Save to backend
				const actualSessionId = useChatStore.getState().sessionId;
				if (actualSessionId) {
					const modelInfo = store.modelInfoByTrace[trace.traceId];
					sessionsApi
						.saveLog(actualSessionId, {
							userPrompt: userPromptRef.current,
							entries: entries.map((e: TraceEntry) => ({ ...e })),
							metrics,
							modelInfo: modelInfo || undefined,
							startedAt: new Date(traceStartTimeRef.current).toISOString(),
							completedAt: new Date(completedAt).toISOString(),
						})
						.then(() => loadSessions())
						.catch((err) => console.error("Failed to save conversation log:", err));
				}

				traceRef.current = null;
				break;
			}

			case "finish":
				break; // AI SDK finish event - logged for debugging only

			default:
				console.warn("Unknown SSE event type:", type);
		}

		// Return new traceId if we just initialized the trace
		if (newTraceId) {
			return { traceId: newTraceId };
		}

		return {};
	}

	return {
		messages,
		streamingMessage,
		sendMessage,
		isStreaming: useChatStore((state) => state.isStreaming),
		error,
	};
}
