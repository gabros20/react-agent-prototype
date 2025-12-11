/**
 * Tool Discovery API Routes
 *
 * REST API for tool discovery and search.
 * Exposes the ToolSearchService via HTTP endpoints.
 */

import { Router } from "express";
import type { ServiceContainer } from "../services/service-container";

export function createToolRoutes(services: ServiceContainer) {
	const router = Router();

	/**
	 * POST /v1/tools/search
	 * Search for tools by query (hybrid BM25 + vector)
	 *
	 * Body:
	 * - query: string (required) - Search query
	 * - limit: number (optional, default: 8) - Max results
	 * - expandRelated: boolean (optional, default: true) - Include related tools
	 * - forceVector: boolean (optional, default: false) - Force vector search
	 */
	router.post("/search", async (req, res) => {
		const {
			query,
			limit = 8,
			expandRelated = true,
			forceVector = false,
		} = req.body;

		if (!query || typeof query !== "string") {
			return res.status(400).json({ error: "query is required" });
		}

		try {
			const result = await services.toolSearch.search(query, limit, {
				expandRelated,
				forceVector,
			});

			res.json(result);
		} catch (error: any) {
			console.error("[tools/search] Error:", error);
			res.status(500).json({ error: error.message });
		}
	});

	/**
	 * GET /v1/tools
	 * List all available tools
	 */
	router.get("/", async (_req, res) => {
		try {
			const tools = services.toolSearch.listTools();
			res.json({ tools, count: tools.length });
		} catch (error: any) {
			console.error("[tools] Error:", error);
			res.status(500).json({ error: error.message });
		}
	});

	/**
	 * GET /v1/tools/names
	 * List all tool names (lightweight)
	 */
	router.get("/names", async (_req, res) => {
		try {
			const names = services.toolSearch.listToolNames();
			res.json({ names, count: names.length });
		} catch (error: any) {
			console.error("[tools/names] Error:", error);
			res.status(500).json({ error: error.message });
		}
	});

	/**
	 * GET /v1/tools/status
	 * Get tool search service status
	 */
	router.get("/status", async (_req, res) => {
		try {
			const status = services.toolSearch.getStatus();
			res.json(status);
		} catch (error: any) {
			console.error("[tools/status] Error:", error);
			res.status(500).json({ error: error.message });
		}
	});

	/**
	 * GET /v1/tools/:name
	 * Get tool metadata by name
	 */
	router.get("/:name", async (req, res) => {
		try {
			const tool = services.toolSearch.getTool(req.params.name);

			if (!tool) {
				return res
					.status(404)
					.json({ error: `Tool not found: ${req.params.name}` });
			}

			res.json(tool);
		} catch (error: any) {
			console.error("[tools/:name] Error:", error);
			res.status(500).json({ error: error.message });
		}
	});

	/**
	 * GET /v1/tools/:name/related
	 * Get related tools for a given tool
	 */
	router.get("/:name/related", async (req, res) => {
		try {
			const tool = services.toolSearch.getTool(req.params.name);

			if (!tool) {
				return res
					.status(404)
					.json({ error: `Tool not found: ${req.params.name}` });
			}

			const relatedTools = services.toolSearch.getRelatedTools(req.params.name);
			res.json({ tool: req.params.name, relatedTools });
		} catch (error: any) {
			console.error("[tools/:name/related] Error:", error);
			res.status(500).json({ error: error.message });
		}
	});

	return router;
}
