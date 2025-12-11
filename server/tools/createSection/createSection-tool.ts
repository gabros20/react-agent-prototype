/**
 * createSection Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	pageId: z.string().uuid().describe("Page ID to add section to"),
	templateKey: z
		.string()
		.describe('Section template key (e.g., "hero", "feature")'),
	content: z.record(z.string(), z.any()).optional().describe("Initial content"),
	sortOrder: z.number().optional().describe("Sort order"),
	status: z
		.enum(["published", "unpublished", "draft"])
		.optional()
		.default("published")
		.describe("Section status"),
	hidden: z.boolean().optional().describe("Hide section from rendering"),
});

export type CreateSectionInput = z.infer<typeof schema>;

export async function execute(input: CreateSectionInput, ctx: AgentContext) {
	const sectionTemplate =
		await ctx.services.sectionService.getSectionTemplateByKey(input.templateKey);
	if (!sectionTemplate) {
		return {
			success: false,
			error: `Section template "${input.templateKey}" not found. Use getSectionTemplate({ all: true }) to see available templates.`,
		};
	}

	const pageSection = await ctx.services.sectionService.addSectionToPage({
		pageId: input.pageId,
		sectionTemplateId: sectionTemplate.id,
		sortOrder: input.sortOrder,
		status: input.status || "published",
		hidden: input.hidden,
	});

	if (input.content && Object.keys(input.content).length > 0) {
		await ctx.services.sectionService.syncPageContents({
			pageSectionId: pageSection.id,
			localeCode: "en",
			content: input.content,
		});
	}

	return {
		success: true,
		count: 1,
		items: [
			{
				pageSectionId: pageSection.id,
				sectionKey: input.templateKey,
				sectionTemplateId: sectionTemplate.id,
				sortOrder: input.sortOrder || 0,
				message:
					"Section added. Use getSectionTemplate to see fields, then updateSection to add content.",
			},
		],
	};
}
