/**
 * Web Research Tools - Tavily API Integration
 *
 * Three tools for web research:
 * - web_quickSearch: Fast lookups for fresh information
 * - web_deepResearch: Comprehensive research with AI-generated answers
 * - web_fetchContent: Fetch full content from URLs
 *
 * DESIGN NOTE: The Tavily service is intentionally kept as a singleton via
 * getTavilyService(). It's a stateless API client that only needs an API key
 * (from env vars) and doesn't require session context or database access.
 */

import { tool } from "ai";
import { z } from "zod";
import { getTavilyService, type TavilySearchTopic } from "../services/ai/tavily-research.service";

// ============================================================================
// Tool 1: Quick Search
// ============================================================================

export const webQuickSearchTool = tool({
	description: `Quick web search for facts, links, recent news. Fast (~1-2s).`,
	inputSchema: z.object({
		query: z.string().describe("Search query - be specific for better results"),
		numResults: z.number().min(1).max(20).optional().describe("Number of results (1-20, default: 5)"),
		topic: z
			.enum(["general", "news", "finance"])
			.optional()
			.describe("Search category: general (default), news, or finance"),
		includeDomains: z.array(z.string()).optional().describe("Only include results from these domains"),
		excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains"),
		recentOnly: z.boolean().optional().describe("Only include results from the last week"),
	}),
	execute: async (input) => {
		const tavilyService = getTavilyService();

		if (!tavilyService.isConfigured()) {
			return {
				success: false,
				error: "Tavily API key not configured. Set TAVILY_API_KEY environment variable.",
				results: [],
				totalResults: 0,
			};
		}

		try {
			const response = await tavilyService.quickSearch(input.query, {
				numResults: input.numResults ?? 5,
				topic: input.topic as TavilySearchTopic | undefined,
				recentOnly: input.recentOnly,
				includeDomains: input.includeDomains,
				excludeDomains: input.excludeDomains,
			});

			return {
				success: true,
				results: response.results,
				totalResults: response.results.length,
				responseTime: response.responseTime,
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
	description: `Comprehensive web research with AI-generated answer and citations. For blog posts and articles.`,
	inputSchema: z.object({
		topic: z.string().describe("Research topic or question - be specific about what information you need"),
		numResults: z.number().min(5).max(20).optional().describe("Number of sources to analyze (5-20, default: 10)"),
		category: z
			.enum(["general", "news", "finance"])
			.optional()
			.describe("Search category: general (default), news, or finance"),
		includeRawContent: z.boolean().optional().describe("Include full page content from sources (default: false)"),
	}),
	execute: async (input) => {
		const tavilyService = getTavilyService();

		if (!tavilyService.isConfigured()) {
			return {
				success: false,
				error: "Tavily API key not configured. Set TAVILY_API_KEY environment variable.",
				answer: "",
				citations: [],
			};
		}

		try {
			const response = await tavilyService.deepSearch(input.topic, {
				numResults: input.numResults ?? 10,
				topic: input.category as TavilySearchTopic | undefined,
				includeRawContent: input.includeRawContent,
			});

			return {
				success: true,
				answer: response.answer,
				citations: response.results.map((r) => ({
					title: r.title,
					url: r.url,
					snippet: r.snippet,
				})),
				responseTime: response.responseTime,
				topic: input.topic,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Research failed",
				answer: "",
				citations: [],
			};
		}
	},
});

// ============================================================================
// Tool 3: Fetch Content
// ============================================================================

export const webFetchContentTool = tool({
	description: `Fetch full content from URLs. Up to 10 URLs per request.`,
	inputSchema: z.object({
		urls: z.array(z.string().url()).min(1).max(10).describe("URLs to fetch content from (1-10)"),
		format: z.enum(["markdown", "text"]).optional().describe("Content format: markdown (default) or text"),
	}),
	execute: async (input) => {
		const tavilyService = getTavilyService();

		if (!tavilyService.isConfigured()) {
			return {
				success: false,
				error: "Tavily API key not configured. Set TAVILY_API_KEY environment variable.",
				contents: [],
			};
		}

		try {
			const response = await tavilyService.fetchUrlContent(input.urls, {
				format: input.format,
			});

			return {
				success: true,
				contents: response.contents,
				responseTime: response.responseTime,
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

