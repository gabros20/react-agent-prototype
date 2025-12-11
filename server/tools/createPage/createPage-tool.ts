/**
 * createPage Tool Implementation
 *
 * Create new empty page. Add sections with createSection.
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

// ============================================================================
// Schema
// ============================================================================

export const schema = z.object({
	name: z.string().describe('Page name (e.g., "About Us")'),
	slug: z.string().describe('URL-friendly slug (e.g., "about-us")'),
	parentId: z.string().uuid().optional().describe("Parent page ID for hierarchy"),
	isProtected: z.boolean().optional().describe("Mark as protected/default page"),
	meta: z
		.object({
			title: z.string().optional(),
			description: z.string().optional(),
		})
		.optional()
		.describe("Page metadata"),
	indexing: z.boolean().optional().default(true).describe("Enable search indexing"),
});

export type CreatePageInput = z.infer<typeof schema>;

// ============================================================================
// Execute
// ============================================================================

export async function execute(input: CreatePageInput, ctx: AgentContext) {
	const { siteId, environmentId } = ctx.cmsTarget || {
		siteId: "default-site",
		environmentId: "main",
	};

	const page = await ctx.services.pageService.createPage({
		name: input.name,
		slug: input.slug,
		siteId,
		environmentId,
		indexing: input.indexing ?? true,
		meta: input.meta,
		// parentId and isProtected will be added when DB schema supports them
	});

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
