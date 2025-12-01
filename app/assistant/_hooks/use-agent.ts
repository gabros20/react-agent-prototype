"use client";

import { useCallback, useState, useRef } from "react";
import { useChatStore } from "../_stores/chat-store";
import { useLogStore } from "../_stores/log-store";
import { useTraceStore, type TraceMetrics } from "../_stores/trace-store";
import { useSessionStore } from "../_stores/session-store";
import { formatTokenCount } from "@/lib/tokenizer";

// Custom message type that's simpler than UIMessage
export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: Date;
}

export function useAgent() {
	// Use selectors to avoid subscribing to entire store
	const messages = useChatStore((state) => state.messages);
	const sessionId = useChatStore((state) => state.sessionId);
	const addMessage = useChatStore((state) => state.addMessage);
	const setIsStreaming = useChatStore((state) => state.setIsStreaming);
	const setSessionId = useChatStore((state) => state.setSessionId);
	const setCurrentTraceId = useChatStore((state) => state.setCurrentTraceId);
	const setAgentStatus = useChatStore((state) => state.setAgentStatus);

	const addLog = useLogStore((state) => state.addLog);

	const addEntry = useTraceStore((state) => state.addEntry);
	const updateEntry = useTraceStore((state) => state.updateEntry);
	const deleteEntry = useTraceStore((state) => state.deleteEntry);
	const completeEntry = useTraceStore((state) => state.completeEntry);
	const setActiveTrace = useTraceStore((state) => state.setActiveTrace);
	const setModelInfo = useTraceStore((state) => state.setModelInfo);
	const addConversationLog = useTraceStore((state) => state.addConversationLog);

	const loadSessions = useSessionStore((state) => state.loadSessions);

	const [error, setError] = useState<Error | null>(null);

	// Track tool call timings for duration calculation
	const toolTimings = useRef<Map<string, number>>(new Map());

	// Track streaming entry for text-delta updates
	const streamingEntryId = useRef<string | null>(null);
	const streamingText = useRef<string>("");

	// Track user prompt for saving conversation log
	const currentUserPrompt = useRef<string>("");

	const sendMessage = useCallback(
		async (prompt: string) => {
			if (!prompt.trim()) return;

			setError(null);
			setIsStreaming(true);
			setAgentStatus({ state: "thinking" });

			// Reset timings for new trace
			toolTimings.current.clear();

			// Store user prompt for conversation log
			currentUserPrompt.current = prompt;

			// Add user message
			const userMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content: prompt,
				createdAt: new Date(),
			};
			addMessage(userMessage as any);

			try {
				// Call backend API
				const response = await fetch("/api/agent", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						sessionId: sessionId || undefined,
						prompt,
					}),
				});

				if (!response.ok) {
					throw new Error(`API Error: ${response.statusText}`);
				}

				if (!response.body) {
					throw new Error("No response body");
				}

				// Parse SSE stream
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";
				let currentTraceId = "";
				let assistantText = "";
				const traceStartTime = Date.now();

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });

					// Process complete SSE messages
					const lines = buffer.split("\n\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						if (!line.trim()) continue;

						try {
							// Parse SSE format: "event: <type>\ndata: <json>"
							const eventMatch = line.match(/^event: (.+)\ndata: (.+)$/s);
							if (!eventMatch) continue;

							const [, eventType, dataStr] = eventMatch;
							const data = JSON.parse(dataStr);

							// Handle different event types
							switch (eventType) {
								case "log": {
									// Initialize trace on first log with traceId
									if (data.traceId && !currentTraceId) {
										currentTraceId = data.traceId;
										setActiveTrace(currentTraceId);

										// Add trace-start entry (sessionId only, prompt shown in user-prompt)
										addEntry({
											traceId: currentTraceId,
											timestamp: traceStartTime,
											type: "trace-start",
											level: "info",
											summary: `Trace started`,
											input: { sessionId },
										});

										// Add a live conversation log entry
										const traceStore = useTraceStore.getState();
										const existingLogs = traceStore.conversationLogs;
										// Calculate next index from max existing index (not length, to handle gaps)
										const maxIndex = existingLogs.length > 0
											? Math.max(...existingLogs.map(l => l.conversationIndex))
											: 0;
										addConversationLog({
											id: currentTraceId,
											sessionId: sessionId || "",
											conversationIndex: maxIndex + 1,
											userPrompt: currentUserPrompt.current,
											startedAt: new Date(traceStartTime),
											completedAt: null,
											metrics: null,
											modelInfo: null,
											entries: [],
											isLive: true,
										});
									}
									currentTraceId = data.traceId || currentTraceId;

									// Parse backend log messages for enhanced trace entries
									const message = data.message || "";
									const metadata = data.metadata || {};

									// Detect specific log patterns from agent routes
									if (message.includes("Extracted entities to working memory")) {
										addEntry({
											traceId: currentTraceId,
											timestamp: Date.now(),
											type: "working-memory-update",
											level: "info",
											summary: `Working memory: +${metadata.entityCount || 0} entities`,
											input: metadata,
										});
									} else if (message.includes("Trimming message history")) {
										addEntry({
											traceId: currentTraceId,
											timestamp: Date.now(),
											type: "memory-trimmed",
											level: "warn",
											summary: `Messages trimmed: ${metadata.originalCount} → ${metadata.newCount}`,
											input: metadata,
										});
									} else if (message.includes("Checkpoint saved")) {
										addEntry({
											traceId: currentTraceId,
											timestamp: Date.now(),
											type: "checkpoint-saved",
											level: "info",
											stepNumber: metadata.stepNumber,
											summary: `Checkpoint saved at step ${metadata.stepNumber}`,
											input: metadata,
										});
									} else if (message.includes("Retry")) {
										addEntry({
											traceId: currentTraceId,
											timestamp: Date.now(),
											type: "retry-attempt",
											level: "warn",
											summary: message,
											input: metadata,
										});
									} else if (message.includes("Loaded session history")) {
										addEntry({
											traceId: currentTraceId,
											timestamp: Date.now(),
											type: "session-loaded",
											level: "info",
											summary: `Session loaded: ${metadata.messageCount || 0} messages`,
											input: metadata,
										});
									} else if (message.includes("Creating agent")) {
										// Log agent creation with tool count
										addEntry({
											traceId: currentTraceId,
											timestamp: Date.now(),
											type: "system-log",
											level: "info",
											summary: `Agent created: ${metadata.toolCount || 0} tools, model: ${metadata.modelId || "unknown"}`,
											output: metadata,
										});
									} else if (message.includes("Step") && message.includes("starting")) {
										// Skip - handled by step-start SSE event to avoid duplication
									} else if (data.level === "warn" || data.level === "error") {
										// Skip tool failure logs - these are handled by tool-error SSE event
										const isToolFailure = message.includes("Tool") && message.includes("failed");
										if (!isToolFailure) {
											// Capture other warnings and errors as system logs
											addEntry({
												traceId: currentTraceId,
												timestamp: Date.now(),
												type: "system-log",
												level: data.level,
												summary: message,
												output: metadata,
											});
										}
									}

									// Legacy log store
									addLog({
										id: crypto.randomUUID(),
										traceId: data.traceId || currentTraceId,
										stepId: "",
										timestamp: new Date(data.timestamp),
										type: "info",
										message: data.message,
										input: data.metadata,
									});
									break;
								}

								case "text-delta": {
									// Streaming text chunks - accumulate and update streaming entry
									const delta = data.delta || data.text || "";
									assistantText += delta;
									streamingText.current += delta;

									// Update streaming entry with clean preview
									if (streamingEntryId.current) {
										const cleanText = streamingText.current
											.replace(/\*\*/g, "")
											.replace(/\*/g, "")
											.replace(/`/g, "")
											.replace(/\n/g, " ")
											.replace(/\s+/g, " ")
											.trim();
										const preview = cleanText.slice(0, 60);
										const truncated = cleanText.length > 60 ? "..." : "";
										updateEntry(streamingEntryId.current, {
											summary: `"${preview}${truncated}"`,
											output: streamingText.current,
										});
									}
									break;
								}

								case "system-prompt": {
									// System prompt with server-calculated tokens
									const tokens = data.tokens || 0;
									const workingMemoryTokens = data.workingMemoryTokens || 0;
									addEntry({
										traceId: currentTraceId,
										timestamp: Date.now(),
										type: "system-prompt",
										level: "info",
										summary: `System prompt (${formatTokenCount(tokens)} tokens${
											workingMemoryTokens > 0 ? `, incl. ${formatTokenCount(workingMemoryTokens)} working memory` : ""
										})`,
										input: data.prompt,
										tokens: { input: tokens, output: 0 },
										// Store breakdown in output for detail modal
										output: {
											totalTokens: tokens,
											workingMemoryTokens,
											promptLength: data.promptLength,
										},
									});
									break;
								}

								case "user-prompt": {
									// User prompt with server-calculated tokens
									const tokens = data.tokens || 0;
									const historyTokens = data.messageHistoryTokens || 0;
									addEntry({
										traceId: currentTraceId,
										timestamp: Date.now(),
										type: "user-prompt",
										level: "info",
										summary: `User prompt (${formatTokenCount(tokens)} tokens${
											historyTokens > 0 ? `, +${formatTokenCount(historyTokens)} history` : ""
										})`,
										input: data.prompt,
										tokens: { input: tokens + historyTokens, output: 0 },
										output: {
											promptTokens: tokens,
											messageHistoryTokens: historyTokens,
											messageCount: data.messageCount || 0,
										},
									});
									break;
								}

								case "tools-available": {
									// List of tools available to the agent
									addEntry({
										traceId: currentTraceId,
										timestamp: Date.now(),
										type: "tools-available",
										level: "info",
										summary: `${data.count} tools available`,
										output: data.tools,
									});
									break;
								}

								case "model-info": {
									// Model ID and pricing info for cost calculation
									if (data.modelId) {
										setModelInfo(currentTraceId, data.modelId, data.pricing || null);
									}
									addEntry({
										traceId: currentTraceId,
										timestamp: Date.now(),
										type: "model-info",
										level: "info",
										summary: data.modelId || "Unknown model",
										output: data.pricing
											? {
													modelId: data.modelId,
													promptPrice: `$${data.pricing.prompt.toFixed(4)}/M tokens`,
													completionPrice: `$${data.pricing.completion.toFixed(4)}/M tokens`,
											  }
											: { modelId: data.modelId, pricing: "unavailable" },
									});
									break;
								}

								case "tool-call": {
									// Tool is being called
									setAgentStatus({ state: "tool-call", toolName: data.toolName });
									const toolCallId = data.toolCallId || crypto.randomUUID();

									// Track timing for duration calculation
									toolTimings.current.set(toolCallId, Date.now());

									// Enhanced trace entry
									addEntry({
										traceId: currentTraceId,
										timestamp: Date.now(),
										type: "tool-call",
										level: "info",
										toolName: data.toolName,
										toolCallId,
										summary: `Calling ${data.toolName}`,
										input: data.args,
									});

									// Legacy log store
									addLog({
										id: crypto.randomUUID(),
										traceId: currentTraceId,
										stepId: toolCallId,
										timestamp: new Date(),
										type: "tool-call",
										message: `Calling tool: ${data.toolName}`,
										input: data.args,
									});
									break;
								}

								case "tool-result": {
									// Tool execution completed - back to thinking
									setAgentStatus({ state: "thinking" });
									const toolCallId = data.toolCallId || "";

									// Calculate duration
									const startTime = toolTimings.current.get(toolCallId);
									const duration = startTime ? Date.now() - startTime : undefined;
									toolTimings.current.delete(toolCallId);

									// Check if result requires confirmation (explicit confirmation flag pattern)
									const result = data.result || {};
									const requiresConfirmation = result.requiresConfirmation === true;

									if (requiresConfirmation) {
										// Tool returned a confirmation request (different from HITL approval)
										addEntry({
											traceId: currentTraceId,
											timestamp: Date.now(),
											duration,
											type: "confirmation-required",
											level: "warn",
											toolName: data.toolName,
											toolCallId,
											summary: `${data.toolName}: Confirmation required`,
											output: result,
										});
									} else {
										// Update the original tool-call entry with output and duration
										// This stops the in-progress indicator and adds the result to the same entry
										if (toolCallId) {
											completeEntry(toolCallId, result, undefined);
										}
									}

									// Legacy log store
									addLog({
										id: crypto.randomUUID(),
										traceId: currentTraceId,
										stepId: toolCallId,
										timestamp: new Date(),
										type: "tool-result",
										message: `Tool ${data.toolName || "result"} completed`,
										input: data.result,
									});
									break;
								}

								case "tool-error": {
									// Tool execution failed - update the tool-call entry with error
									setAgentStatus({ state: "thinking" });
									const toolCallId = data.toolCallId || "";

									// Clear timing entry
									toolTimings.current.delete(toolCallId);

									// Update the original tool-call entry with error info
									if (toolCallId) {
										completeEntry(toolCallId, undefined, {
											message: data.error || "Tool execution failed",
										});
									}

									// Legacy log store
									addLog({
										id: crypto.randomUUID(),
										traceId: currentTraceId,
										stepId: toolCallId,
										timestamp: new Date(),
										type: "error",
										message: `Tool ${data.toolName || "unknown"} failed: ${data.error}`,
									});
									break;
								}

								case "step-start": {
									// Step is starting
									addEntry({
										traceId: currentTraceId,
										timestamp: Date.now(),
										type: "step-start",
										level: "info",
										stepNumber: data.stepNumber,
										summary: `Step ${data.stepNumber}`,
									});

									// Create streaming entry for this step's text output
									const streamId = `stream-step-${data.stepNumber}`;
									streamingEntryId.current = streamId;
									streamingText.current = "";
									addEntry({
										id: streamId,
										traceId: currentTraceId,
										timestamp: Date.now(),
										type: "text-streaming",
										level: "info",
										stepNumber: data.stepNumber,
										summary: "Generating...",
									});
									break;
								}

								case "step-finish": {
									// Complete the streaming entry for this step
									const streamId = `stream-step-${data.stepNumber}`;
									if (streamingText.current) {
										// Has text - finalize the entry with clean preview
										const finalText = streamingText.current;
										// Clean up markdown for preview: remove **, *, etc.
										const cleanText = finalText
											.replace(/\*\*/g, "")
											.replace(/\*/g, "")
											.replace(/`/g, "")
											.replace(/\n/g, " ")
											.replace(/\s+/g, " ")
											.trim();
										const preview = cleanText.slice(0, 80);
										const truncated = cleanText.length > 80 ? "..." : "";
										updateEntry(streamId, {
											summary: `"${preview}${truncated}"`,
											output: finalText,
											duration: data.duration,
										});
									} else {
										// No text generated in this step - delete the entry entirely
										deleteEntry(streamId);
									}

									// Reset streaming state
									streamingEntryId.current = null;
									streamingText.current = "";

									// Step completed - log with metrics (no expandable content)
									addEntry({
										traceId: currentTraceId,
										timestamp: Date.now(),
										duration: data.duration,
										type: "step-complete",
										level: "info",
										stepNumber: data.stepNumber,
										summary: `Step ${data.stepNumber} complete`,
										tokens: data.usage
											? {
													input: data.usage.promptTokens || 0,
													output: data.usage.completionTokens || 0,
											  }
											: undefined,
									});
									break;
								}

								// Legacy step event names - ignore
								case "step":
								case "step-complete":
								case "step-completed":
									break;

								case "result": {
									currentTraceId = data.traceId;
									setCurrentTraceId(data.traceId);
									assistantText = data.text || "";

									// Update sessionId from backend response (not traceId!)
									if (data.sessionId && data.sessionId !== sessionId) {
										setSessionId(data.sessionId);
									}

									// Only add assistant message if there's actual content
									// (skip empty messages, e.g. when approval is pending)
									if (assistantText.trim()) {
										const assistantMessage: ChatMessage = {
											id: crypto.randomUUID(),
											role: "assistant",
											content: assistantText,
											createdAt: new Date(),
										};
										addMessage(assistantMessage as any);
									}

									// Enhanced trace entry for LLM response - use SDK usage (source of truth)
									const usage = data.usage || {};
									const inputTokens = usage.promptTokens || usage.inputTokens || 0;
									const outputTokens = usage.completionTokens || usage.outputTokens || 0;
									addEntry({
										traceId: currentTraceId,
										timestamp: Date.now(),
										type: "llm-response",
										level: "info",
										summary: `LLM response (${formatTokenCount(inputTokens)} in / ${formatTokenCount(outputTokens)} out)`,
										output: assistantText,
										tokens: { input: inputTokens, output: outputTokens },
									});

									// Log intelligence metrics
									if (data.intelligence) {
										addLog({
											id: crypto.randomUUID(),
											traceId: currentTraceId,
											stepId: "final",
											timestamp: new Date(),
											type: "info",
											message: "Intelligence Layer Stats",
											input: data.intelligence,
										});
									}
									break;
								}

								case "error":
									// Enhanced trace entry for errors
									addEntry({
										traceId: data.traceId || currentTraceId,
										timestamp: Date.now(),
										type: "error",
										level: "error",
										summary: data.error || "Unknown error",
										error: {
											message: data.error || "Unknown error",
											stack: data.stack,
										},
									});

									// Legacy log store
									addLog({
										id: crypto.randomUUID(),
										traceId: data.traceId || currentTraceId,
										stepId: "error",
										timestamp: new Date(),
										type: "error",
										message: data.error || "Unknown error",
									});
									setError(new Error(data.error || "Unknown error"));
									break;

								case "done": {
									// Add trace-complete entry
									if (currentTraceId) {
										const completedAt = Date.now();
										addEntry({
											traceId: currentTraceId,
											timestamp: completedAt,
											duration: completedAt - traceStartTime,
											type: "trace-complete",
											level: "info",
											summary: `Trace completed (${completedAt - traceStartTime}ms)`,
										});

										// Get current state for entries and metrics
										const traceStore = useTraceStore.getState();
										const entries = traceStore.entriesByTrace.get(currentTraceId) || [];
										const modelInfo = traceStore.modelInfoByTrace.get(currentTraceId);
										const metrics = traceStore.getMetrics();

										// Update the live conversation log with final data
										addConversationLog({
											id: currentTraceId,
											sessionId: sessionId || "",
											conversationIndex: traceStore.conversationLogs.find((l) => l.id === currentTraceId)?.conversationIndex || 1,
											userPrompt: currentUserPrompt.current,
											startedAt: new Date(traceStartTime),
											completedAt: new Date(completedAt),
											metrics,
											modelInfo: modelInfo || null,
											entries,
											isLive: false, // No longer live
										});

										// Get actual sessionId (may have been updated from result event)
										const actualSessionId = useChatStore.getState().sessionId;

										if (actualSessionId) {
											// Save to backend asynchronously
											fetch(`/api/sessions/${actualSessionId}/logs`, {
												method: "POST",
												headers: { "Content-Type": "application/json" },
												body: JSON.stringify({
													userPrompt: currentUserPrompt.current,
													entries: entries.map((e) => ({
														...e,
														// Ensure serializable
														timestamp: e.timestamp,
													})),
													metrics,
													modelInfo: modelInfo || undefined,
													startedAt: new Date(traceStartTime).toISOString(),
													completedAt: new Date(completedAt).toISOString(),
												}),
											})
												.then(() => {
													// Refresh session list to update message counts and titles
													loadSessions();
												})
												.catch((err) => {
													console.error("Failed to save conversation log:", err);
												});
										}
									}
									break;
								}

								case "finish": {
									// AI SDK overall finish event - logged for debugging
									// Step-level metrics come from step-finish events
									if (data?.usage) {
										console.log("Stream finished:", {
											finishReason: data.finishReason,
											totalUsage: data.usage,
										});
									}
									break;
								}

								default:
									console.warn("Unknown SSE event type:", eventType);
							}
						} catch (parseError) {
							console.error("Failed to parse SSE message:", parseError);
						}
					}
				}

				// SessionId already updated from 'result' event - don't use traceId as sessionId!
			} catch (err) {
				const error = err as Error;
				console.error("Agent error:", error);
				setError(error);

				addLog({
					id: crypto.randomUUID(),
					traceId: "error",
					stepId: "error",
					timestamp: new Date(),
					type: "error",
					message: error.message,
				});
			} finally {
				setIsStreaming(false);
				setAgentStatus(null);
			}
		},
		[
			sessionId,
			addMessage,
			setIsStreaming,
			setSessionId,
			setCurrentTraceId,
			setAgentStatus,
			addLog,
			addEntry,
			updateEntry,
			deleteEntry,
			setActiveTrace,
			completeEntry,
			setModelInfo,
			addConversationLog,
			loadSessions,
		]
	);

	return {
		messages,
		sendMessage,
		isStreaming: useChatStore((state) => state.isStreaming),
		error,
	};
}
