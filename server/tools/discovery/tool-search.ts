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
	description: `Discover tools by capability keywords. Returns tools + rules for using them.

Search multiple capabilities at once for efficiency:
- "web search pexels create post" -> gets web, image, and post tools
- "list pages update section" -> gets page listing and editing tools

Use higher limit (8-10) for complex multi-capability searches.`,

	inputSchema: z.object({
		query: z.string().describe("Capability keywords (e.g. 'web search pexels create post')"),
		limit: z.number().optional().default(8).describe("Max tools to return (default: 8)"),
	}),

	// AI SDK 6: outputSchema validates results and enables type inference
	outputSchema: ToolSearchOutputSchema,

	execute: async ({ query, limit = 8 }): Promise<ToolSearchOutput> => {
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

		// Build instruction - tools are now available, rules explain how to use them
		const toolNames = tools.map((t) => t.name).join(", ");
		const instruction = `Tools unlocked: ${toolNames}. Read the rules above, then use these tools to complete the task.`;

		return {
			tools,
			rules,
			instruction,
		};
	},
});
