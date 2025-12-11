/**
 * getPage Tool Implementation
 *
 * Unified read tool for pages - by id, slug, or all.
 * Following ATOMIC_CRUD_TOOL_ARCHITECTURE.md patterns:
 * - Scope selection via mutually exclusive params (id/slug/all)
 * - Unified response format with items array
 * - Parameter-based modifiers (includeContent, parentId)
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

// ============================================================================
// Schema
// ============================================================================

export const schema = z
	.object({
		// Scope selection (one of these)
		id: z.string().uuid().optional().describe("Get by UUID"),
		slug: z.string().optional().describe("Get by slug"),
		all: z.boolean().optional().describe("Get all pages"),

		// Modifiers (from production alignment)
		parentId: z
			.string()
			.uuid()
			.optional()
			.describe("Filter by parent page (for hierarchy)"),
		includeChildren: z
			.boolean()
			.optional()
			.describe("Include child pages in response"),
		includeContent: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include full section content (expensive)"),
		localeCode: z
			.string()
			.optional()
			.default("en")
			.describe("Locale code for content"),
	})
	.refine((data) => data.id || data.slug || data.all || data.parentId, {
		message: "Provide id, slug, parentId, or set all: true",
	});

export type GetPageInput = z.infer<typeof schema>;

// ============================================================================
// Execute
// ============================================================================

export async function execute(input: GetPageInput, ctx: AgentContext) {
	// Case 1: Get single by ID
	if (input.id) {
		const page = await ctx.services.pageService.getPageById(input.id);
		if (!page) {
			return {
				success: false,
				count: 0,
				items: [],
				error: `Page not found: ${input.id}`,
			};
		}

		if (input.includeContent) {
			const fullPage = await ctx.services.pageService.getPageBySlug(
				page.slug,
				true,
				input.localeCode || "en",
			);
			return {
				success: true,
				count: 1,
				items: [formatPageFull(fullPage)],
			};
		}

		return {
			success: true,
			count: 1,
			items: [formatPageLight(page)],
		};
	}

	// Case 2: Get single by slug
	if (input.slug) {
		const page = await ctx.services.pageService.getPageBySlug(
			input.slug,
			input.includeContent || false,
			input.localeCode || "en",
		);

		if (!page) {
			return {
				success: false,
				count: 0,
				items: [],
				error: `Page not found: ${input.slug}`,
			};
		}

		if (input.includeContent) {
			return {
				success: true,
				count: 1,
				items: [formatPageFull(page)],
			};
		}

		return {
			success: true,
			count: 1,
			items: [formatPageLight(page)],
		};
	}

	// Case 3: Get all pages (with optional parentId filter)
	if (input.all || input.parentId !== undefined) {
		const allPages = await ctx.services.pageService.listPages();

		// Filter by parentId if provided
		let filteredPages = allPages;
		if (input.parentId !== undefined) {
			// parentId: 'null' or undefined means root pages, otherwise filter by parent
			filteredPages = allPages.filter(
				(p: any) => p.parentId === input.parentId,
			);
		}

		return {
			success: true,
			count: filteredPages.length,
			items: filteredPages.map((p: any) => formatPageLight(p)),
		};
	}

	return {
		success: false,
		count: 0,
		items: [],
		error: "Provide id, slug, parentId, or set all: true",
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

function formatPageFull(page: any) {
	return {
		id: page.id,
		name: page.name,
		slug: page.slug,
		indexing: page.indexing,
		meta: page.meta,
		parentId: page.parentId || null,
		sections:
			page.pageSections?.map((ps: any) => ({
				id: ps.id,
				sectionTemplateId: ps.sectionTemplateId,
				sectionKey: ps.sectionTemplate?.key,
				sectionName: ps.sectionTemplate?.name,
				sortOrder: ps.sortOrder,
				content: ps.content || {},
			})) || [],
	};
}
