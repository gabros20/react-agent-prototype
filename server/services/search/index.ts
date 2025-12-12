/**
 * Search Service - Index
 *
 * Re-exports all search functionality from a single location.
 * Renamed from tool-search/ to search/ as part of modular architecture refactor.
 */

// Main service class
export { ToolSearchService } from "./tool-search.service";

// Types
export * from "./types";

// Tool registry - use the unified registry from tools/_registry/
export { ToolRegistry, TOOL_REGISTRY, ALL_TOOL_NAMES } from "../../tools/_registry";
export type { ToolMetadata } from "../../tools/_registry";

// Individual search implementations (for advanced usage)
export {
	initBM25Index,
	bm25Search,
	isBM25Initialized,
	resetBM25Index,
	getBM25Stats,
} from "./bm25-search";

export {
	initToolVectorIndex,
	vectorSearch,
	isVectorInitialized,
	resetVectorIndex,
	getVectorStats,
} from "./vector-search";

export {
	smartToolSearch,
	smartToolSearchWithConfidence,
	quickToolSearch,
	expandWithRelatedTools,
	isContentQuery,
} from "./smart-search";

export {
	getCachedEmbedding,
	getEmbeddingCacheStats,
	clearEmbeddingCache,
} from "./embedding-cache";
