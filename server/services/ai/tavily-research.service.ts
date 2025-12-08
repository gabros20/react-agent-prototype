/**
 * Tavily Research Service
 *
 * Handles all Tavily API interactions:
 * - Search: Quick web searches with optional AI-generated answers
 * - Extract: Fetch full content from URLs
 *
 * Replaces Exa AI for web research (simpler, cheaper).
 */

const TAVILY_BASE_URL = "https://api.tavily.com";

// ============================================================================
// Types
// ============================================================================

export type TavilySearchTopic = "general" | "news" | "finance";
export type TavilySearchDepth = "basic" | "advanced";
export type TavilyTimeRange = "day" | "week" | "month" | "year";

export interface TavilySearchRequest {
	query: string;
	topic?: TavilySearchTopic;
	search_depth?: TavilySearchDepth;
	max_results?: number;
	include_answer?: boolean | "basic" | "advanced";
	include_raw_content?: boolean | "markdown" | "text";
	include_images?: boolean;
	time_range?: TavilyTimeRange;
	include_domains?: string[];
	exclude_domains?: string[];
}

export interface TavilySearchResult {
	title: string;
	url: string;
	content: string;
	score: number;
	raw_content?: string;
}

export interface TavilySearchResponse {
	query: string;
	answer?: string;
	images?: string[];
	results: TavilySearchResult[];
	response_time: number;
	request_id: string;
}

export interface TavilyExtractRequest {
	urls: string | string[];
	include_images?: boolean;
	extract_depth?: "basic" | "advanced";
	format?: "markdown" | "text";
}

export interface TavilyExtractResult {
	url: string;
	raw_content: string;
	images?: string[];
}

export interface TavilyExtractResponse {
	results: TavilyExtractResult[];
	failed_results: Array<{ url: string; error: string }>;
	response_time: number;
	request_id: string;
}

// ============================================================================
// Service
// ============================================================================

interface TavilyServiceConfig {
	apiKey: string;
}

export class TavilyResearchService {
	private apiKey: string;

	constructor(config?: Partial<TavilyServiceConfig>) {
		this.apiKey = config?.apiKey || process.env.TAVILY_API_KEY || "";

		if (!this.apiKey) {
			console.warn(
				"[TavilyResearchService] No API key configured. Set TAVILY_API_KEY environment variable."
			);
		}
	}

	/**
	 * Make authenticated request to Tavily API
	 */
	private async request<T>(
		endpoint: string,
		body: Record<string, unknown>
	): Promise<T> {
		const url = `${TAVILY_BASE_URL}${endpoint}`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Tavily API error (${response.status}): ${errorText}`);
		}

		return response.json();
	}

	// ============================================================================
	// Search API
	// ============================================================================

	/**
	 * Perform a web search
	 */
	async search(params: TavilySearchRequest): Promise<TavilySearchResponse> {
		return this.request<TavilySearchResponse>("/search", {
			query: params.query,
			topic: params.topic || "general",
			search_depth: params.search_depth || "basic",
			max_results: params.max_results || 5,
			include_answer: params.include_answer || false,
			include_raw_content: params.include_raw_content || false,
			include_images: params.include_images || false,
			time_range: params.time_range,
			include_domains: params.include_domains,
			exclude_domains: params.exclude_domains,
		});
	}

	/**
	 * Quick search helper - simplified interface for common use case
	 */
	async quickSearch(
		query: string,
		options?: {
			numResults?: number;
			topic?: TavilySearchTopic;
			recentOnly?: boolean;
			includeDomains?: string[];
			excludeDomains?: string[];
		}
	): Promise<{
		results: Array<{
			title: string;
			url: string;
			snippet: string;
			score: number;
		}>;
		responseTime: number;
	}> {
		const response = await this.search({
			query,
			max_results: options?.numResults || 5,
			topic: options?.topic || "general",
			time_range: options?.recentOnly ? "week" : undefined,
			include_domains: options?.includeDomains,
			exclude_domains: options?.excludeDomains,
			search_depth: "basic",
		});

		return {
			results: response.results.map((r) => ({
				title: r.title,
				url: r.url,
				snippet: r.content,
				score: r.score,
			})),
			responseTime: response.response_time,
		};
	}

	/**
	 * Deep research - search with AI-generated comprehensive answer
	 */
	async deepSearch(
		query: string,
		options?: {
			numResults?: number;
			topic?: TavilySearchTopic;
			includeRawContent?: boolean;
		}
	): Promise<{
		answer: string;
		results: Array<{
			title: string;
			url: string;
			snippet: string;
			rawContent?: string;
		}>;
		responseTime: number;
	}> {
		const response = await this.search({
			query,
			max_results: options?.numResults || 10,
			topic: options?.topic || "general",
			search_depth: "advanced",
			include_answer: "advanced",
			include_raw_content: options?.includeRawContent ? "markdown" : false,
		});

		return {
			answer: response.answer || "No answer generated",
			results: response.results.map((r) => ({
				title: r.title,
				url: r.url,
				snippet: r.content,
				rawContent: r.raw_content,
			})),
			responseTime: response.response_time,
		};
	}

	// ============================================================================
	// Extract API
	// ============================================================================

	/**
	 * Extract content from URLs
	 */
	async extract(params: TavilyExtractRequest): Promise<TavilyExtractResponse> {
		return this.request<TavilyExtractResponse>("/extract", {
			urls: params.urls,
			include_images: params.include_images || false,
			extract_depth: params.extract_depth || "basic",
			format: params.format || "markdown",
		});
	}

	/**
	 * Fetch content helper - simplified interface
	 */
	async fetchUrlContent(
		urls: string[],
		options?: {
			format?: "markdown" | "text";
		}
	): Promise<{
		contents: Array<{
			url: string;
			content: string;
			status: "success" | "error";
			error?: string;
		}>;
		responseTime: number;
	}> {
		const response = await this.extract({
			urls,
			format: options?.format || "markdown",
			extract_depth: "basic",
		});

		// Combine successful and failed results
		const contents = [
			...response.results.map((r) => ({
				url: r.url,
				content: r.raw_content,
				status: "success" as const,
			})),
			...response.failed_results.map((r) => ({
				url: r.url,
				content: "",
				status: "error" as const,
				error: r.error,
			})),
		];

		return {
			contents,
			responseTime: response.response_time,
		};
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Check if API key is configured
	 */
	isConfigured(): boolean {
		return !!this.apiKey;
	}
}

// Singleton instance
let tavilyServiceInstance: TavilyResearchService | null = null;

export function getTavilyService(): TavilyResearchService {
	if (!tavilyServiceInstance) {
		tavilyServiceInstance = new TavilyResearchService();
	}
	return tavilyServiceInstance;
}
