/**
 * Exa AI Research Service
 *
 * Handles all Exa API interactions:
 * - Search (quick lookups)
 * - Contents (fetch URL content)
 * - Research (deep multi-source research)
 */

import type {
	ExaSearchRequest,
	ExaSearchResponse,
	ExaContentsRequest,
	ExaContentsResponse,
	ExaResearchRequest,
	ExaResearchCreateResponse,
	ExaResearchResult,
	ExaResearchModel,
} from "../../types/exa";

const EXA_BASE_URL = "https://api.exa.ai";

interface ExaServiceConfig {
	apiKey: string;
	defaultModel?: ExaResearchModel;
	researchTimeout?: number; // seconds
}

export class ExaResearchService {
	private apiKey: string;
	private defaultModel: ExaResearchModel;
	private researchTimeout: number;

	constructor(config?: Partial<ExaServiceConfig>) {
		this.apiKey = config?.apiKey || process.env.EXA_API_KEY || "";
		this.defaultModel =
			config?.defaultModel ||
			(process.env.EXA_DEFAULT_MODEL as ExaResearchModel) ||
			"exa-research";
		this.researchTimeout =
			config?.researchTimeout ||
			parseInt(process.env.EXA_RESEARCH_TIMEOUT || "120", 10);

		if (!this.apiKey) {
			console.warn(
				"[ExaResearchService] No API key configured. Set EXA_API_KEY environment variable."
			);
		}
	}

	/**
	 * Make authenticated request to Exa API
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const url = `${EXA_BASE_URL}${endpoint}`;

		const response = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.apiKey,
				...options.headers,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Exa API error (${response.status}): ${errorText}`
			);
		}

		return response.json();
	}

	// ============================================================================
	// Search API
	// ============================================================================

	/**
	 * Perform a quick search with optional content retrieval
	 *
	 * Cost optimization notes:
	 * - type: "auto" for semantic matching (avoids 3x cost of "deep")
	 * - useAutoprompt: false saves LLM processing (our queries are already good)
	 * - livecrawl: "never" avoids extra crawling costs
	 * - highlights add $0.001/page - minimal but avoid if not needed
	 */
	async search(params: ExaSearchRequest): Promise<ExaSearchResponse> {
		// Cost-optimized defaults:
		// - type: "auto" for good semantic matching (avoids 3x cost of "deep")
		// - useAutoprompt: false (our queries are already well-formed)
		// - livecrawl: defaults to "never" unless specified
		const searchParams: ExaSearchRequest = {
			type: "auto", // Good quality without 3x "deep" cost
			numResults: 5,
			useAutoprompt: false, // Skip LLM query enhancement
			livecrawl: "never", // Avoid crawling costs by default
			...params,
			// Include minimal highlights for context (still useful for snippets)
			contents: params.contents || {
				highlights: {
					numSentences: 1,
					highlightsPerUrl: 1,
				},
			},
		};

		return this.request<ExaSearchResponse>("/search", {
			method: "POST",
			body: JSON.stringify(searchParams),
		});
	}

	/**
	 * Quick search helper - simplified interface for common use case
	 *
	 * Cost-optimized defaults:
	 * - Uses "auto" search type (good semantic matching, not 3x "deep" cost)
	 * - Minimal highlights (2 sentences, 1 per URL)
	 * - No livecrawl unless explicitly requested
	 */
	async quickSearch(
		query: string,
		options?: {
			numResults?: number;
			category?: ExaSearchRequest["category"];
			livecrawl?: ExaSearchRequest["livecrawl"];
			includeDomains?: string[];
			excludeDomains?: string[];
			startPublishedDate?: string;
			/** Override search type if needed (default: "auto") */
			searchType?: ExaSearchRequest["type"];
		}
	): Promise<{
		results: Array<{
			title: string;
			url: string;
			snippet: string;
			publishedDate?: string;
			author?: string;
		}>;
		costDollars?: number;
	}> {
		const response = await this.search({
			query,
			type: options?.searchType || "auto", // Good semantic matching
			numResults: options?.numResults || 5,
			category: options?.category,
			livecrawl: options?.livecrawl, // Let search() default to "never"
			includeDomains: options?.includeDomains,
			excludeDomains: options?.excludeDomains,
			startPublishedDate: options?.startPublishedDate,
			// Minimal highlights - enough for useful snippets
			contents: {
				highlights: {
					numSentences: 2,
					highlightsPerUrl: 1,
				},
			},
		});

		return {
			results: response.results.map((r) => ({
				title: r.title,
				url: r.url,
				snippet: r.highlights?.join(" ") || r.summary || "",
				publishedDate: r.publishedDate,
				author: r.author,
			})),
			costDollars: response.costDollars?.total,
		};
	}

	// ============================================================================
	// Contents API
	// ============================================================================

	/**
	 * Fetch content from specific URLs
	 */
	async getContents(
		params: ExaContentsRequest
	): Promise<ExaContentsResponse> {
		return this.request<ExaContentsResponse>("/contents", {
			method: "POST",
			body: JSON.stringify(params),
		});
	}

	/**
	 * Fetch content helper - simplified interface
	 */
	async fetchUrlContent(
		urls: string[],
		options?: {
			maxCharacters?: number;
			includeSummary?: boolean;
			summaryQuery?: string;
		}
	): Promise<{
		contents: Array<{
			url: string;
			title?: string;
			text?: string;
			summary?: string;
			status: "success" | "error";
			error?: string;
		}>;
		costDollars?: number;
	}> {
		const response = await this.getContents({
			urls,
			text: options?.maxCharacters
				? { maxCharacters: options.maxCharacters }
				: true,
			summary: options?.includeSummary
				? { query: options?.summaryQuery || "Summarize this content" }
				: undefined,
			livecrawl: "fallback",
		});

		// Map results with status info
		const contents = response.results.map((r, i) => {
			const status = response.statuses?.[i];
			return {
				url: r.url,
				title: r.title,
				text: r.text,
				summary: r.summary,
				status: (status?.status || "success") as "success" | "error",
				error: status?.error,
			};
		});

		return {
			contents,
			costDollars: response.costDollars?.total,
		};
	}

	// ============================================================================
	// Research API
	// ============================================================================

	/**
	 * Start a deep research job
	 */
	async startResearch(
		params: ExaResearchRequest
	): Promise<ExaResearchCreateResponse> {
		const researchParams: ExaResearchRequest = {
			model: this.defaultModel,
			...params,
		};

		return this.request<ExaResearchCreateResponse>("/research/v1", {
			method: "POST",
			body: JSON.stringify(researchParams),
		});
	}

	/**
	 * Get research job status and results
	 */
	async getResearchStatus(researchId: string): Promise<ExaResearchResult> {
		return this.request<ExaResearchResult>(`/research/v1/${researchId}`, {
			method: "GET",
		});
	}

	/**
	 * Poll for research completion with timeout
	 */
	async waitForResearch(
		researchId: string,
		maxWaitSeconds?: number
	): Promise<ExaResearchResult> {
		const timeout = maxWaitSeconds || this.researchTimeout;
		const startTime = Date.now();
		const pollInterval = 3000; // 3 seconds

		while (true) {
			const result = await this.getResearchStatus(researchId);

			if (result.status === "completed" || result.status === "failed") {
				return result;
			}

			// Check timeout
			const elapsed = (Date.now() - startTime) / 1000;
			if (elapsed >= timeout) {
				throw new Error(
					`Research timeout after ${timeout}s. Research ID: ${researchId}`
				);
			}

			// Wait before next poll
			await new Promise((resolve) => setTimeout(resolve, pollInterval));
		}
	}

	/**
	 * Deep research helper - starts research and waits for completion
	 */
	async deepResearch(
		topic: string,
		options?: {
			outputSchema?: {
				sections?: string[];
				includeStatistics?: boolean;
				maxSources?: number;
			};
			model?: ExaResearchModel;
			maxWaitTime?: number;
		}
	): Promise<{
		researchId: string;
		status: ExaResearchResult["status"];
		report?: {
			summary?: string;
			content?: Record<string, unknown>;
			markdown?: string;
		};
		citations: Array<{
			title: string;
			url: string;
			snippet?: string;
		}>;
		usage?: ExaResearchResult["usage"];
		costDollars?: number;
	}> {
		// Build instructions for research
		const instructions = this.buildResearchInstructions(topic, options?.outputSchema);

		// Build proper JSON Schema if sections are specified
		const jsonSchema = options?.outputSchema?.sections
			? this.buildJsonSchema(options.outputSchema.sections, options.outputSchema.includeStatistics)
			: undefined;

		// Start research job
		const createResponse = await this.startResearch({
			instructions,
			outputSchema: jsonSchema,
			model: options?.model || this.defaultModel,
		});

		// Wait for completion
		const result = await this.waitForResearch(
			createResponse.researchId,
			options?.maxWaitTime
		);

		// Format response
		return {
			researchId: result.researchId,
			status: result.status,
			report:
				result.status === "completed"
					? {
							summary: this.extractSummary(result),
							content: result.output,
							markdown: result.markdown,
						}
					: undefined,
			citations:
				result.citations?.map((c) => ({
					title: c.title,
					url: c.url,
					snippet: c.snippet,
				})) || [],
			usage: result.usage,
			costDollars: result.costDollars,
		};
	}

	/**
	 * Build research instructions from topic and schema
	 */
	private buildResearchInstructions(
		topic: string,
		schema?: {
			sections?: string[];
			includeStatistics?: boolean;
		}
	): string {
		let instructions = `Research the following topic thoroughly: ${topic}\n\n`;
		instructions += "Requirements:\n";
		instructions += "- Find multiple authoritative sources\n";
		instructions += "- Include recent information (prioritize 2024-2025 content)\n";
		instructions += "- Provide specific facts, statistics, and examples where available\n";
		instructions += "- Cite all sources used\n";

		if (schema?.sections && Array.isArray(schema.sections)) {
			instructions += `\nOrganize the research into these sections: ${schema.sections.join(", ")}\n`;
		}

		if (schema?.includeStatistics) {
			instructions += "\nInclude relevant statistics and data points.\n";
		}

		return instructions;
	}

	/**
	 * Build a proper JSON Schema from section names
	 */
	private buildJsonSchema(
		sections: string[],
		includeStatistics?: boolean
	): Record<string, unknown> {
		const properties: Record<string, unknown> = {};
		const required: string[] = [];

		// Add each section as a string property
		for (const section of sections) {
			const key = section.toLowerCase().replace(/\s+/g, "_");
			properties[key] = {
				type: "string",
				description: `Content for the ${section} section`,
			};
			required.push(key);
		}

		// Optionally add statistics array
		if (includeStatistics) {
			properties["statistics"] = {
				type: "array",
				items: { type: "string" },
				description: "Relevant statistics and data points",
			};
		}

		return {
			type: "object",
			required,
			properties,
			additionalProperties: false,
		};
	}

	/**
	 * Extract summary from research result
	 */
	private extractSummary(result: ExaResearchResult): string | undefined {
		if (result.markdown) {
			// Extract first paragraph as summary
			const lines = result.markdown.split("\n").filter((l) => l.trim());
			const firstParagraph = lines.find(
				(l) => !l.startsWith("#") && l.length > 50
			);
			return firstParagraph;
		}

		if (result.output && typeof result.output === "object") {
			// Look for summary field in structured output
			const output = result.output as Record<string, unknown>;
			if (typeof output.summary === "string") {
				return output.summary;
			}
			if (typeof output.overview === "string") {
				return output.overview;
			}
		}

		return undefined;
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

	/**
	 * Get date string for "last N days" filter
	 */
	static getDateFilter(daysAgo: number): string {
		const date = new Date();
		date.setDate(date.getDate() - daysAgo);
		return date.toISOString().split("T")[0];
	}
}

// Singleton instance
let exaServiceInstance: ExaResearchService | null = null;

export function getExaService(): ExaResearchService {
	if (!exaServiceInstance) {
		exaServiceInstance = new ExaResearchService();
	}
	return exaServiceInstance;
}
