/**
 * Tool Metadata Types
 *
 * Type definitions for tool metadata used by the discovery/search system.
 * Moved from server/tools/discovery/types.ts as part of prompt system refactor.
 */

import { z } from "zod";

// ============================================================================
// Extraction Schema (for working memory entity extraction)
// ============================================================================

export const ExtractionSchemaZ = z.object({
	path: z.string(), // Where to find data: "image", "images", "$root", "page"
	type: z.string(), // Entity type: "image", "page", "section", "post"
	nameField: z.string(), // Field for display name: "filename", "name", "title"
	idField: z.string().optional(), // Field for ID (default: "id")
	isArray: z.boolean().optional(), // Multiple entities? (default: false)
});

export type ExtractionSchema = z.infer<typeof ExtractionSchemaZ>;

// ============================================================================
// Tool Metadata Schema
// ============================================================================

export const ToolMetadataSchema = z.object({
	name: z.string(),
	description: z.string().optional(), // Tool description (short, for AI SDK)
	phrases: z.array(z.string()), // Search phrases: "find image", "create page"
	relatedTools: z.array(z.string()), // Often used together
	riskLevel: z.enum(["safe", "moderate", "destructive"]),
	requiresConfirmation: z.boolean(),
	extraction: ExtractionSchemaZ.nullable(), // null = no extraction (side effects, external APIs)
});

export type ToolMetadata = z.infer<typeof ToolMetadataSchema>;

// ============================================================================
// Entity (extracted from tool results for working memory)
// ============================================================================

export interface Entity {
	type: string;
	id: string;
	name: string;
	timestamp: Date;
}

// ============================================================================
// Custom Extractor Function (for dynamic-type tools)
// ============================================================================

export type CustomExtractFn = (result: unknown) => Entity[];

// ============================================================================
// Tool Search Result
// ============================================================================

export interface ToolSearchResult {
	name: string;
	score: number;
	relatedTools?: string[];
}

// ============================================================================
// BM25 Search Result
// ============================================================================

export interface BM25SearchResult {
	tools: ToolSearchResult[];
	confidence: number; // 0-1, higher = more confident in BM25 results
}

// ============================================================================
// Smart/Hybrid Search Result
// ============================================================================

export interface SmartSearchResult {
	tools: ToolSearchResult[];
	confidence: number;
	source: "bm25" | "vector" | "blended";
}

// ============================================================================
// Helper for defining tool metadata with type safety
// ============================================================================

/**
 * Helper function to define tool metadata with type checking.
 * Use this in per-tool metadata files for autocomplete and validation.
 *
 * @example
 * export default defineToolMetadata({
 *   name: 'getPage',
 *   description: 'Get page(s) by id, slug, or all',
 *   phrases: ['get page', 'find page', 'list pages'],
 *   relatedTools: ['getSection', 'updateSection'],
 *   riskLevel: 'safe',
 *   requiresConfirmation: false,
 *   extraction: {
 *     path: 'items',
 *     type: 'page',
 *     nameField: 'name',
 *     isArray: true,
 *   },
 * })
 */
export function defineToolMetadata(metadata: ToolMetadata): ToolMetadata {
	// Validate at runtime in dev mode
	if (process.env.NODE_ENV !== "production") {
		ToolMetadataSchema.parse(metadata);
	}
	return metadata;
}
