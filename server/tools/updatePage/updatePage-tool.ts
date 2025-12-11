/**
 * updatePage Tool Implementation
 *
 * Update page metadata. Use updateSection for content.
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

// ============================================================================
// Schema
// ============================================================================

export const schema = z.object({
	id: z.string().uuid().describe("Page ID to update"),
	name: z.string().optional().describe("New name"),
	slug: z.string().optional().describe("New slug"),
	parentId: z
		.string()
		.uuid()
		.optional()
		.nullable()
		.describe("New parent ID (null for root)"),
	isProtected: z.boolean().optional().describe("Change protection status"),
	meta: z
		.object({
			title: z.string().optional(),
			description: z.string().optional(),
		})
		.optional()
		.describe("New metadata"),
	indexing: z.boolean().optional().describe("Enable/disable search indexing"),
});

export type UpdatePageInput = z.infer<typeof schema>;

// ============================================================================
// Execute
// ============================================================================

export async function execute(input: UpdatePageInput, ctx: AgentContext) {
	const { id, ...updates } = input;

	const page = await ctx.services.pageService.updatePage(id, updates);

	return {
		success: true,
		count: 1,
		items: [formatPageLight(page)],
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatPageLight(page: any) {
	return {
		id: page.id,
		name: page.name,
		slug: page.slug,
		indexing: page.indexing,
		meta: page.meta,
		parentId: page.parentId || null,
		sectionCount: page.sectionCount || 0,
	};
}
