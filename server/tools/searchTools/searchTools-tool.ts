/**
 * searchTools Tool Implementation
 *
 * Single discovery tool that enables dynamic tool injection.
 * Agent starts with ONLY this tool. Calling it discovers relevant tools
 * which become available via AI SDK 6's activeTools in prepareStep.
 *
 * Per-Tool Instruction Architecture:
 * - Returns just tool names (lightweight)
 * - Protocols injected via prepareStep into <tool-usage-instructions> section
 * - No domain rules bundling - per-tool granularity
 */

import { z } from "zod";
import { smartToolSearchWithConfidence } from "../../services/tool-search";

// Configuration
const CONFIG = {
	MIN_CONFIDENCE: 0.2,
} as const;

// Output schema
export const outputSchema = z.object({
	tools: z.array(z.string()),
	message: z.string(),
});

export type SearchToolsOutput = z.infer<typeof outputSchema>;

// Input schema
export const schema = z.object({
	query: z
		.string()
		.describe(
			"6-8 ACTION keywords covering all task needs (e.g. 'create post publish pexels search download')"
		),
	limit: z.number().optional().default(8).describe("Max tools (default: 8)"),
});

export type SearchToolsInput = z.infer<typeof schema>;

export async function execute(input: SearchToolsInput): Promise<SearchToolsOutput> {
	const { query, limit = 8 } = input;

	console.log(`[searchTools] Query: "${query}", limit: ${limit}`);

	// Run hybrid search with related tools expansion
	const {
		tools: searchResults,
		confidence,
		source,
	} = await smartToolSearchWithConfidence(query, limit, { expandRelated: true });

	console.log(
		`[searchTools] Search: confidence=${confidence.toFixed(2)}, source=${source}`
	);

	// Handle empty or low-confidence results
	if (searchResults.length === 0 || confidence < CONFIG.MIN_CONFIDENCE) {
		console.log(
			`[searchTools] No good matches for "${query}" (confidence: ${confidence.toFixed(2)})`
		);
		return {
			tools: [],
			message: `No tools found for "${query}". Try: "create post", "list pages", "pexels photos", "update section".`,
		};
	}

	// Return all results up to limit - multi-action tasks need multiple tools
	const tools = searchResults.slice(0, limit).map((t) => t.name);
	console.log(`[searchTools] Found ${tools.length} tools: [${tools.join(", ")}]`);

	return {
		tools,
		message: `Found ${tools.length} tools. STOP SEARCHING - call one of these tools now to complete the task.`,
	};
}
