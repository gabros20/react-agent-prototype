/**
 * getSection Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z
	.object({
		pageSectionId: z
			.string()
			.uuid()
			.optional()
			.describe("Get single section by page-section ID"),
		pageId: z.string().uuid().optional().describe("Get all sections on a page"),
		includeContent: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include full section content"),
		localeCode: z
			.string()
			.optional()
			.default("en")
			.describe("Locale code for content"),
	})
	.refine((data) => data.pageSectionId || data.pageId, {
		message: "Provide pageSectionId or pageId",
	});

export type GetSectionInput = z.infer<typeof schema>;

export async function execute(input: GetSectionInput, ctx: AgentContext) {
	if (input.pageSectionId) {
		const result = await ctx.services.sectionService.getSectionContent(
			input.pageSectionId,
			input.localeCode || "en",
		);
		return {
			success: true,
			count: 1,
			items: [result],
		};
	}

	if (input.pageId) {
		const sections = await ctx.services.sectionService.getPageSections(
			input.pageId,
			input.includeContent || false,
			input.localeCode || "en",
		);
		return {
			success: true,
			count: sections.length,
			pageId: input.pageId,
			items: sections,
		};
	}

	return {
		success: false,
		count: 0,
		items: [],
		error: "Provide pageSectionId or pageId",
	};
}
