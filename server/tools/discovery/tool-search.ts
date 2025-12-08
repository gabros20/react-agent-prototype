/**
 * The tool_search Discovery Tool
 *
 * Single discovery tool that enables dynamic tool injection.
 * Agent starts with ONLY this tool. Calling it discovers relevant tools
 * which become available via AI SDK 6's activeTools in prepareStep.
 *
 * Per-Tool Instruction Architecture:
 * - Returns just tool names (lightweight)
 * - Protocols injected via prepareStep into <active-protocols> section
 * - No domain rules bundling - per-tool granularity
 */

import { tool } from "ai";
import { z } from "zod";
import { smartToolSearchWithConfidence } from "./smart-search";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
	// Minimum confidence to accept results
	MIN_CONFIDENCE: 0.2,
} as const;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Simplified output schema - just tool names.
 * Protocols are injected via prepareStep, not returned here.
 */
const ToolSearchOutputSchema = z.object({
	tools: z.array(z.string()),
	message: z.string(),
});

export type ToolSearchOutput = z.infer<typeof ToolSearchOutputSchema>;

// ============================================================================
// Discovery Tool
// ============================================================================

export const toolSearchTool = tool({
	description: `Discover tools by ACTION keywords (verbs). Tools become active immediately.

IMPORTANT: Include ALL actions needed for your task (6-8 keywords recommended).
Common actions: create, list, get, update, delete, search, download, publish, archive

Examples:
- "create post publish" → cms_createPost + cms_publishPost
- "create post pexels search download" → post + pexels tools
- "web search research fetch" → all web research tools
- "page create section add update image" → full page building toolkit`,

	inputSchema: z.object({
		query: z.string().describe("6-8 ACTION keywords covering all task needs (e.g. 'create post publish pexels search download')"),
		limit: z.number().optional().default(8).describe("Max tools (default: 8)"),
	}),

	outputSchema: ToolSearchOutputSchema,

	execute: async ({ query, limit = 8 }): Promise<ToolSearchOutput> => {
		console.log(`[tool_search] Query: "${query}", limit: ${limit}`);

		// Run hybrid search with related tools expansion
		// This ensures related tools (e.g. cms_publishPost with cms_createPost) are included
		const {
			tools: searchResults,
			confidence,
			source,
		} = await smartToolSearchWithConfidence(
			query,
			limit,
			{ expandRelated: true }
		);

		console.log(`[tool_search] Search: confidence=${confidence.toFixed(2)}, source=${source}`);

		// Handle empty or low-confidence results
		if (searchResults.length === 0 || confidence < CONFIG.MIN_CONFIDENCE) {
			console.log(`[tool_search] No good matches for "${query}" (confidence: ${confidence.toFixed(2)})`);
			return {
				tools: [],
				message: `No tools found for "${query}". Try: "create post", "list pages", "pexels photos", "update section".`,
			};
		}

		// Return all results up to limit - multi-action tasks need multiple tools
		const tools = searchResults.slice(0, limit).map((t) => t.name);
		console.log(`[tool_search] Found ${tools.length} tools: [${tools.join(", ")}]`);

		return {
			tools,
			message: `Found ${tools.length} tools. They are now active. Check <active-protocols> for usage instructions.`,
		};
	},
});
