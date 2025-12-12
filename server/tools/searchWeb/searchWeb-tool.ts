/**
 * searchWeb Tool Implementation
 *
 * Unified web search with dual-provider fallback (Tavily + Exa).
 * - quick: Fast facts lookup
 * - deep: Comprehensive research with AI-generated answer
 *
 * Uses both providers by default for resilience.
 * If one fails, the other provides results.
 */

import { z } from "zod";
import {
	getTavilyService,
	type TavilySearchTopic,
	type TavilyResearchService,
} from "../../services/ai/tavily-research.service";
import {
	getExaService,
	ExaResearchService,
} from "../../services/ai/exa-research.service";

export const schema = z.object({
	query: z.string().describe("Search query - be specific for better results"),
	mode: z
		.enum(["quick", "deep"])
		.optional()
		.describe("Search mode: quick (facts) or deep (research). Default: quick"),
	provider: z
		.enum(["tavily", "exa", "both"])
		.optional()
		.describe("Search provider: tavily, exa, or both (default for resilience)"),
	numResults: z
		.number()
		.min(1)
		.max(20)
		.optional()
		.describe("Number of results per provider (default: 5 for quick, 10 for deep)"),
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

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	score?: number;
	publishedDate?: string;
	author?: string;
	provider: "tavily" | "exa";
}

/**
 * Deduplicate results by URL (prefer first occurrence)
 */
function deduplicateByUrl(results: SearchResult[]): SearchResult[] {
	const seen = new Set<string>();
	return results.filter((r) => {
		const normalizedUrl = r.url.toLowerCase().replace(/\/$/, "");
		if (seen.has(normalizedUrl)) return false;
		seen.add(normalizedUrl);
		return true;
	});
}

/**
 * Search using Tavily provider
 */
async function searchWithTavily(
	input: SearchWebInput,
	mode: "quick" | "deep",
	service: TavilyResearchService
): Promise<SearchResult[]> {
	if (mode === "quick") {
		const response = await service.quickSearch(input.query, {
			numResults: input.numResults ?? 5,
			topic: input.topic as TavilySearchTopic | undefined,
			recentOnly: input.recentOnly,
			includeDomains: input.includeDomains,
			excludeDomains: input.excludeDomains,
		});

		return response.results.map((r) => ({
			title: r.title,
			url: r.url,
			snippet: r.snippet,
			score: r.score,
			provider: "tavily" as const,
		}));
	} else {
		// deep mode - get results for citations
		const response = await service.deepSearch(input.query, {
			numResults: input.numResults ?? 10,
			topic: input.topic as TavilySearchTopic | undefined,
			includeRawContent: input.includeRawContent,
		});

		return response.results.map((r) => ({
			title: r.title,
			url: r.url,
			snippet: r.snippet,
			provider: "tavily" as const,
		}));
	}
}

/**
 * Search using Exa provider
 */
async function searchWithExa(
	input: SearchWebInput,
	mode: "quick" | "deep",
	service: ExaResearchService
): Promise<SearchResult[]> {
	// Exa quickSearch works for both modes - deep mode just uses more results
	const numResults = mode === "deep" ? (input.numResults ?? 10) : (input.numResults ?? 5);

	// Map topic to Exa category
	let category: "news" | undefined;
	if (input.topic === "news") {
		category = "news";
	}

	const response = await service.quickSearch(input.query, {
		numResults,
		category,
		includeDomains: input.includeDomains,
		excludeDomains: input.excludeDomains,
		// Exa uses date filter for recent-only
		startPublishedDate: input.recentOnly
			? ExaResearchService.getDateFilter(7)
			: undefined,
	});

	return response.results.map((r) => ({
		title: r.title,
		url: r.url,
		snippet: r.snippet,
		publishedDate: r.publishedDate,
		author: r.author,
		provider: "exa" as const,
	}));
}

export async function execute(input: SearchWebInput) {
	const provider = input.provider || "both";
	const mode = input.mode || "quick";
	const allResults: SearchResult[] = [];
	const errors: string[] = [];
	let tavilyAnswer: string | undefined;

	// Try Tavily
	if (provider === "tavily" || provider === "both") {
		const tavilyService = getTavilyService();

		if (!tavilyService.isConfigured()) {
			if (provider === "tavily") {
				return {
					success: false,
					error: "Tavily API key not configured. Set TAVILY_API_KEY environment variable.",
					results: [],
				};
			}
			errors.push("Tavily not configured");
		} else {
			try {
				// For deep mode, also get the AI answer from Tavily
				if (mode === "deep") {
					const deepResponse = await tavilyService.deepSearch(input.query, {
						numResults: input.numResults ?? 10,
						topic: input.topic as TavilySearchTopic | undefined,
						includeRawContent: input.includeRawContent,
					});
					tavilyAnswer = deepResponse.answer;

					const results = deepResponse.results.map((r) => ({
						title: r.title,
						url: r.url,
						snippet: r.snippet,
						provider: "tavily" as const,
					}));
					allResults.push(...results);
				} else {
					const tavilyResults = await searchWithTavily(input, mode, tavilyService);
					allResults.push(...tavilyResults);
				}
			} catch (error) {
				errors.push(`Tavily: ${error instanceof Error ? error.message : "Search failed"}`);
			}
		}
	}

	// Try Exa
	if (provider === "exa" || provider === "both") {
		const exaService = getExaService();

		if (!exaService.isConfigured()) {
			if (provider === "exa") {
				return {
					success: false,
					error: "Exa API key not configured. Set EXA_API_KEY environment variable.",
					results: [],
				};
			}
			errors.push("Exa not configured");
		} else {
			try {
				const exaResults = await searchWithExa(input, mode, exaService);
				allResults.push(...exaResults);
			} catch (error) {
				errors.push(`Exa: ${error instanceof Error ? error.message : "Search failed"}`);
			}
		}
	}

	// Deduplicate by URL
	const uniqueResults = deduplicateByUrl(allResults);

	// Handle complete failure
	if (uniqueResults.length === 0 && errors.length > 0) {
		return {
			success: false,
			error: errors.join("; "),
			results: [],
		};
	}

	// Build response based on mode
	if (mode === "deep") {
		return {
			success: true,
			mode: "deep",
			provider,
			answer: tavilyAnswer || "No AI-generated answer available (Tavily not configured or failed)",
			citations: uniqueResults.map((r) => ({
				title: r.title,
				url: r.url,
				snippet: r.snippet,
				provider: r.provider,
			})),
			totalResults: uniqueResults.length,
			query: input.query,
			...(errors.length > 0 && { warnings: errors }),
		};
	}

	// Quick mode
	return {
		success: true,
		mode: "quick",
		provider,
		results: uniqueResults,
		totalResults: uniqueResults.length,
		query: input.query,
		...(errors.length > 0 && { warnings: errors }),
	};
}
