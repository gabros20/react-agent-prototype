/**
 * The tool_search Discovery Tool
 *
 * Single discovery tool that enables dynamic tool injection.
 * Agent starts with ONLY this tool. Calling it discovers relevant tools
 * which become available via AI SDK 6's activeTools in prepareStep.
 *
 * Implements Phase 5 from DYNAMIC_TOOL_INJECTION_PLAN.md
 */

import { tool } from "ai";
import { z } from "zod";
import { smartToolSearchWithConfidence, expandWithRelatedTools, extractCategories, isContentQuery } from "./smart-search";
import { getRules } from "./rules";
import { TOOL_INDEX } from "./tool-index";

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
 * Type-safe output schema for tool_search results.
 * AI SDK 6 validates results against this schema.
 */
const ToolSearchOutputSchema = z.object({
	tools: z.array(
		z.object({
			name: z.string(),
			description: z.string(),
		})
	),
	rules: z.string(),
	instruction: z.string(),
});

export type ToolSearchOutput = z.infer<typeof ToolSearchOutputSchema>;

// ============================================================================
// Discovery Tool
// ============================================================================

export const toolSearchTool = tool({
	description: `UNLOCK DYNAMIC tools by describing what you need. After this returns, the tools appear in YOUR TOOL LIST - call them directly!

ONE search per capability. Do NOT repeat searches for the same thing.

Examples:
- "list pages" → unlocks cms_listPages → call it next
- "find image" → unlocks image tools → call them next
- "create page" → unlocks page tools → call them next`,

	inputSchema: z.object({
		query: z.string().describe("What do you need to do? Describe the capability needed."),
		limit: z.number().optional().default(5).describe("Max tools to return (default: 5)"),
	}),

	// AI SDK 6: outputSchema validates results and enables type inference
	outputSchema: ToolSearchOutputSchema,

	execute: async ({ query, limit = 5 }): Promise<ToolSearchOutput> => {
		console.log(`[tool_search] Query: "${query}", limit: ${limit}`);

		// 1. Run hybrid search with confidence (BM25 + vector fallback)
		const {
			tools: searchResults,
			confidence,
			source,
		} = await smartToolSearchWithConfidence(
			query,
			limit,
			{ expandRelated: false } // We'll expand manually for more control
		);

		console.log(`[tool_search] Search: confidence=${confidence.toFixed(2)}, source=${source}`);

		// 2. Handle empty or low-confidence results
		if (searchResults.length === 0 || confidence < CONFIG.MIN_CONFIDENCE) {
			console.log(`[tool_search] No good matches for "${query}" (confidence: ${confidence.toFixed(2)})`);
			return {
				tools: [],
				rules: "",
				instruction: `No tools found matching "${query}".

Try searching for CAPABILITIES (what you want to DO):
- "create post" → create blog posts
- "web search" → search the web for information
- "list pages" → see all CMS pages
- "find image" or "pexels photos" → find/download images
- "update section" → modify page content

If you can answer the user's question without CMS tools, respond directly.`,
			};
		}

		// 3. Expand with related tools for complete capability sets
		const expandedResults = expandWithRelatedTools(searchResults, limit);

		// 4. Extract categories and load relevant rules
		const categories = extractCategories(expandedResults);
		const rules = getRules(categories);

		// 5. Format tools for response
		const tools = expandedResults.map((t) => ({
			name: t.name,
			description: TOOL_INDEX[t.name]?.description || t.description,
		}));

		console.log(`[tool_search] Found ${tools.length} tools: [${tools.map((t) => t.name).join(", ")}]`);
		console.log(`[tool_search] Categories: [${categories.join(", ")}]`);

		// Build action-oriented instruction with the primary tool
		const primaryTool = tools[0]?.name || "the discovered tool";
		const instruction = `UNLOCKED. NOW CALL ${primaryTool}() to complete the task. Do NOT search again - these tools are ready to use.`;

		return {
			tools,
			rules,
			instruction,
		};
	},
});
