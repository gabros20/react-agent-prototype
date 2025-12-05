/**
 * Discovery Module Types
 *
 * Type definitions for dynamic tool injection system.
 * Implements Phase 1.1 from DYNAMIC_TOOL_INJECTION_PLAN.md
 */

import { z } from "zod";

// ============================================================================
// Tool Categories
// ============================================================================

export const ToolCategorySchema = z.enum([
	"pages",
	"sections",
	"images",
	"posts",
	"navigation",
	"entries",
	"search",
	"research",
	"pexels",
	"http",
	"site-settings",
	"planning",
	"response-format", // Meta-rule for presenting images/content to users
]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

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
	description: z.string(),
	category: ToolCategorySchema,
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
	category: ToolCategory;
	description: string;
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
