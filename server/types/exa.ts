/**
 * Exa AI API Types
 *
 * TypeScript interfaces for Exa's Search, Contents, and Research APIs.
 * Based on: https://docs.exa.ai/reference/search
 */

// ============================================================================
// Search API Types
// ============================================================================

export type ExaSearchType = "auto" | "neural" | "keyword";

export type ExaCategory =
	| "company"
	| "research paper"
	| "news"
	| "pdf"
	| "github"
	| "tweet"
	| "personal site"
	| "linkedin profile"
	| "financial report";

export type ExaLivecrawl = "never" | "fallback" | "always" | "preferred";

export interface ExaSearchRequest {
	query: string;
	type?: ExaSearchType;
	category?: ExaCategory;
	numResults?: number; // default: 10, max: 100
	includeDomains?: string[];
	excludeDomains?: string[];
	startPublishedDate?: string; // ISO 8601
	endPublishedDate?: string; // ISO 8601
	startCrawlDate?: string; // ISO 8601
	endCrawlDate?: string; // ISO 8601
	includeText?: string[]; // phrases that must appear
	excludeText?: string[]; // phrases to exclude
	useAutoprompt?: boolean; // default: true
	livecrawl?: ExaLivecrawl;
	// Content options (combined search + contents)
	contents?: ExaContentsOptions;
}

export interface ExaContentsOptions {
	text?: boolean | { maxCharacters?: number; includeHtmlTags?: boolean };
	highlights?: {
		query?: string;
		numSentences?: number;
		highlightsPerUrl?: number;
	};
	summary?: {
		query?: string;
	};
}

export interface ExaSearchResult {
	id: string;
	url: string;
	title: string;
	publishedDate?: string;
	author?: string;
	score?: number;
	image?: string;
	favicon?: string;
	// Content fields (if contents options provided)
	text?: string;
	highlights?: string[];
	highlightScores?: number[];
	summary?: string;
}

export interface ExaSearchResponse {
	requestId: string;
	results: ExaSearchResult[];
	autopromptString?: string;
	costDollars?: {
		total: number;
		search?: number;
		contents?: number;
	};
}

// ============================================================================
// Contents API Types
// ============================================================================

export interface ExaContentsRequest {
	urls: string[];
	text?: boolean | { maxCharacters?: number; includeHtmlTags?: boolean };
	highlights?: {
		query?: string;
		numSentences?: number;
		highlightsPerUrl?: number;
	};
	summary?: {
		query?: string;
	};
	livecrawl?: ExaLivecrawl;
}

export interface ExaContentResult {
	url: string;
	title?: string;
	text?: string;
	highlights?: string[];
	highlightScores?: number[];
	summary?: string;
}

export interface ExaContentsResponse {
	results: ExaContentResult[];
	statuses?: Array<{
		url: string;
		status: "success" | "error";
		error?: string;
	}>;
	costDollars?: {
		total: number;
	};
}

// ============================================================================
// Research API Types
// ============================================================================

export type ExaResearchModel = "exa-research" | "exa-research-pro";

export type ExaResearchStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export interface ExaResearchRequest {
	instructions: string;
	outputSchema?: Record<string, unknown>; // JSON Schema for structured output
	model?: ExaResearchModel;
}

export interface ExaResearchCreateResponse {
	researchId: string;
	status: ExaResearchStatus;
	createdAt: number; // Unix timestamp
	model: string;
	instructions: string;
}

export interface ExaResearchResult {
	researchId: string;
	status: ExaResearchStatus;
	createdAt: number;
	completedAt?: number;
	// Result fields (when complete)
	output?: Record<string, unknown>; // Matches outputSchema if provided
	markdown?: string; // Markdown report if no schema
	citations?: ExaResearchCitation[];
	// Cost info
	usage?: {
		searches: number;
		pagesRead: number;
		reasoningTokens: number;
	};
	costDollars?: number;
	// Error info (if failed)
	error?: string;
}

export interface ExaResearchCitation {
	title: string;
	url: string;
	snippet?: string;
}

// ============================================================================
// Tool Input/Output Types (for agent tools)
// ============================================================================

export interface QuickSearchInput {
	query: string;
	numResults?: number;
	category?: ExaCategory;
	includeDomains?: string[];
	excludeDomains?: string[];
	startPublishedDate?: string;
	livecrawl?: ExaLivecrawl;
}

export interface QuickSearchOutput {
	success: boolean;
	results: Array<{
		title: string;
		url: string;
		snippet: string;
		publishedDate?: string;
		author?: string;
	}>;
	totalResults: number;
	costDollars?: number;
	error?: string;
}

export interface DeepResearchInput {
	topic: string;
	outputSchema?: {
		sections?: string[];
		includeStatistics?: boolean;
		maxSources?: number;
	};
	model?: ExaResearchModel;
	maxWaitTime?: number; // seconds
}

export interface DeepResearchOutput {
	success: boolean;
	researchId: string;
	status: ExaResearchStatus;
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
	usage?: {
		searches: number;
		pagesRead: number;
		reasoningTokens: number;
	};
	costDollars?: number;
	error?: string;
}

export interface FetchContentInput {
	urls: string[];
	includeText?: boolean;
	textMaxCharacters?: number;
	includeSummary?: boolean;
	summaryQuery?: string;
}

export interface FetchContentOutput {
	success: boolean;
	contents: Array<{
		url: string;
		title?: string;
		text?: string;
		summary?: string;
		status: "success" | "error";
		error?: string;
	}>;
	costDollars?: number;
	error?: string;
}
