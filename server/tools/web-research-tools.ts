/**
 * Web Research Tools - Exa AI Integration
 *
 * Three tools for web research:
 * - web_quickSearch: Fast lookups for fresh information
 * - web_deepResearch: Comprehensive multi-source research
 * - web_fetchContent: Fetch full content from URLs
 *
 * DESIGN NOTE: The Exa service is intentionally kept as a singleton via
 * getExaService(). It's a stateless API client that only needs an API key
 * (from env vars) and doesn't require session context or database access.
 * This is acceptable per the architectural decision to avoid bloating
 * AgentContext with stateless external API wrappers.
 */

import { tool } from "ai";
import { z } from "zod";
import { getExaService, ExaResearchService } from "../services/ai/exa-research.service";
import type { ExaCategory, ExaLivecrawl, ExaResearchModel } from "../types/exa";

// ============================================================================
// Tool 1: Quick Search
// ============================================================================

export const webQuickSearchTool = tool({
	description: `Perform a quick web search for fresh, up-to-date information. Use this for:
- Quick fact lookups (weather, prices, current events)
- Finding specific resources or links
- Recent news on a topic
- Verifying information
Returns snippets and URLs from top results. For comprehensive research, use web_deepResearch instead.`,
	inputSchema: z.object({
		query: z.string().describe("Search query - be specific for better results"),
		numResults: z.number().min(1).max(20).optional().describe("Number of results (1-20, default: 5)"),
		category: z
			.enum(["company", "research paper", "news", "pdf", "github", "tweet", "personal site", "linkedin profile", "financial report"])
			.optional()
			.describe("Filter by content category"),
		includeDomains: z.array(z.string()).optional().describe("Only include results from these domains"),
		excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains"),
		recentOnly: z.boolean().optional().describe("Only include results from the last 7 days"),
		livecrawl: z
			.enum(["never", "fallback", "always", "preferred"])
			.optional()
			.describe("Freshness: 'always' for real-time, 'fallback' for balanced (default)"),
	}),
	execute: async (input) => {
		// Exa service is stateless - uses singleton pattern (see file header)
		const exaService = getExaService();

		if (!exaService.isConfigured()) {
			return {
				success: false,
				error: "Exa API key not configured. Set EXA_API_KEY environment variable.",
				results: [],
				totalResults: 0,
			};
		}

		try {
			// Calculate date filter for recent results
			const startPublishedDate = input.recentOnly === true ? ExaResearchService.getDateFilter(7) : undefined;

			const response = await exaService.quickSearch(input.query, {
				numResults: input.numResults ?? 5,
				category: input.category as ExaCategory | undefined,
				livecrawl: (input.livecrawl as ExaLivecrawl) ?? "fallback",
				includeDomains: input.includeDomains,
				excludeDomains: input.excludeDomains,
				startPublishedDate,
			});

			return {
				success: true,
				results: response.results,
				totalResults: response.results.length,
				costDollars: response.costDollars,
				query: input.query,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Search failed",
				results: [],
				totalResults: 0,
			};
		}
	},
});

// ============================================================================
// Tool 2: Deep Research
// ============================================================================

export const webDeepResearchTool = tool({
	description: `Perform comprehensive web research on a topic using multiple sources. Use this for:
- Creating blog posts or articles that need well-researched content
- Building informational pages that should cite sources
- Researching complex topics that need multiple perspectives
- When user asks to "research" or "search the web for" something to use in content

This is an async operation that may take 30-120 seconds. Returns a structured report with citations.
For quick lookups, use web_quickSearch instead.`,
	inputSchema: z.object({
		topic: z.string().describe("Research topic or question - be specific about what information you need"),
		sections: z
			.array(z.string())
			.optional()
			.describe("Optional: organize research into these sections (e.g., ['overview', 'benefits', 'challenges'])"),
		includeStatistics: z.boolean().optional().describe("Include statistics and data points if available"),
		model: z
			.enum(["exa-research", "exa-research-pro"])
			.optional()
			.describe("Research model: 'exa-research' (faster/cheaper, default) or 'exa-research-pro' (higher quality)"),
		maxWaitTime: z.number().min(30).max(300).optional().describe("Max wait time in seconds (30-300, default: 120)"),
	}),
	execute: async (input) => {
		// Exa service is stateless - uses singleton pattern (see file header)
		const exaService = getExaService();

		if (!exaService.isConfigured()) {
			return {
				success: false,
				error: "Exa API key not configured. Set EXA_API_KEY environment variable.",
				researchId: "",
				status: "failed" as const,
				citations: [],
			};
		}

		try {
			// Build output schema if sections specified
			const outputSchema = input.sections
				? {
						sections: input.sections,
						includeStatistics: input.includeStatistics,
				  }
				: undefined;

			const response = await exaService.deepResearch(input.topic, {
				outputSchema,
				model: input.model as ExaResearchModel | undefined,
				maxWaitTime: input.maxWaitTime ?? 120,
			});

			return {
				success: response.status === "completed",
				researchId: response.researchId,
				status: response.status,
				report: response.report,
				citations: response.citations,
				usage: response.usage,
				costDollars: response.costDollars,
				topic: input.topic,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Research failed",
				researchId: "",
				status: "failed" as const,
				citations: [],
			};
		}
	},
});

// ============================================================================
// Tool 3: Fetch Content
// ============================================================================

export const webFetchContentTool = tool({
	description: `Fetch the full content from specific URLs. Use this for:
- Getting full text from a URL found in search results
- Reading content from a URL the user provided
- Extracting detailed information from a specific page
- Getting AI-generated summaries of web pages

Supports up to 10 URLs per request.`,
	inputSchema: z.object({
		urls: z.array(z.string().url()).min(1).max(10).describe("URLs to fetch content from (1-10)"),
		includeText: z.boolean().optional().describe("Include full page text (default: true)"),
		textMaxCharacters: z.number().optional().describe("Max characters of text to return per URL (default: 10000)"),
		includeSummary: z.boolean().optional().describe("Include AI-generated summary of each page"),
		summaryQuery: z.string().optional().describe("Custom focus for summaries (e.g., 'focus on pricing information')"),
	}),
	execute: async (input) => {
		// Exa service is stateless - uses singleton pattern (see file header)
		const exaService = getExaService();

		if (!exaService.isConfigured()) {
			return {
				success: false,
				error: "Exa API key not configured. Set EXA_API_KEY environment variable.",
				contents: [],
			};
		}

		try {
			const response = await exaService.fetchUrlContent(input.urls, {
				maxCharacters: input.textMaxCharacters ?? 10000,
				includeSummary: input.includeSummary,
				summaryQuery: input.summaryQuery,
			});

			return {
				success: true,
				contents: response.contents,
				costDollars: response.costDollars,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Content fetch failed",
				contents: [],
			};
		}
	},
});

// ============================================================================
// Export All Tools
// ============================================================================

export const webResearchTools = {
	web_quickSearch: webQuickSearchTool,
	web_deepResearch: webDeepResearchTool,
	web_fetchContent: webFetchContentTool,
};
