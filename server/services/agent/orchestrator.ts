/**
 * Agent Orchestrator
 *
 * Centralized business logic for agent execution.
 * Routes become thin controllers that delegate to this service.
 *
 * Responsibilities:
 * - Session initialization and validation
 * - CMS target resolution
 * - Working context loading and persistence
 * - Agent execution (streaming and non-streaming)
 * - Entity extraction from tool results
 * - Message persistence
 */

import { randomUUID } from "crypto";
import type { ModelMessage } from "ai";
import { cmsAgent, AGENT_CONFIG, getLastInjectedInstructions, type AgentCallOptions } from "../../agent/cms-agent";
import { getSystemPrompt } from "../../agent/system-prompt";
import { EntityExtractor, WorkingContext } from "../working-memory";
import { ContextManager } from "../context-manager";
import { getSiteAndEnv } from "../../utils/get-context";
import { getModelPricing } from "../openrouter-pricing";
import { countTokens, countChatTokens } from "../../../lib/tokenizer";
import type { AgentLogger, StreamWriter } from "../../tools/types";
import type {
	ExecuteOptions,
	ResolvedExecuteOptions,
	OrchestratorDependencies,
	OrchestratorResult,
	StreamEvent,
} from "./types";

// ============================================================================
// Orchestrator Class
// ============================================================================

export class AgentOrchestrator {
	private readonly deps: OrchestratorDependencies;
	private readonly extractor: EntityExtractor;
	private readonly contextManager: ContextManager;

	constructor(deps: OrchestratorDependencies) {
		this.deps = deps;
		this.extractor = new EntityExtractor();
		this.contextManager = new ContextManager({ maxMessages: 30, minTurnsToKeep: 2 });
	}

	// ==========================================================================
	// Public Methods
	// ==========================================================================

	/**
	 * Execute agent with streaming response
	 * Yields SSE events as async iterable
	 */
	async *executeStream(
		options: ExecuteOptions,
		writeSSE: (event: string, data: unknown) => void
	): AsyncGenerator<void, void, unknown> {
		const resolved = await this.resolveOptions(options);
		const logger = this.createSSELogger(resolved.traceId, writeSSE);

		try {
			// Ensure session exists
			await this.deps.sessionService.ensureSession(resolved.sessionId);

			// Load working context
			const workingContext = await this.deps.sessionService.loadWorkingContext(
				resolved.sessionId
			);

			// Emit system prompt info
			await this.emitSystemPromptInfo(resolved, workingContext, writeSSE);

			// Emit model info
			await this.emitModelInfo(resolved, writeSSE);

			// Load previous messages
			const previousMessages = await this.loadPreviousMessages(
				options.sessionId,
				logger
			);

			// Emit user prompt info
			this.emitUserPromptInfo(resolved, previousMessages, writeSSE);

			// Build messages array
			const messages: ModelMessage[] = [
				...previousMessages,
				{ role: "user", content: resolved.prompt },
			];

			// Progressive context cleanup - trim messages and remove unused tools
			const trimResult = this.contextManager.trimContext(messages, workingContext);

			// Emit SSE event for debugging/UI visibility
			if (trimResult.messagesRemoved > 0 || trimResult.removedTools.length > 0 || trimResult.invalidTurnsRemoved > 0) {
				logger.info("Context cleanup", {
					messagesRemoved: trimResult.messagesRemoved,
					turnsRemoved: trimResult.turnsRemoved,
					invalidTurnsRemoved: trimResult.invalidTurnsRemoved,
					removedTools: trimResult.removedTools,
				});
				writeSSE("context-cleanup", {
					type: "context-cleanup",
					messagesRemoved: trimResult.messagesRemoved,
					turnsRemoved: trimResult.turnsRemoved,
					invalidTurnsRemoved: trimResult.invalidTurnsRemoved,
					removedTools: trimResult.removedTools,
					activeTools: trimResult.activeTools,
					timestamp: new Date().toISOString(),
				});
			}

			// Build agent options
			const agentOptions = this.buildAgentOptions(resolved, workingContext, logger, {
				write: (event) => {
					const eventType = (event as { type?: string }).type || "step";
					writeSSE(eventType, event);
				},
			});

			// Emit the actual context sent to LLM (after trimming)
			// This is what the debug panel "Trimmed" view shows
			const trimmedTokens = countChatTokens(
				trimResult.messages.map((m) => ({
					role: m.role,
					content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
				}))
			);
			writeSSE("llm-context", {
				type: "llm-context",
				traceId: resolved.traceId,
				sessionId: resolved.sessionId,
				messages: trimResult.messages.map((m) => ({
					role: m.role,
					content: m.content,
				})),
				messageCount: trimResult.messages.length,
				tokens: trimmedTokens,
				timestamp: new Date().toISOString(),
			});

			logger.info("Starting agent execution", {
				traceId: resolved.traceId,
				sessionId: resolved.sessionId,
				prompt: resolved.prompt.slice(0, 100),
			});

			// Stream using cmsAgent (with trimmed messages)
			const streamResult = await cmsAgent.stream({
				messages: trimResult.messages,
				options: agentOptions,
			});

			// Process stream
			const { toolCalls, toolResults, finalText, finishReason, usage } =
				await this.processStream(
					streamResult,
					workingContext,
					logger,
					writeSSE
				);

			// Get response messages
			const responseData = await streamResult.response;

			logger.info("Agent execution completed", {
				traceId: resolved.traceId,
				toolCallsCount: toolCalls.length,
				finishReason,
			});

			// Save conversation and working context
			await this.saveSessionData(
				resolved.sessionId,
				previousMessages,
				resolved.prompt,
				responseData.messages,
				workingContext,
				logger
			);

			// Send final result
			writeSSE("result", {
				traceId: resolved.traceId,
				sessionId: resolved.sessionId,
				text: finalText,
				toolCalls,
				toolResults,
				finishReason,
				usage,
			});

			// Close connection
			writeSSE("done", { traceId: resolved.traceId, sessionId: resolved.sessionId });
		} catch (error) {
			logger.error("Agent execution error", {
				traceId: resolved.traceId,
				error: (error as Error).message,
				stack: (error as Error).stack,
			});

			writeSSE("error", {
				traceId: resolved.traceId,
				error: (error as Error).message,
			});
		}
	}

	/**
	 * Execute agent with non-streaming response
	 */
	async executeGenerate(options: ExecuteOptions): Promise<OrchestratorResult> {
		const resolved = await this.resolveOptions(options);
		const logger = this.createConsoleLogger();

		// Ensure session exists
		await this.deps.sessionService.ensureSession(resolved.sessionId);

		// Load working context
		const workingContext = await this.deps.sessionService.loadWorkingContext(
			resolved.sessionId
		);

		logger.info("Starting agent execution (non-streaming)", {
			traceId: resolved.traceId,
			sessionId: resolved.sessionId,
			prompt: resolved.prompt.slice(0, 100),
		});

		// Load previous messages
		const previousMessages = await this.loadPreviousMessages(
			options.sessionId,
			logger
		);

		// Build messages array
		const messages: ModelMessage[] = [
			...previousMessages,
			{ role: "user", content: resolved.prompt },
		];

		// Progressive context cleanup - trim messages and remove unused tools
		const trimResult = this.contextManager.trimContext(messages, workingContext);

		if (trimResult.messagesRemoved > 0 || trimResult.removedTools.length > 0 || trimResult.invalidTurnsRemoved > 0) {
			logger.info("Context cleanup", {
				messagesRemoved: trimResult.messagesRemoved,
				turnsRemoved: trimResult.turnsRemoved,
				invalidTurnsRemoved: trimResult.invalidTurnsRemoved,
				removedTools: trimResult.removedTools,
			});
		}

		// Build agent options (no stream writer for non-streaming)
		const agentOptions = this.buildAgentOptions(resolved, workingContext, logger);

		// Execute using cmsAgent (with trimmed messages)
		const result = await cmsAgent.generate({
			messages: trimResult.messages,
			options: agentOptions,
		});

		logger.info("Agent execution completed", {
			traceId: resolved.traceId,
			stepsCount: result.steps?.length || 0,
		});

		// Save conversation and working context
		await this.saveSessionData(
			resolved.sessionId,
			previousMessages,
			resolved.prompt,
			result.response.messages,
			workingContext,
			logger
		);

		return {
			traceId: resolved.traceId,
			sessionId: resolved.sessionId,
			text: result.text,
			steps: result.steps || [],
			usage: result.usage || {},
		};
	}

	// ==========================================================================
	// Private Methods - Option Resolution
	// ==========================================================================

	private async resolveOptions(options: ExecuteOptions): Promise<ResolvedExecuteOptions> {
		const traceId = randomUUID();
		const sessionId = options.sessionId || randomUUID();
		const modelId = options.modelId || AGENT_CONFIG.modelId;
		const cmsTarget = await this.resolveCmsTarget(options.cmsTarget);

		return {
			prompt: options.prompt,
			sessionId,
			traceId,
			modelId,
			cmsTarget,
		};
	}

	private async resolveCmsTarget(
		target?: { siteId?: string; environmentId?: string }
	): Promise<{ siteId: string; environmentId: string }> {
		try {
			// Use provided IDs if they look like UUIDs
			if (target?.siteId && target.siteId.includes("-")) {
				return {
					siteId: target.siteId,
					environmentId: target.environmentId || "main",
				};
			}

			// Lookup by name (default: local-site/main)
			const siteName = target?.siteId || "local-site";
			const envName = target?.environmentId || "main";
			return await getSiteAndEnv(this.deps.db, siteName, envName);
		} catch {
			// Fallback: get first available site/env
			const site = await this.deps.db.query.sites.findFirst();
			const env = await this.deps.db.query.environments.findFirst();
			if (!site || !env) {
				throw new Error("No site/environment configured. Run seed script first.");
			}
			return { siteId: site.id, environmentId: env.id };
		}
	}

	// ==========================================================================
	// Private Methods - Logger Creation
	// ==========================================================================

	private createSSELogger(
		traceId: string,
		writeSSE: (event: string, data: unknown) => void
	): AgentLogger {
		return {
			info: (msg, meta) => {
				const message = typeof msg === "string" ? msg : JSON.stringify(msg);
				console.log("[INFO]", message, meta);
				writeSSE("log", {
					type: "log",
					traceId,
					level: "info",
					message,
					metadata: meta,
					timestamp: new Date().toISOString(),
				});
			},
			warn: (msg, meta) => {
				const message = typeof msg === "string" ? msg : JSON.stringify(msg);
				console.warn("[WARN]", message, meta);
				writeSSE("log", {
					type: "log",
					traceId,
					level: "warn",
					message,
					metadata: meta,
					timestamp: new Date().toISOString(),
				});
			},
			error: (msg, meta) => {
				const message = typeof msg === "string" ? msg : JSON.stringify(msg);
				console.error("[ERROR]", message, meta);
				writeSSE("log", {
					type: "log",
					traceId,
					level: "error",
					message,
					metadata: meta,
					timestamp: new Date().toISOString(),
				});
			},
		};
	}

	private createConsoleLogger(): AgentLogger {
		return {
			info: (msg, meta) => {
				console.log("[INFO]", typeof msg === "string" ? msg : JSON.stringify(msg), meta);
			},
			warn: (msg, meta) => {
				console.warn("[WARN]", typeof msg === "string" ? msg : JSON.stringify(msg), meta);
			},
			error: (msg, meta) => {
				console.error("[ERROR]", typeof msg === "string" ? msg : JSON.stringify(msg), meta);
			},
		};
	}

	// ==========================================================================
	// Private Methods - Event Emission
	// ==========================================================================

	private async emitSystemPromptInfo(
		resolved: ResolvedExecuteOptions,
		workingContext: WorkingContext,
		writeSSE: (event: string, data: unknown) => void
	): Promise<void> {
		const workingMemoryStr = workingContext.toContextString();
		const systemPrompt = getSystemPrompt({
			currentDate: new Date().toISOString(),
			workingMemory: workingMemoryStr,
		});

		const systemPromptTokens = countTokens(systemPrompt);
		const workingMemoryTokens = workingMemoryStr ? countTokens(workingMemoryStr) : 0;

		writeSSE("system-prompt", {
			type: "system-prompt",
			traceId: resolved.traceId,
			sessionId: resolved.sessionId,
			prompt: systemPrompt,
			promptLength: systemPrompt.length,
			tokens: systemPromptTokens,
			workingMemory: workingMemoryStr,
			workingMemoryTokens,
			timestamp: new Date().toISOString(),
		});
	}

	private async emitModelInfo(
		resolved: ResolvedExecuteOptions,
		writeSSE: (event: string, data: unknown) => void
	): Promise<void> {
		const modelPricing = await getModelPricing(resolved.modelId);
		writeSSE("model-info", {
			type: "model-info",
			traceId: resolved.traceId,
			sessionId: resolved.sessionId,
			modelId: resolved.modelId,
			pricing: modelPricing,
			timestamp: new Date().toISOString(),
		});
	}

	private emitUserPromptInfo(
		resolved: ResolvedExecuteOptions,
		previousMessages: ModelMessage[],
		writeSSE: (event: string, data: unknown) => void
	): void {
		const userPromptTokens = countTokens(resolved.prompt);
		const messageHistoryTokens =
			previousMessages.length > 0
				? countChatTokens(
						previousMessages.map((m) => ({
							role: m.role,
							content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
						}))
				  )
				: 0;

		// Serialize messages for frontend consumption
		const serializedMessages = previousMessages.map((m) => ({
			role: m.role,
			content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
		}));

		writeSSE("user-prompt", {
			type: "user-prompt",
			traceId: resolved.traceId,
			sessionId: resolved.sessionId,
			prompt: resolved.prompt,
			tokens: userPromptTokens,
			messageHistoryTokens,
			messageCount: previousMessages.length,
			// Include actual messages array for "trimmed" view in Chat History
			messages: serializedMessages,
			timestamp: new Date().toISOString(),
		});
	}

	// ==========================================================================
	// Private Methods - Agent Options
	// ==========================================================================

	private buildAgentOptions(
		resolved: ResolvedExecuteOptions,
		workingContext: WorkingContext,
		logger: AgentLogger,
		stream?: StreamWriter
	): AgentCallOptions {
		return {
			sessionId: resolved.sessionId,
			traceId: resolved.traceId,
			modelId: resolved.modelId,
			workingMemory: workingContext.toContextString(),
			// Pass discovered tools directly from WorkingContext (avoids fragile regex parsing)
			discoveredTools: workingContext.getDiscoveredTools(),
			cmsTarget: resolved.cmsTarget,
			db: this.deps.db,
			services: this.deps.services,
			sessionService: this.deps.sessionService,
			vectorIndex: this.deps.vectorIndex,
			logger,
			stream,
		};
	}

	// ==========================================================================
	// Private Methods - Message Loading
	// ==========================================================================

	private async loadPreviousMessages(
		sessionId: string | undefined,
		logger: AgentLogger
	): Promise<ModelMessage[]> {
		if (!sessionId) return [];

		try {
			const messages = await this.deps.sessionService.loadMessages(sessionId);
			logger.info("Loaded session history", {
				sessionId,
				messageCount: messages.length,
			});
			return messages;
		} catch (error) {
			logger.warn("Could not load session history", {
				sessionId,
				error: (error as Error).message,
			});
			return [];
		}
	}

	// ==========================================================================
	// Private Methods - Stream Processing
	// ==========================================================================

	private async processStream(
		streamResult: Awaited<ReturnType<typeof cmsAgent.stream>>,
		workingContext: WorkingContext,
		logger: AgentLogger,
		writeSSE: (event: string, data: unknown) => void
	): Promise<{
		toolCalls: Array<{ toolName: string; toolCallId: string; args: unknown }>;
		toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }>;
		finalText: string;
		finishReason: string;
		usage: Record<string, unknown>;
	}> {
		const toolCalls: Array<{ toolName: string; toolCallId: string; args: unknown }> = [];
		const toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }> = [];
		let finalText = "";
		let finishReason = "unknown";
		let usage: Record<string, unknown> = {};
		let currentStep = 0;
		let stepStartTime = Date.now();

		for await (const chunk of streamResult.fullStream) {
			switch (chunk.type) {
				case "text-delta":
					finalText += chunk.text;
					writeSSE("text-delta", {
						type: "text-delta",
						delta: chunk.text,
						timestamp: new Date().toISOString(),
					});
					break;

				case "tool-call":
					logger.info("Tool called", {
						toolName: chunk.toolName,
						toolCallId: chunk.toolCallId,
					});

					toolCalls.push({
						toolName: chunk.toolName,
						toolCallId: chunk.toolCallId,
						args: chunk.input,
					});

					writeSSE("tool-call", {
						type: "tool-call",
						toolName: chunk.toolName,
						toolCallId: chunk.toolCallId,
						args: chunk.input,
						timestamp: new Date().toISOString(),
					});
					break;

				case "tool-result":
					logger.info("Tool result received", {
						toolCallId: chunk.toolCallId,
						toolName: chunk.toolName,
					});

					toolResults.push({
						toolCallId: chunk.toolCallId,
						toolName: chunk.toolName,
						result: chunk.output,
					});

					// Special handling for final_answer - extract content as final text
					// Use content if available, otherwise fall back to summary
					if (chunk.toolName === "final_answer" && chunk.output) {
						const finalAnswerResult = chunk.output as { content?: string; summary?: string };
						const responseText = finalAnswerResult.content?.trim()
							? finalAnswerResult.content
							: finalAnswerResult.summary || "";
						if (responseText) {
							finalText = responseText;
							writeSSE("text-delta", {
								type: "text-delta",
								delta: responseText,
								timestamp: new Date().toISOString(),
							});
						}
					}

					// Special handling for tool_search - emit tools-discovered event and persist
					if (chunk.toolName === "tool_search" && chunk.output) {
						// New format: { tools: string[], message: string }
						const searchResult = chunk.output as {
							tools?: string[];
							message?: string;
						};
						if (searchResult.tools && searchResult.tools.length > 0) {
							const toolNames = searchResult.tools;

							// Persist discovered tools to working context
							workingContext.addDiscoveredTools(toolNames);

							writeSSE("tools-discovered", {
								type: "tools-discovered",
								tools: toolNames,
								discoveredTotal: workingContext.discoveredToolsCount(),
								timestamp: new Date().toISOString(),
							});

							logger.info("Tools discovered via tool_search", {
								toolCount: toolNames.length,
								tools: toolNames,
								totalDiscovered: workingContext.discoveredToolsCount(),
							});
						}
					}

					// Record tool usage for all tools
					const toolResult = chunk.output as Record<string, unknown> | undefined;
					const isSuccess = !toolResult?.error;
					workingContext.recordToolUsage(chunk.toolName, isSuccess ? "success" : "error");

					// Extract entities from tool result
					const entities = this.extractor.extract(chunk.toolName, chunk.output);
					if (entities.length > 0) {
						workingContext.addMany(entities);

						logger.info("Extracted entities to working memory", {
							toolName: chunk.toolName,
							entityCount: entities.length,
							entities: entities.map((e) => `${e.type}:${e.name}`),
							workingMemorySize: workingContext.size(),
						});
					}

					writeSSE("tool-result", {
						type: "tool-result",
						toolCallId: chunk.toolCallId,
						toolName: chunk.toolName,
						result: chunk.output,
						timestamp: new Date().toISOString(),
					});
					break;

				case "finish":
					finishReason = chunk.finishReason;
					usage = chunk.totalUsage || {};

					logger.info("Stream finished", {
						finishReason,
						usage,
						toolCalls: toolCalls.length,
					});

					writeSSE("finish", {
						type: "finish",
						finishReason,
						usage,
						toolCallsCount: toolCalls.length,
						timestamp: new Date().toISOString(),
					});
					break;

				case "error":
					logger.error("Stream error", { error: chunk.error });
					throw chunk.error;

				case "tool-error":
					logger.error(`Tool ${chunk.toolName} failed`, {
						error: chunk.error,
					});
					writeSSE("tool-error", {
						type: "tool-error",
						toolCallId: chunk.toolCallId,
						toolName: chunk.toolName,
						error: chunk.error instanceof Error ? chunk.error.message : String(chunk.error),
						timestamp: new Date().toISOString(),
					});
					break;

				case "start-step":
					currentStep++;
					stepStartTime = Date.now();
					const discoveredToolsList = workingContext.getDiscoveredTools();
					writeSSE("step-start", {
						type: "step-start",
						stepNumber: currentStep,
						discoveredTools: discoveredToolsList,
						activeTools: ["tool_search", "final_answer", ...discoveredToolsList],
						timestamp: new Date().toISOString(),
					});

					// Emit instructions that were injected during prepareStep (runs before start-step)
					// Small delay to ensure prepareStep has completed (it's synchronous but timing can vary)
					setImmediate(() => {
						const injectedInstructions = getLastInjectedInstructions();
						if (injectedInstructions) {
							writeSSE("instructions-injected", {
								type: "instructions-injected",
								stepNumber: currentStep,
								tools: injectedInstructions.tools,
								instructions: injectedInstructions.instructions,
								updatedSystemPrompt: injectedInstructions.updatedSystemPrompt,
								timestamp: new Date().toISOString(),
							});
						}
					});
					break;

				case "finish-step":
					const stepDuration = Date.now() - stepStartTime;
					const stepUsage = (chunk as { usage?: { promptTokens?: number; completionTokens?: number } }).usage;

					writeSSE("step-finish", {
						type: "step-finish",
						stepNumber: currentStep,
						duration: stepDuration,
						finishReason: (chunk as { finishReason?: string }).finishReason,
						usage: stepUsage
							? {
									promptTokens: stepUsage.promptTokens || 0,
									completionTokens: stepUsage.completionTokens || 0,
							  }
							: undefined,
						timestamp: new Date().toISOString(),
					});
					break;

				default:
					// Silently ignore internal streaming events
					break;
			}
		}

		return { toolCalls, toolResults, finalText, finishReason, usage };
	}

	// ==========================================================================
	// Private Methods - Session Persistence
	// ==========================================================================

	private async saveSessionData(
		sessionId: string,
		previousMessages: ModelMessage[],
		userPrompt: string,
		responseMessages: ModelMessage[],
		workingContext: WorkingContext,
		logger: AgentLogger
	): Promise<void> {
		try {
			const updatedMessages: ModelMessage[] = [
				...previousMessages,
				{ role: "user", content: userPrompt },
				...responseMessages,
			];

			await this.deps.sessionService.saveMessages(sessionId, updatedMessages);

			logger.info("Saved messages to session", {
				sessionId,
				totalMessages: updatedMessages.length,
			});
		} catch (error) {
			logger.error("Failed to save messages to session", {
				sessionId,
				error: (error as Error).message,
			});
		}

		try {
			await this.deps.sessionService.saveWorkingContext(sessionId, workingContext);
			logger.info("Saved working context", {
				sessionId,
				entityCount: workingContext.size(),
			});
		} catch (error) {
			logger.error("Failed to save working context", {
				sessionId,
				error: (error as Error).message,
			});
		}
	}
}
