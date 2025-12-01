/**
 * Agent Orchestrator - Native AI SDK v6 Pattern
 * 
 * Based on v0 recursive agent pattern:
 * - Single ToolLoopAgent
 * - Think → Act → Observe → Repeat loop
 * - Automatic prompt chaining
 * - Retry logic with exponential backoff
 * - Error recovery at tool and agent levels
 * - All tools available always
 */

import { ToolLoopAgent, stepCountIs, streamText, APICallError, type CoreMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ALL_TOOLS } from "../tools/all-tools";
import Handlebars from 'handlebars';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentContext } from "../tools/types";
import { EntityExtractor, WorkingContext } from "../services/working-memory";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
});

// Agent configuration
const AGENT_CONFIG = {
	maxSteps: 15, // Higher limit for complex multi-step tasks
	modelId: "openai/gpt-4o-mini",
	maxOutputTokens: 4096,
	retries: 3, // Max retry attempts
	baseDelay: 1000, // Base delay for exponential backoff (ms)
};

// Working memory: Store per session (in-memory for now)
const workingContexts = new Map<string, WorkingContext>();

function getWorkingContext(sessionId: string): WorkingContext {
	if (!workingContexts.has(sessionId)) {
		workingContexts.set(sessionId, new WorkingContext());
	}
	return workingContexts.get(sessionId)!;
}

/**
 * Load and compile system prompt
 */
function getSystemPrompt(context: {
	toolsList: string[];
	toolCount: number;
	sessionId: string;
	currentDate: string;
	workingMemory?: string;  // NEW: Working memory context string
}): string {
	const promptPath = path.join(__dirname, '../prompts/react.xml');
	const template = fs.readFileSync(promptPath, 'utf-8');

	// Compile with Handlebars
	const compiled = Handlebars.compile(template);
	return compiled({
		...context,
		toolsFormatted: context.toolsList.map((t) => `- ${t}`).join('\n'),
		workingMemory: context.workingMemory || '', // NEW: Inject working memory
	});
}

/**
 * Create ToolLoopAgent - All tools available
 */
export function createAgent(context: AgentContext, workingMemory?: string): any {
	const systemPrompt = getSystemPrompt({
		toolsList: Object.keys(ALL_TOOLS),
		toolCount: Object.keys(ALL_TOOLS).length,
		sessionId: context.sessionId,
		currentDate: new Date().toISOString().split("T")[0],
		workingMemory, // NEW: Inject working memory
	});

	context.logger.info("Creating agent", {
		toolCount: Object.keys(ALL_TOOLS).length,
		modelId: AGENT_CONFIG.modelId,
		maxSteps: AGENT_CONFIG.maxSteps,
		traceId: context.traceId,
	});

	// Create agent with ALL tools (no filtering!)
	return new ToolLoopAgent({
		model: openrouter.languageModel(AGENT_CONFIG.modelId),
		instructions: systemPrompt,
		tools: ALL_TOOLS, // All tools available always

		// Stop conditions: max steps OR final answer detected
		stopWhen: async ({ steps }) => {
			// Max steps reached
			if (steps.length >= AGENT_CONFIG.maxSteps) {
				context.logger.warn("Max steps reached", { steps: steps.length });
				return true;
			}

			// Check if last step contains final answer
			const lastStep = steps[steps.length - 1];
			const hasFinalAnswer = lastStep?.text?.includes("FINAL_ANSWER:") || false;

			if (hasFinalAnswer) {
				context.logger.info("Final answer detected", { steps: steps.length });
			}

			return hasFinalAnswer;
		},

		// prepareStep: Memory management + checkpointing
		prepareStep: async ({ stepNumber, steps, messages }: any) => {
			context.logger.info(`Step ${stepNumber} starting`, {
				totalSteps: steps.length,
				messageCount: messages.length,
			});

			// Auto-checkpoint every 3 steps
			if (stepNumber > 0 && stepNumber % 3 === 0) {
				try {
					await context.sessionService.saveMessages(context.sessionId, messages as any[]);
					context.logger.info("Checkpoint saved", {
						stepNumber,
						messageCount: messages.length,
						sessionId: context.sessionId,
					});
				} catch (error) {
					context.logger.error("Checkpoint save failed", {
						error: (error as Error).message,
						stepNumber,
					});
				}
			}

			// Trim history if too long (prevent token overflow)
			if (messages.length > 20) {
				context.logger.info("Trimming message history", {
					originalCount: messages.length,
					newCount: 11,
				});

				return {
					messages: [
						messages[0], // Keep system prompt
						...messages.slice(-10), // Keep last 10 messages
					],
				};
			}

			return {};
		},

		// onStepFinish: Progress tracking
		onStepFinish: async (result: any) => {
			const { toolCalls, toolResults, finishReason, usage } = result;

			context.logger.info("Step completed", {
				toolCallCount: toolCalls?.length || 0,
				resultCount: toolResults?.length || 0,
				finishReason,
				usage,
			});

			// Emit progress to frontend (if streaming)
			if (context.stream && toolCalls) {
				context.stream.write({
					type: "step-completed",
					toolsExecuted: toolCalls.map((tc: any) => tc.toolName),
					finishReason,
					timestamp: new Date().toISOString(),
				});
			}
		},
	});
}

/**
 * Execute agent with retry logic and exponential backoff
 * Following v0 pattern for error recovery
 */
export async function executeAgentWithRetry(
	userMessage: string,
	context: AgentContext,
	previousMessages: CoreMessage[] = []
): Promise<{
	text: string;
	steps: any[];
	usage: any;
	retries: number;
	response: { messages: CoreMessage[] };
}> {
	let retryCount = 0;
	let delay = AGENT_CONFIG.baseDelay;

	while (retryCount <= AGENT_CONFIG.retries) {
		try {
			context.logger.info(`Attempt ${retryCount + 1} - Executing agent`, {
				userMessage: userMessage.slice(0, 100),
				previousMessageCount: previousMessages.length,
				retryCount,
			});

			// Get working context for this session
			const workingContext = getWorkingContext(context.sessionId);
			
			// Create agent with working memory injected
			const agent = createAgent(context, workingContext.toContextString());

			// Build messages array (AI SDK v6 pattern)
			const messages: CoreMessage[] = [
				...previousMessages,
				{ role: "user", content: userMessage },
			];

			// Execute agent
			const result = await agent.generate({
				messages,
				experimental_context: context, // Inject context into ALL tools
			} as any);

			context.logger.info("Agent execution completed", {
				steps: result.steps.length,
				finishReason: result.finishReason,
				textLength: result.text.length,
				retries: retryCount,
			});

			return {
				text: result.text,
				steps: result.steps,
				usage: result.usage,
				retries: retryCount,
				response: {
					messages: result.response.messages,
				},
			};
		} catch (error) {
			retryCount++;

			// Handle API errors (following v0 pattern)
			if (APICallError.isInstance(error)) {
				context.logger.error(`API Error ${error.statusCode}: ${error.message}`, {
					statusCode: error.statusCode,
					retryCount,
				});

				// Don't retry on client errors (4xx except 429 rate limits)
				if (
					error.statusCode &&
					error.statusCode >= 400 &&
					error.statusCode < 500 &&
					error.statusCode !== 429
				) {
					throw new Error(`Non-recoverable API error: ${error.message}`);
				}
			} else {
				context.logger.error(`Agent error: ${(error as Error).message}`, {
					retryCount,
					error: (error as Error).stack,
				});
			}

			// If we've exhausted retries, throw the error
			if (retryCount > AGENT_CONFIG.retries) {
				throw new Error(
					`Agent failed after ${AGENT_CONFIG.retries} retries: ${(error as Error).message}`
				);
			}

			// Exponential backoff with jitter (v0 pattern)
			const jitter = Math.random() * 500;
			const waitTime = Math.min(delay * 2 ** retryCount, 10000) + jitter;

			context.logger.info(`Retry ${retryCount}/${AGENT_CONFIG.retries}`, {
				waitTime: Math.round(waitTime),
				reason: (error as Error).message,
			});

			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}
	}

	throw new Error("Unexpected error: retry loop exited without result");
}

/**
 * Stream agent execution with approval handling + retry logic
 * Following v0 pattern for streaming with error recovery
 */
export async function streamAgentWithApproval(
	userMessage: string,
	context: AgentContext,
	previousMessages: CoreMessage[] = [],
	onApprovalRequest?: (request: any) => Promise<{ approved: boolean; reason?: string }>
) {
	let retryCount = 0;
	let delay = AGENT_CONFIG.baseDelay;

	while (retryCount <= AGENT_CONFIG.retries) {
		try {
			context.logger.info(`Attempt ${retryCount + 1} - Streaming agent with approval`, {
				userMessage: userMessage.slice(0, 100),
				previousMessageCount: previousMessages.length,
				retryCount,
			});

			// Build messages array
			const messages: CoreMessage[] = [
				...previousMessages,
				{ role: "user", content: userMessage },
			];

			// Check if last assistant message was asking for confirmation
			// If so, inject system message to remind agent what it's confirming
			const lastAssistantMsg = previousMessages.filter(m => m.role === 'assistant').pop();
			if (lastAssistantMsg && typeof lastAssistantMsg.content === 'string') {
				const content = lastAssistantMsg.content;
				// Detect if agent is waiting for confirmation
				if (
					content.includes('requires confirmation') || 
					content.includes('Please confirm') ||
					content.includes('⚠️')
				) {
					// Extract what's being confirmed (simple heuristic)
					const match = content.match(/delete (\d+) sections?|deleting (.*?) from/i);
					if (match) {
						messages.push({
							role: 'system',
							content: `[CONTEXT] You are waiting for user confirmation. The user's next message is likely a yes/no response. Remember: you asked to confirm deletion. Recognize "yes"/"y"/"ok"/"proceed" as approval (even with typos like "zes"). Proceed with the confirmed deletion if approved.`
						});
						
						context.logger.info('Injected confirmation context system message', {
							previousRequest: match[0]
						});
					}
				}
			}

			// Get working context for this session
			const workingContext = getWorkingContext(context.sessionId);
			const extractor = new EntityExtractor();
			
			// Get system prompt with working memory injected
			const systemPrompt = getSystemPrompt({
				toolsList: Object.keys(ALL_TOOLS),
				toolCount: Object.keys(ALL_TOOLS).length,
				sessionId: context.sessionId,
				currentDate: new Date().toISOString().split("T")[0],
				workingMemory: workingContext.toContextString(), // NEW: Inject working memory
			});

			// Emit system prompt for debugging
			if (context.stream) {
				context.stream.write({
					type: "system-prompt",
					prompt: systemPrompt,
					promptLength: systemPrompt.length,
					workingMemory: workingContext.toContextString(),
					timestamp: new Date().toISOString(),
				});
			}

			// Use streamText directly (more reliable than ToolLoopAgent.stream())
			const streamResult = streamText({
				model: openrouter.languageModel(AGENT_CONFIG.modelId),
				system: systemPrompt,
				messages,
				tools: ALL_TOOLS, // All tools available
				maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
				stopWhen: stepCountIs(AGENT_CONFIG.maxSteps), // Allow multi-step execution
				experimental_context: context,
			});

			// Collect results
			const steps: any[] = [];
			const toolCalls: any[] = [];
			const toolResults: any[] = [];
			let finalText = "";
			let finishReason = "unknown";
			let usage: any = {};

			// Process stream chunks with approval handling
			for await (const chunk of streamResult.fullStream) {
				switch (chunk.type) {
					case "text-delta":
						finalText += chunk.text;
						if (context.stream) {
							context.stream.write({
								type: "text-delta",
								delta: chunk.text,
								timestamp: new Date().toISOString(),
							});
						}
						break;

					case "tool-call":
						context.logger.info("Tool called", {
							toolName: chunk.toolName,
							toolCallId: chunk.toolCallId,
						});

						toolCalls.push({
							toolName: chunk.toolName,
							toolCallId: chunk.toolCallId,
							args: chunk.input,
						});

						if (context.stream) {
							context.stream.write({
								type: "tool-call",
								toolName: chunk.toolName,
								toolCallId: chunk.toolCallId,
								args: chunk.input,
								timestamp: new Date().toISOString(),
							});
						}
						break;

					case "tool-result":
						context.logger.info("Tool result received", {
							toolCallId: chunk.toolCallId,
							toolName: chunk.toolName,
						});

						toolResults.push({
							toolCallId: chunk.toolCallId,
							toolName: chunk.toolName,
							result: chunk.output,
						});

						// NEW: Extract entities from tool result
						const entities = extractor.extract(chunk.toolName, chunk.output);
						if (entities.length > 0) {
							workingContext.addMany(entities);
							
							context.logger.info('Extracted entities to working memory', {
								toolName: chunk.toolName,
								entityCount: entities.length,
								entities: entities.map(e => `${e.type}:${e.name}`),
								workingMemorySize: workingContext.size()
							});
						}

						if (context.stream) {
							context.stream.write({
								type: "tool-result",
								toolCallId: chunk.toolCallId,
								result: chunk.output,
								timestamp: new Date().toISOString(),
							});
						}
						break;

					case "tool-approval-request":
						context.logger.info("Tool approval requested", {
							approvalId: chunk.approvalId,
							toolName: chunk.toolCall.toolName,
						});

						if (context.stream) {
							context.stream.write({
								type: "approval-required",
								approvalId: chunk.approvalId,
								toolName: chunk.toolCall.toolName,
								input: chunk.toolCall.input,
								description: `Approve execution of ${chunk.toolCall.toolName}?`,
								timestamp: new Date().toISOString(),
							});
						}

						// Wait for approval response from user
						let approved = false;
						let reason: string | undefined = "No approval handler provided";

						if (onApprovalRequest) {
							try {
								const response = await onApprovalRequest({
									approvalId: chunk.approvalId,
									toolName: chunk.toolCall.toolName,
									input: chunk.toolCall.input,
								});
								approved = response.approved;
								reason = response.reason || undefined;
							} catch (error) {
								context.logger.error("Approval request failed", { error });
								approved = false;
								reason = "Approval request failed";
							}
						}

						context.logger.info("Approval response received", {
							approvalId: chunk.approvalId,
							approved,
							reason,
						});

						// For server-side streaming: if rejected, we need to inject an error result
						// If approved, the tool will execute automatically in the next iteration
						// This is how AI SDK v6 beta handles server-side approvals
						if (!approved) {
							context.logger.warn("Tool execution rejected by user", {
								toolName: chunk.toolCall.toolName,
								reason,
							});
							
							// The stream will handle rejection automatically
							// Tool won't execute, and agent will see it was rejected
						} else {
							context.logger.info("Tool execution approved by user", {
								toolName: chunk.toolCall.toolName,
							});
						}
						break;

					case "finish":
						finishReason = chunk.finishReason;
						usage = chunk.totalUsage;

						context.logger.info("Stream finished", {
							finishReason,
							usage,
							toolCalls: toolCalls.length,
							retries: retryCount,
						});

						// Only send completion event at the very end
						if (context.stream) {
							context.stream.write({
								type: "finish",
								finishReason,
								usage,
								toolCallsCount: toolCalls.length,
								timestamp: new Date().toISOString(),
							});
						}
						break;

					case "error":
						context.logger.error("Stream error", { error: chunk.error });
						throw chunk.error;

					case "tool-error":
						context.logger.error(`Tool ${chunk.toolName} failed`, {
							error: chunk.error,
						});
						// Send tool-error event to client so it can update the tool-call entry
						if (context.stream) {
							context.stream.write({
								type: "tool-error",
								toolCallId: chunk.toolCallId,
								toolName: chunk.toolName,
								error: chunk.error instanceof Error ? chunk.error.message : String(chunk.error),
								timestamp: new Date().toISOString(),
							});
						}
						// Tool errors don't stop the stream - agent can recover
						break;

					// Ignore other chunk types (tool-input-start, tool-input-delta, step-start, etc.)
					// These are internal to the AI SDK and don't need explicit handling
					default:
						// Silently ignore unknown chunk types
						break;
				}
			}

			// Get response messages
			const responseData = await streamResult.response;

			return {
				text: finalText,
				finishReason,
				usage,
				steps,
				toolCalls,
				toolResults,
				retries: retryCount,
				response: {
					messages: responseData.messages,
				},
			};
		} catch (error) {
			retryCount++;

			// Handle API errors (following v0 pattern)
			if (APICallError.isInstance(error)) {
				context.logger.error(`API Error ${error.statusCode}: ${error.message}`, {
					statusCode: error.statusCode,
					retryCount,
				});

				// Don't retry on client errors (except rate limits)
				if (
					error.statusCode &&
					error.statusCode >= 400 &&
					error.statusCode < 500 &&
					error.statusCode !== 429
				) {
					throw new Error(`Non-recoverable API error: ${error.message}`);
				}
			} else {
				context.logger.error(`Stream error: ${(error as Error).message}`, {
					retryCount,
					error: (error as Error).stack,
				});
			}

			// If we've exhausted retries, throw the error
			if (retryCount > AGENT_CONFIG.retries) {
				throw new Error(
					`Agent failed after ${AGENT_CONFIG.retries} retries: ${(error as Error).message}`
				);
			}

			// Exponential backoff with jitter
			const jitter = Math.random() * 500;
			const waitTime = Math.min(delay * 2 ** retryCount, 10000) + jitter;

			context.logger.info(`Retry ${retryCount}/${AGENT_CONFIG.retries}`, {
				waitTime: Math.round(waitTime),
				reason: (error as Error).message,
			});

			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}
	}

	throw new Error("Unexpected error: retry loop exited without result");
}
