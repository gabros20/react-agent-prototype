/**
 * Custom Entity Extractors
 *
 * Special extractors for tools with dynamic return types.
 * Implements Phase 7.5.2 from DYNAMIC_TOOL_INJECTION_PLAN.md
 */

import type { Entity, CustomExtractFn } from "./types";

// Placeholder - implementation in Phase 7
export function extractFromFindResource(_result: unknown): Entity[] {
	return [];
}

export function extractFromVectorSearch(_result: unknown): Entity[] {
	return [];
}

export const CUSTOM_EXTRACTORS: Record<string, CustomExtractFn> = {
	cms_findResource: extractFromFindResource,
	search_vector: extractFromVectorSearch,
};
