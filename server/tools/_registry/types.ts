/**
 * Tool Registry Types
 *
 * Re-exports metadata types for consistency.
 */

// Re-export all types from the canonical location
export type {
  ToolMetadata,
  ToolSearchResult,
  BM25SearchResult,
  SmartSearchResult,
  ExtractionSchema,
  Entity,
  CustomExtractFn,
} from '../_types/metadata';

// Additional types for the registry
export interface SearchCorpusEntry {
  name: string;
  text: string;
  phrases: string[];
  relatedTools: string[];
}
