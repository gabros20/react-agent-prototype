/**
 * Tool Search Service Types
 *
 * Type definitions for the tool search service.
 * Re-exports types from tools/_types for convenience.
 */

// Re-export types from the canonical location
export {
	type ToolMetadata,
	type ToolSearchResult,
	type BM25SearchResult,
	type SmartSearchResult,
	type ExtractionSchema,
	type Entity,
	type CustomExtractFn,
} from "../../tools/_types/metadata";
