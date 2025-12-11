/**
 * Hybrid Search Orchestrator
 *
 * Combines BM25 (lexical) and vector (semantic) search for optimal tool discovery.
 * - High BM25 confidence → use BM25 results directly (fast, accurate for English)
 * - Low BM25 confidence → fall back to vector search (semantic, multilingual)
 * - Related tools expansion for complete capability sets
 */

import type { ToolSearchResult, SmartSearchResult } from "./types";
import { TOOL_REGISTRY } from "./tool-registry";
import { bm25Search, isBM25Initialized } from "./bm25-search";
import { vectorSearch, isVectorInitialized } from "./vector-search";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
	// Confidence thresholds for BM25 results
	BM25_HIGH_CONFIDENCE: 0.7, // Use BM25 only
	BM25_LOW_CONFIDENCE: 0.3, // Use vector only

	// Between these: blend both results

	// Related tools expansion
	MAX_RELATED_TOOLS: 3,
	RELATED_TOOL_SCORE_DISCOUNT: 0.7,
} as const;

// ============================================================================
// Smart Search
// ============================================================================

/**
 * Hybrid tool search combining BM25 and vector search.
 *
 * Strategy:
 * 1. Run BM25 search first (fast, good for English keywords)
 * 2. Check confidence score
 * 3. If low confidence, supplement with vector search
 * 4. Deduplicate and merge results
 * 5. Optionally expand with related tools
 *
 * @param query - Natural language query
 * @param limit - Maximum results
 * @param options - Search options
 * @returns Ranked tools
 */
export async function smartToolSearch(
	query: string,
	limit: number = 5,
	options: {
		expandRelated?: boolean;
		forceVector?: boolean;
	} = {},
): Promise<ToolSearchResult[]> {
	const { expandRelated = true, forceVector = false } = options;

	// If forced vector search or BM25 not available
	if (forceVector || !isBM25Initialized()) {
		if (isVectorInitialized()) {
			const results = await vectorSearch(query, limit);
			return expandRelated ? expandWithRelatedTools(results, limit) : results;
		}
		return [];
	}

	// Run BM25 search first
	const bm25Result = bm25Search(query, limit);

	// High confidence: use BM25 results only
	if (bm25Result.confidence >= CONFIG.BM25_HIGH_CONFIDENCE) {
		const results = bm25Result.tools;
		return expandRelated ? expandWithRelatedTools(results, limit) : results;
	}

	// Low confidence: try vector search if available
	if (bm25Result.confidence < CONFIG.BM25_LOW_CONFIDENCE) {
		if (isVectorInitialized()) {
			const vectorResults = await vectorSearch(query, limit);
			if (vectorResults.length > 0) {
				return expandRelated
					? expandWithRelatedTools(vectorResults, limit)
					: vectorResults;
			}
		}
		// Fall back to BM25 even with low confidence
		const results = bm25Result.tools;
		return expandRelated ? expandWithRelatedTools(results, limit) : results;
	}

	// Medium confidence: blend BM25 and vector results
	if (isVectorInitialized()) {
		const vectorResults = await vectorSearch(query, limit);
		const blended = blendResults(bm25Result.tools, vectorResults, limit);
		return expandRelated ? expandWithRelatedTools(blended, limit) : blended;
	}

	// Vector not available: use BM25
	const results = bm25Result.tools;
	return expandRelated ? expandWithRelatedTools(results, limit) : results;
}

// ============================================================================
// Related Tools Expansion
// ============================================================================

/**
 * Expand results with related tools.
 * Adds commonly-used-together tools to provide complete capability sets.
 */
export function expandWithRelatedTools(
	results: ToolSearchResult[],
	limit: number,
): ToolSearchResult[] {
	if (results.length === 0) return results;

	const existingNames = new Set(results.map((t) => t.name));
	const expanded: ToolSearchResult[] = [...results];

	// Collect related tools from top results
	for (const tool of results) {
		const relatedNames = tool.relatedTools || [];

		for (const relatedName of relatedNames) {
			// Skip if already in results or at limit
			if (existingNames.has(relatedName)) continue;
			if (expanded.length >= limit + CONFIG.MAX_RELATED_TOOLS) break;

			// Look up related tool metadata
			const relatedMeta = TOOL_REGISTRY[relatedName];
			if (!relatedMeta) continue;

			// Add with discounted score
			expanded.push({
				name: relatedMeta.name,
				score: tool.score * CONFIG.RELATED_TOOL_SCORE_DISCOUNT,
				relatedTools:
					relatedMeta.relatedTools.length > 0
						? relatedMeta.relatedTools
						: undefined,
			});

			existingNames.add(relatedName);
		}
	}

	// Sort by score and return up to limit + related
	return expanded
		.sort((a, b) => b.score - a.score)
		.slice(0, limit + CONFIG.MAX_RELATED_TOOLS);
}

// ============================================================================
// Result Blending
// ============================================================================

/**
 * Blend BM25 and vector search results.
 * Uses reciprocal rank fusion for fair combination.
 */
function blendResults(
	bm25Results: ToolSearchResult[],
	vectorResults: ToolSearchResult[],
	limit: number,
): ToolSearchResult[] {
	const k = 60; // RRF constant (standard value)
	const scores: Map<string, number> = new Map();
	const toolMap: Map<string, ToolSearchResult> = new Map();

	// Add BM25 results with RRF scores
	bm25Results.forEach((tool, rank) => {
		const rrfScore = 1 / (k + rank + 1);
		scores.set(tool.name, (scores.get(tool.name) || 0) + rrfScore);
		toolMap.set(tool.name, tool);
	});

	// Add vector results with RRF scores
	vectorResults.forEach((tool, rank) => {
		const rrfScore = 1 / (k + rank + 1);
		scores.set(tool.name, (scores.get(tool.name) || 0) + rrfScore);
		if (!toolMap.has(tool.name)) {
			toolMap.set(tool.name, tool);
		}
	});

	// Sort by combined score
	const sortedNames = [...scores.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([name]) => name);

	// Build final results with normalized scores
	const maxScore = scores.get(sortedNames[0]) || 1;
	return sortedNames.map((name) => {
		const tool = toolMap.get(name)!;
		return {
			...tool,
			score: (scores.get(name) || 0) / maxScore, // Normalize to 0-1
		};
	});
}

// ============================================================================
// Quick Search (BM25 only)
// ============================================================================

/**
 * Fast BM25-only search for when speed is critical.
 * No vector fallback, no related tools expansion.
 */
export function quickToolSearch(
	query: string,
	limit: number = 5,
): ToolSearchResult[] {
	if (!isBM25Initialized()) {
		return [];
	}

	const { tools } = bm25Search(query, limit);
	return tools;
}

// ============================================================================
// Smart Search with Confidence
// ============================================================================

/**
 * Smart tool search that returns confidence alongside results.
 * Use this when you need to know if the search was successful.
 */
export async function smartToolSearchWithConfidence(
	query: string,
	limit: number = 5,
	options: {
		expandRelated?: boolean;
		forceVector?: boolean;
	} = {},
): Promise<SmartSearchResult> {
	const { expandRelated = true, forceVector = false } = options;

	// If forced vector search or BM25 not available
	if (forceVector || !isBM25Initialized()) {
		if (isVectorInitialized()) {
			const results = await vectorSearch(query, limit);
			const tools = expandRelated
				? expandWithRelatedTools(results, limit)
				: results;
			return { tools, confidence: 0.5, source: "vector" };
		}
		return { tools: [], confidence: 0, source: "vector" };
	}

	// Run BM25 search first
	const bm25Result = bm25Search(query, limit);

	// High confidence: use BM25 results only
	if (bm25Result.confidence >= CONFIG.BM25_HIGH_CONFIDENCE) {
		const tools = expandRelated
			? expandWithRelatedTools(bm25Result.tools, limit)
			: bm25Result.tools;
		return { tools, confidence: bm25Result.confidence, source: "bm25" };
	}

	// Low confidence: try vector search if available
	if (bm25Result.confidence < CONFIG.BM25_LOW_CONFIDENCE) {
		if (isVectorInitialized()) {
			const vectorResults = await vectorSearch(query, limit);
			if (vectorResults.length > 0) {
				const tools = expandRelated
					? expandWithRelatedTools(vectorResults, limit)
					: vectorResults;
				return { tools, confidence: 0.4, source: "vector" };
			}
		}
		// Fall back to BM25 even with low confidence
		const tools = expandRelated
			? expandWithRelatedTools(bm25Result.tools, limit)
			: bm25Result.tools;
		return { tools, confidence: bm25Result.confidence, source: "bm25" };
	}

	// Medium confidence: blend BM25 and vector results
	if (isVectorInitialized()) {
		const vectorResults = await vectorSearch(query, limit);
		const blended = blendResults(bm25Result.tools, vectorResults, limit);
		const tools = expandRelated
			? expandWithRelatedTools(blended, limit)
			: blended;
		return { tools, confidence: bm25Result.confidence, source: "blended" };
	}

	// Vector not available: use BM25
	const tools = expandRelated
		? expandWithRelatedTools(bm25Result.tools, limit)
		: bm25Result.tools;
	return { tools, confidence: bm25Result.confidence, source: "bm25" };
}

/**
 * Detect if a query looks like content rather than a capability.
 * Simple heuristic: long natural language queries are likely content.
 */
export function isContentQuery(query: string): boolean {
	const lowerQuery = query.toLowerCase().trim();

	// Content indicators: question words, long natural phrases
	const contentPatterns = [
		/^(how|what|why|when|where|who|which|can you|could you|please|tell me)/,
		/\b(about|regarding|concerning|related to)\b/,
	];

	// Check for content patterns
	for (const pattern of contentPatterns) {
		if (pattern.test(lowerQuery)) {
			return true;
		}
	}

	// Long queries (>5 words) are likely content
	const wordCount = query.trim().split(/\s+/).length;
	return wordCount > 5;
}
