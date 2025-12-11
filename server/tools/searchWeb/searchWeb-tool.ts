/**
 * searchWeb Tool Implementation
 *
 * Unified web search with mode selection.
 * - quick: Fast facts lookup
 * - deep: Comprehensive research with AI-generated answer
 */

import { z } from "zod";
import {
	getTavilyService,
	type TavilySearchTopic,
} from "../../services/ai/tavily-research.service";

export const schema = z.object({
	query: z.string().describe("Search query - be specific for better results"),
	mode: z
		.enum(["quick", "deep"])
		.optional()
		.describe("Search mode: quick (facts) or deep (research). Default: quick"),
	numResults: z
		.number()
		.min(1)
		.max(20)
		.optional()
		.describe("Number of results (default: 5 for quick, 10 for deep)"),
	topic: z
		.enum(["general", "news", "finance"])
		.optional()
		.describe("Search category: general (default), news, or finance"),
	includeDomains: z
		.array(z.string())
		.optional()
		.describe("Only include results from these domains"),
	excludeDomains: z
		.array(z.string())
		.optional()
		.describe("Exclude results from these domains"),
	recentOnly: z
		.boolean()
		.optional()
		.describe("Only include results from the last week (quick mode only)"),
	includeRawContent: z
		.boolean()
		.optional()
		.describe("Include full page content from sources (deep mode only)"),
});

export type SearchWebInput = z.infer<typeof schema>;

export async function execute(input: SearchWebInput) {
	const tavilyService = getTavilyService();

	if (!tavilyService.isConfigured()) {
		return {
			success: false,
			error:
				"Tavily API key not configured. Set TAVILY_API_KEY environment variable.",
			results: [],
		};
	}

	const mode = input.mode || "quick";

	try {
		if (mode === "quick") {
			const response = await tavilyService.quickSearch(input.query, {
				numResults: input.numResults ?? 5,
				topic: input.topic as TavilySearchTopic | undefined,
				recentOnly: input.recentOnly,
				includeDomains: input.includeDomains,
				excludeDomains: input.excludeDomains,
			});

			return {
				success: true,
				mode: "quick",
				results: response.results,
				totalResults: response.results.length,
				responseTime: response.responseTime,
				query: input.query,
			};
		} else {
			// deep mode
			const response = await tavilyService.deepSearch(input.query, {
				numResults: input.numResults ?? 10,
				topic: input.topic as TavilySearchTopic | undefined,
				includeRawContent: input.includeRawContent,
			});

			return {
				success: true,
				mode: "deep",
				answer: response.answer,
				citations: response.results.map((r) => ({
					title: r.title,
					url: r.url,
					snippet: r.snippet,
				})),
				responseTime: response.responseTime,
				query: input.query,
			};
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Search failed",
			results: [],
		};
	}
}
