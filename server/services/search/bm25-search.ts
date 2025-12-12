/**
 * BM25 Lexical Search
 *
 * Fast English-language tool search using BM25 algorithm.
 * Provides high-confidence results for exact/partial keyword matches.
 * Falls back to vector search for semantic/multilingual queries.
 */

// @ts-expect-error - wink-bm25-text-search has no type definitions
import bm25 from "wink-bm25-text-search";
// @ts-expect-error - wink-porter2-stemmer has no type definitions
import stem from "wink-porter2-stemmer";
import type { ToolMetadata, ToolSearchResult, BM25SearchResult } from "./types";
import { ToolRegistry } from "../../tools/_registry";

// ============================================================================
// Module State
// ============================================================================

let engine: any = null;
let toolNameMap: Map<string, string> = new Map(); // BM25 returns string IDs
let isInitialized = false;

// ============================================================================
// Text Preparation
// ============================================================================

/**
 * Simple text preparation pipeline:
 * 1. Lowercase
 * 2. Tokenize (split on non-alphanumeric)
 * 3. Filter short tokens (< 2 chars)
 * 4. Stem using Porter2
 */
function prepareText(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length >= 2)
		.map((token) => stem(token));
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize BM25 index with tool metadata.
 * Called once at server startup.
 */
export function initBM25Index(tools?: ToolMetadata[]): void {
	if (isInitialized) {
		console.log("[BM25] Already initialized, skipping");
		return;
	}

	const toolList = tools || ToolRegistry.getInstance().getAll();

	// Create new engine instance
	engine = bm25();

	// Define config with field weights
	// Higher weight = more important for ranking
	engine.defineConfig({
		fldWeights: {
			name: 3, // Tool name is most important
			phrases: 2, // Search phrases are key for discovery
		},
	});

	// Define text preparation tasks
	engine.definePrepTasks([prepareText]);

	// Add each tool as a document
	toolNameMap = new Map();
	toolList.forEach((tool, index) => {
		// Build searchable document
		const doc = {
			name: tool.name.replace(/_/g, " "), // cms_getPage -> cms get page
			phrases: tool.phrases.join(" "),
		};

		// BM25 engine converts numeric IDs to strings internally
		const docId = String(index);
		engine.addDoc(doc, docId);
		toolNameMap.set(docId, tool.name);
	});

	// Consolidate index (required before searching)
	engine.consolidate();

	isInitialized = true;
	console.log(`✓ BM25 index initialized: ${toolList.length} tools indexed`);
}

// ============================================================================
// Search
// ============================================================================

/**
 * Search tools using BM25 algorithm.
 * Returns tools with confidence score indicating match quality.
 *
 * @param query - Search query (natural language)
 * @param limit - Maximum results to return
 * @returns Tools and confidence (0-1, higher = better match)
 */
export function bm25Search(query: string, limit: number = 5): BM25SearchResult {
	if (!isInitialized || !engine) {
		console.warn("[BM25] Not initialized, returning empty results");
		return { tools: [], confidence: 0 };
	}

	// Search returns array of [docId, score] pairs, sorted by score desc
	// Note: BM25 engine returns string IDs even if we pass numbers
	const results: Array<[string, number]> = engine.search(query, limit * 2);

	if (results.length === 0) {
		return { tools: [], confidence: 0 };
	}

	// Calculate confidence based on score distribution
	const confidence = calculateConfidence(results);

	// Map results to ToolSearchResult format
	const tools: ToolSearchResult[] = results
		.slice(0, limit)
		.map(([docId, score]): ToolSearchResult | null => {
			const toolName = toolNameMap.get(docId);
			if (!toolName) {
				return null;
			}

			const metadata = ToolRegistry.getInstance().get(toolName);
			if (!metadata) {
				return null;
			}

			return {
				name: metadata.name,
				score: normalizeScore(score, results),
				relatedTools:
					metadata.relatedTools.length > 0
						? metadata.relatedTools
						: undefined,
			};
		})
		.filter((t): t is ToolSearchResult => t !== null);

	return { tools, confidence };
}

// ============================================================================
// Confidence & Score Calculation
// ============================================================================

/**
 * Calculate confidence in BM25 results.
 * High confidence (>0.8) = use BM25 results directly
 * Low confidence (<0.3) = fall back to vector search
 *
 * Based on:
 * - Top score magnitude (higher = more confident)
 * - Score gap between top results (larger gap = more confident)
 * - Number of results (more results = less confident in top result)
 */
function calculateConfidence(results: Array<[string, number]>): number {
	if (results.length === 0) return 0;

	const topScore = results[0][1];

	// BM25 scores are typically in 0-20 range for good matches
	// Normalize to 0-1 based on empirical thresholds
	const scoreFactor = Math.min(topScore / 10, 1);

	// Score gap: if top result is much better than 2nd, more confident
	let gapFactor = 1;
	if (results.length >= 2) {
		const secondScore = results[1][1];
		const gap = topScore - secondScore;
		gapFactor = Math.min(gap / topScore + 0.5, 1);
	}

	// Fewer results = more focused query = more confident
	const countFactor = Math.max(1 - results.length / 20, 0.5);

	// Weighted combination
	const confidence = scoreFactor * 0.5 + gapFactor * 0.3 + countFactor * 0.2;

	return Math.min(Math.max(confidence, 0), 1);
}

/**
 * Normalize BM25 score to 0-1 range relative to result set.
 */
function normalizeScore(
	score: number,
	results: Array<[string, number]>,
): number {
	if (results.length === 0) return 0;

	const maxScore = results[0][1];
	if (maxScore === 0) return 0;

	return score / maxScore;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if BM25 index is initialized.
 */
export function isBM25Initialized(): boolean {
	return isInitialized;
}

/**
 * Reset BM25 index (useful for testing).
 */
export function resetBM25Index(): void {
	engine = null;
	toolNameMap = new Map();
	isInitialized = false;
}

/**
 * Get BM25 index stats.
 */
export function getBM25Stats(): { initialized: boolean; toolCount: number } {
	return {
		initialized: isInitialized,
		toolCount: toolNameMap.size,
	};
}
