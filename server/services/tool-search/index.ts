/**
 * Tool Search Service - Index
 *
 * Re-exports all tool search functionality from a single location.
 */

// Main service class
export { ToolSearchService } from "./tool-search.service";

// Types
export * from "./types";

// Tool registry
export { TOOL_REGISTRY, ALL_TOOL_NAMES } from "./tool-registry";
export type { ToolName } from "./tool-registry";

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
