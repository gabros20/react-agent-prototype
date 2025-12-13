/**
 * Agent Routes - Thin Controllers
 *
 * Delegates all business logic to AgentOrchestrator.
 * Each endpoint ~20-30 lines focusing only on:
 * - Request parsing
 * - Response setup (SSE headers)
 * - Orchestrator delegation
 * - Error handling
 */

import express from "express";
import { z } from "zod";
import type { Services } from "../services/types";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";

// Request schema
const agentRequestSchema = z.object({
	sessionId: z.string().uuid().optional(),
	prompt: z.string().min(1),
	modelId: z.string().optional(),
	toolsEnabled: z.array(z.string()).optional(), // Reserved for future use
	cmsTarget: z
		.object({
			siteId: z.string().optional(),
			environmentId: z.string().optional(),
		})
		.optional(),
});

export function createAgentRoutes(services: Services) {
	const router = express.Router();

	// POST /v1/agent/stream - Streaming agent execution
	router.post("/stream", async (req, res) => {
		// Track if client is still connected
		let clientDisconnected = false;

		// Handle client disconnect - stop processing
		res.on("close", () => {
			clientDisconnected = true;
			services.logger.info("Client disconnected from SSE stream");
		});

		try {
			const input = agentRequestSchema.parse(req.body);

			// Setup SSE headers
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");

			// Guarded SSE write - checks if client still connected
			const writeSSE = (event: string, data: unknown) => {
				if (clientDisconnected || res.writableEnded) {
					return; // Client gone, skip write
				}
				try {
					res.write(`event: ${event}\n`);
					res.write(`data: ${JSON.stringify(data)}\n\n`);
				} catch (writeError) {
					// Write failed (client disconnected or buffer full)
					services.logger.warn("SSE write failed", {
						event,
						error: writeError instanceof Error ? writeError.message : String(writeError),
					});
					clientDisconnected = true;
				}
			};

			// Delegate to orchestrator - consume generator to trigger stream processing
			for await (const _ of services.agentOrchestrator.executeStream(
				{
					prompt: input.prompt,
					sessionId: input.sessionId,
					modelId: input.modelId,
					cmsTarget: input.cmsTarget,
				},
				writeSSE
			)) {
				// Check for client disconnect between iterations
				if (clientDisconnected) {
					services.logger.info("Stopping stream processing - client disconnected");
					break;
				}
			}

			if (!res.writableEnded) {
				res.end();
			}
		} catch (error) {
			services.logger.error("Agent stream route error", { error: error instanceof Error ? error.message : String(error) });

			// If SSE headers already sent, emit error event instead of JSON
			if (res.headersSent) {
				if (!res.writableEnded && !clientDisconnected) {
					try {
						res.write(`event: error\n`);
						res.write(`data: ${JSON.stringify({ message: error instanceof Error ? error.message : "Unknown error" })}\n\n`);
						res.end();
					} catch {
						// Ignore write errors during error handling
					}
				}
			} else {
				res.status(HttpStatus.BAD_REQUEST).json(
					ApiResponse.error(ErrorCodes.VALIDATION_ERROR, error instanceof Error ? error.message : "Unknown error")
				);
			}
		}
	});

	// POST /v1/agent/generate - Non-streaming agent execution
	router.post("/generate", async (req, res) => {
		try {
			const input = agentRequestSchema.parse(req.body);

			const result = await services.agentOrchestrator.executeGenerate({
				prompt: input.prompt,
				sessionId: input.sessionId,
				modelId: input.modelId,
				cmsTarget: input.cmsTarget,
			});

			res.json(ApiResponse.success(result));
		} catch (error) {
			services.logger.error("Agent generate route error", { error: error instanceof Error ? error.message : String(error) });
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
				ApiResponse.error(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : "Unknown error")
			);
		}
	});

	return router;
}
