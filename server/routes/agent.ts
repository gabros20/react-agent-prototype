/**
 * Agent Routes - AI SDK v6 Native Pattern
 *
 * Migrated to use:
 * - Centralized cmsAgent with ToolLoopAgent
 * - Native retry handling (SDK default maxRetries: 2)
 * - Native streaming via ToolLoopAgent.stream()
 * - Working memory via prepareCall context injection
 * - Confirmed flag pattern for destructive operations (conversational approval)
 */

import express from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { CoreMessage } from "ai";
import { cmsAgent, AGENT_CONFIG, type AgentCallOptions } from "../agent/cms-agent";
import { getSystemPrompt } from "../agent/system-prompt";
import { EntityExtractor, WorkingContext } from "../services/working-memory";
import type { ServiceContainer } from "../services/service-container";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";
import { getSiteAndEnv } from "../utils/get-context";
import { getModelPricing } from "../services/openrouter-pricing";
import { countTokens, countChatTokens } from "../../lib/tokenizer";

// Request schema
const agentRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  prompt: z.string().min(1),
  toolsEnabled: z.array(z.string()).optional(), // Optional: for future use
  cmsTarget: z
    .object({
      siteId: z.string().optional(),
      environmentId: z.string().optional()
    })
    .optional()
})

// Working memory: Store per session (in-memory for now)
const workingContexts = new Map<string, WorkingContext>();

function getWorkingContext(sessionId: string): WorkingContext {
	if (!workingContexts.has(sessionId)) {
		workingContexts.set(sessionId, new WorkingContext());
	}
	return workingContexts.get(sessionId)!;
}

export function createAgentRoutes(services: ServiceContainer) {
	const router = express.Router();

	// POST /v1/agent/stream - Streaming agent with native AI SDK v6
	router.post("/stream", async (req, res) => {
		try {
			const input = agentRequestSchema.parse(req.body);

			// Generate trace ID
			const traceId = randomUUID();
			const sessionId = input.sessionId || randomUUID();

			// Ensure session exists in DB before agent execution
			// (Tools like pexels_downloadPhoto need to link to session via FK)
			await services.sessionService.ensureSession(sessionId);

			// Setup SSE headers
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");

			// SSE helper
			const writeSSE = (event: string, data: any) => {
				res.write(`event: ${event}\n`);
				res.write(`data: ${JSON.stringify(data)}\n\n`);
			};

			// Create logger that writes to SSE
			const logger = {
				info: (msg: string | object, meta?: any) => {
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
				warn: (msg: string | object, meta?: any) => {
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
				error: (msg: string | object, meta?: any) => {
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

			// Get actual site and environment IDs from database
			let cmsTarget: { siteId: string; environmentId: string };
			try {
				// Use provided IDs if they look like UUIDs, otherwise lookup by name
				if (input.cmsTarget?.siteId && input.cmsTarget.siteId.includes("-")) {
					// Looks like UUID - use directly
					cmsTarget = {
						siteId: input.cmsTarget.siteId,
						environmentId: input.cmsTarget.environmentId || "main",
					};
				} else {
					// Lookup by name (default: local-site/main)
					const siteName = input.cmsTarget?.siteId || "local-site";
					const envName = input.cmsTarget?.environmentId || "main";
					cmsTarget = await getSiteAndEnv(services.db, siteName, envName);
				}
			} catch (error) {
				logger.warn("Could not resolve CMS target, using fallback lookup", {
					error: (error as Error).message,
				});
				// Fallback: try to get first available site/env
				const site = await services.db.query.sites.findFirst();
				const env = await services.db.query.environments.findFirst();
				if (!site || !env) {
					throw new Error("No site/environment configured. Run seed script first.");
				}
				cmsTarget = { siteId: site.id, environmentId: env.id };
			}

			// Get working context for this session
			const workingContext = getWorkingContext(sessionId);
			const extractor = new EntityExtractor();

			// Build agent call options (type-safe via callOptionsSchema)
			const agentOptions: AgentCallOptions = {
				sessionId,
				traceId,
				workingMemory: workingContext.toContextString(),
				cmsTarget,
				db: services.db,
				services,
				sessionService: services.sessionService,
				vectorIndex: services.vectorIndex,
				logger,
				stream: {
					write: (event: any) => {
						const eventType = event.type || "step";
						writeSSE(eventType, event);
					},
				},
			};

			logger.info("Starting agent execution", {
				traceId,
				sessionId,
				prompt: input.prompt.slice(0, 100),
			});

			// Generate and emit system prompt for debugging
			const systemPrompt = getSystemPrompt({
				currentDate: new Date().toISOString().split("T")[0],
				workingMemory: workingContext.toContextString(),
			});

			// Calculate system prompt tokens server-side (source of truth)
			const systemPromptTokens = countTokens(systemPrompt);
			const workingMemoryStr = workingContext.toContextString();
			const workingMemoryTokens = workingMemoryStr ? countTokens(workingMemoryStr) : 0;

			writeSSE("system-prompt", {
				type: "system-prompt",
				prompt: systemPrompt,
				promptLength: systemPrompt.length,
				tokens: systemPromptTokens,
				workingMemory: workingMemoryStr,
				workingMemoryTokens,
				timestamp: new Date().toISOString(),
			});

			// Emit model and pricing info for cost calculation
			const modelPricing = await getModelPricing(AGENT_CONFIG.modelId);
			writeSSE("model-info", {
				type: "model-info",
				modelId: AGENT_CONFIG.modelId,
				pricing: modelPricing,
				timestamp: new Date().toISOString(),
			});

			try {
				// Load previous messages from session
				let previousMessages: CoreMessage[] = [];
				if (input.sessionId) {
					try {
						previousMessages = await services.sessionService.loadMessages(input.sessionId);

						logger.info("Loaded session history", {
							sessionId: input.sessionId,
							messageCount: previousMessages.length,
						});
					} catch (error) {
						logger.warn("Could not load session history", {
							sessionId: input.sessionId,
							error: (error as Error).message,
						});
					}
				}

				// Build messages array
				const messages: CoreMessage[] = [
					...previousMessages,
					{ role: "user", content: input.prompt },
				];

				// Emit user prompt with token count
				const userPromptTokens = countTokens(input.prompt);
				const messageHistoryTokens = previousMessages.length > 0
					? countChatTokens(previousMessages.map(m => ({
						role: m.role,
						content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
					})))
					: 0;

				writeSSE("user-prompt", {
					type: "user-prompt",
					prompt: input.prompt,
					tokens: userPromptTokens,
					messageHistoryTokens,
					messageCount: previousMessages.length,
					timestamp: new Date().toISOString(),
				});

				// Stream using cmsAgent (SDK handles retry internally with default maxRetries: 2)
				const streamResult = await cmsAgent.stream({
					messages,
					options: agentOptions,
				});

				// Process stream and collect results
				const toolCalls: any[] = [];
				const toolResults: any[] = [];
				let finalText = "";
				let finishReason = "unknown";
				let usage: any = {};
				let currentStep = 0;
				let stepStartTime = Date.now();

				// Process stream chunks
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

							// Extract entities from tool result to working memory
							const entities = extractor.extract(chunk.toolName, chunk.output);
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
							usage = chunk.totalUsage;

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
							writeSSE("step-start", {
								type: "step-start",
								stepNumber: currentStep,
								timestamp: new Date().toISOString(),
							});
							break;

						case "finish-step":
							const stepDuration = Date.now() - stepStartTime;
							const stepUsage = (chunk as any).usage;
							writeSSE("step-finish", {
								type: "step-finish",
								stepNumber: currentStep,
								duration: stepDuration,
								finishReason: (chunk as any).finishReason,
								usage: stepUsage ? {
									promptTokens: stepUsage.promptTokens || 0,
									completionTokens: stepUsage.completionTokens || 0,
								} : undefined,
								timestamp: new Date().toISOString(),
							});
							break;

						// AI SDK internal streaming events - silently ignore
						default:
							// Silently ignore: tool-input-start, tool-input-delta, reasoning, etc.
							break;
					}
				}

				// Get response messages
				const responseData = await streamResult.response;

				logger.info("Agent execution completed", {
					traceId,
					toolCallsCount: toolCalls.length,
					finishReason,
				});

				// Save conversation to session
				if (sessionId) {
					try {
						const updatedMessages: CoreMessage[] = [
							...previousMessages,
							{ role: "user", content: input.prompt },
							...responseData.messages,
						];

						await services.sessionService.saveMessages(sessionId, updatedMessages);

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
				}

				// Send final result
				writeSSE("result", {
					traceId,
					sessionId,
					text: finalText,
					toolCalls,
					toolResults,
					finishReason,
					usage,
				});

				// Close connection
				writeSSE("done", { traceId, sessionId });
				res.end();
			} catch (error) {
				logger.error("Agent execution error", {
					traceId,
					error: (error as Error).message,
					stack: (error as Error).stack,
				});

				writeSSE("error", {
					traceId,
					error: (error as Error).message,
				});

				res.end();
			}
		} catch (error) {
			console.error("Route error:", error);
			res.status(HttpStatus.BAD_REQUEST).json(
				ApiResponse.error(
					ErrorCodes.VALIDATION_ERROR,
					error instanceof Error ? error.message : "Unknown error"
				)
			);
		}
	})

	// POST /v1/agent/generate - Non-streaming agent with native AI SDK v6
	router.post("/generate", async (req, res) => {
		try {
			const input = agentRequestSchema.parse(req.body);

			const traceId = randomUUID();
			const sessionId = input.sessionId || randomUUID();

			// Ensure session exists in DB before agent execution
			await services.sessionService.ensureSession(sessionId);

			// Simple console logger for non-streaming
			const logger = {
				info: (msg: string | object, meta?: any) => {
					console.log("[INFO]", typeof msg === "string" ? msg : JSON.stringify(msg), meta);
				},
				warn: (msg: string | object, meta?: any) => {
					console.warn("[WARN]", typeof msg === "string" ? msg : JSON.stringify(msg), meta);
				},
				error: (msg: string | object, meta?: any) => {
					console.error("[ERROR]", typeof msg === "string" ? msg : JSON.stringify(msg), meta);
				},
			};

			// Get actual site and environment IDs from database
			let cmsTarget: { siteId: string; environmentId: string };
			try {
				// Use provided IDs if they look like UUIDs, otherwise lookup by name
				if (input.cmsTarget?.siteId && input.cmsTarget.siteId.includes("-")) {
					cmsTarget = {
						siteId: input.cmsTarget.siteId,
						environmentId: input.cmsTarget.environmentId || "main",
					};
				} else {
					const siteName = input.cmsTarget?.siteId || "local-site";
					const envName = input.cmsTarget?.environmentId || "main";
					cmsTarget = await getSiteAndEnv(services.db, siteName, envName);
				}
			} catch (error) {
				logger.warn("Could not resolve CMS target, using fallback lookup", {
					error: (error as Error).message,
				});
				const site = await services.db.query.sites.findFirst();
				const env = await services.db.query.environments.findFirst();
				if (!site || !env) {
					throw new Error("No site/environment configured. Run seed script first.");
				}
				cmsTarget = { siteId: site.id, environmentId: env.id };
			}

			// Get working context for this session
			const workingContext = getWorkingContext(sessionId);

			// Build agent call options
			const agentOptions: AgentCallOptions = {
				sessionId,
				traceId,
				workingMemory: workingContext.toContextString(),
				cmsTarget,
				db: services.db,
				services,
				sessionService: services.sessionService,
				vectorIndex: services.vectorIndex,
				logger,
			};

			logger.info("Starting agent execution (non-streaming)", {
				traceId,
				sessionId,
				prompt: input.prompt.slice(0, 100),
			});

			// Generate system prompt for debugging (logged to console in non-streaming mode)
			const systemPrompt = getSystemPrompt({
				currentDate: new Date().toISOString().split("T")[0],
				workingMemory: workingContext.toContextString(),
			});
			logger.info("System prompt generated", {
				promptLength: systemPrompt.length,
			});

			// Load previous messages
			let previousMessages: CoreMessage[] = [];
			if (input.sessionId) {
				try {
					previousMessages = await services.sessionService.loadMessages(input.sessionId);
				} catch (error) {
					logger.warn("Could not load session history", {
						sessionId: input.sessionId,
						error: (error as Error).message,
					});
				}
			}

			// Build messages array
			const messages: CoreMessage[] = [
				...previousMessages,
				{ role: "user", content: input.prompt },
			];

			// Execute using cmsAgent (SDK handles retry internally with default maxRetries: 2)
			const result = await cmsAgent.generate({
				messages,
				options: agentOptions,
			});

			logger.info("Agent execution completed", {
				traceId,
				stepsCount: result.steps?.length || 0,
			});

			// Save to session
			if (sessionId) {
				try {
					const updatedMessages: CoreMessage[] = [
						...previousMessages,
						{ role: "user", content: input.prompt },
						...result.response.messages,
					];

					await services.sessionService.saveMessages(sessionId, updatedMessages);
				} catch (error) {
					logger.error("Failed to save messages", {
						error: (error as Error).message,
					});
				}
			}

			// Return result
			res.json(
				ApiResponse.success({
					traceId,
					sessionId,
					text: result.text,
					steps: result.steps,
					usage: result.usage,
				})
			);
		} catch (error) {
			console.error("Route error:", error);
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
				ApiResponse.error(
					ErrorCodes.INTERNAL_ERROR,
					error instanceof Error ? error.message : "Unknown error"
				)
			);
		}
	});

	return router;
}
