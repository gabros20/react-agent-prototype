/**
 * Discovery Module - Exports
 *
 * Dynamic tool injection system for AI agent.
 * See: docs/implementation/DYNAMIC_TOOL_INJECTION_PLAN.md
 */

// Types
export * from "./types";

// Tool Index
export { TOOL_INDEX, ALL_TOOL_NAMES } from "./tool-index";
export type { ToolName } from "./tool-index";

// Custom Extractors
export { CUSTOM_EXTRACTORS } from "./custom-extractors";

// Validation
export { validateToolIndex, getValidationStats } from "./validate";

// BM25 Search (Phase 2)
export {
	initBM25Index,
	bm25Search,
	isBM25Initialized,
	resetBM25Index,
	getBM25Stats,
} from "./bm25-search";

// Vector Search (Phase 3)
export {
	initToolVectorIndex,
	vectorSearch,
	isVectorInitialized,
	resetVectorIndex,
	getVectorStats,
} from "./vector-search";

// Smart/Hybrid Search (Phase 3)
export {
	smartToolSearch,
	smartToolSearchWithConfidence,
	quickToolSearch,
	expandWithRelatedTools,
	isContentQuery,
	type SmartSearchResult,
} from "./smart-search";

// Rules - REMOVED: Now using Per-Tool Instructions via TOOL_INSTRUCTIONS
// See: server/tools/instructions/index.ts

// Discovery Tool (Phase 5)
export { toolSearchTool, type ToolSearchOutput } from "./tool-search";

// Utilities - extract tools from current execution steps
export { extractToolsFromSteps } from "./utils";
