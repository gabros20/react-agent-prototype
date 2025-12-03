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
import type { ServiceContainer } from "../services/service-container";
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

export function createAgentRoutes(services: ServiceContainer) {
	const router = express.Router();

	// POST /v1/agent/stream - Streaming agent execution
	router.post("/stream", async (req, res) => {
		try {
			const input = agentRequestSchema.parse(req.body);

			// Setup SSE headers
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");

			const writeSSE = (event: string, data: unknown) => {
				res.write(`event: ${event}\n`);
				res.write(`data: ${JSON.stringify(data)}\n\n`);
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
				// Generator yields void, all events sent via writeSSE callback
			}

			res.end();
		} catch (error) {
			console.error("Route error:", error);
			res.status(HttpStatus.BAD_REQUEST).json(
				ApiResponse.error(
					ErrorCodes.VALIDATION_ERROR,
					error instanceof Error ? error.message : "Unknown error"
				)
			);
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
