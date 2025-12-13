/**
 * updateSection Tool Implementation
 *
 * Uses SectionService and ImageService for all database operations (no direct DB access).
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z
	.object({
		pageSectionId: z.string().uuid().describe("Page section ID to update"),
		content: z
			.record(z.string(), z.any())
			.optional()
			.describe("Content to merge (only send fields to change)"),
		imageId: z.string().uuid().optional().describe("Image ID to attach"),
		imageField: z
			.string()
			.optional()
			.describe('Field name for image (e.g., "backgroundImage", "image")'),
		status: z
			.enum(["published", "unpublished", "draft"])
			.optional()
			.describe("Change section status"),
		hidden: z.boolean().optional().describe("Change visibility"),
		sortOrder: z.number().optional().describe("Change sort order"),
		localeCode: z.string().optional().default("en").describe("Locale code"),
	})
	.refine(
		(data) =>
			data.content ||
			(data.imageId && data.imageField) ||
			data.status !== undefined ||
			data.hidden !== undefined ||
			data.sortOrder !== undefined,
		{
			message:
				"Provide content, imageId+imageField, status, hidden, or sortOrder",
		},
	);

export type UpdateSectionInput = z.infer<typeof schema>;

export async function execute(input: UpdateSectionInput, ctx: AgentContext) {
	// Use service to get section (not direct DB access)
	const section = await ctx.services.sectionService.getPageSectionById(input.pageSectionId);

	if (!section) {
		return { success: false, error: "Section not found" };
	}

	// Update metadata fields via service
	if (
		input.status !== undefined ||
		input.hidden !== undefined ||
		input.sortOrder !== undefined
	) {
		const updates: {
			status?: 'published' | 'unpublished' | 'draft';
			hidden?: boolean;
			sortOrder?: number;
		} = {};
		if (input.status !== undefined) updates.status = input.status;
		if (input.hidden !== undefined) updates.hidden = input.hidden;
		if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

		await ctx.services.sectionService.updatePageSection(input.pageSectionId, updates);
	}

	// Handle image attachment
	if (input.imageId && input.imageField) {
		// Get section template to validate image field
		const sectionTemplate = await ctx.services.sectionService.getSectionTemplateById(
			section.sectionTemplateId
		);

		if (sectionTemplate) {
			let fields: { rows?: { slots?: { type: string; key: string }[] }[] } | null = null;
			try {
				fields =
					typeof sectionTemplate.fields === "string"
						? JSON.parse(sectionTemplate.fields)
						: sectionTemplate.fields;
			} catch (parseError) {
				return {
					success: false,
					error: `Failed to parse section template fields: ${(parseError as Error).message}`,
				};
			}

			const imageFields: string[] = [];
			if (fields?.rows) {
				for (const row of fields.rows) {
					if (row.slots) {
						for (const slot of row.slots) {
							if (slot.type === "image") {
								imageFields.push(slot.key);
							}
						}
					}
				}
			}

			if (imageFields.length > 0 && !imageFields.includes(input.imageField)) {
				return {
					success: false,
					error: `Field "${input.imageField}" not found. Available image fields: ${imageFields.join(", ")}`,
					availableImageFields: imageFields,
				};
			}
		}

		// Get image via ImageService
		const image = await ctx.services.imageService.getById(input.imageId);

		if (!image || !image.filePath) {
			return { success: false, error: "Image not found or has no file path" };
		}

		const imageUrl = ctx.services.imageService.getImageUrl(image) || `/uploads/${image.filePath}`;
		const altText = image.metadata?.description || image.originalFilename;

		const contentUpdate = {
			...(input.content || {}),
			[input.imageField]: { url: imageUrl, alt: altText },
		};

		await ctx.services.sectionService.syncPageContents({
			pageSectionId: input.pageSectionId,
			localeCode: input.localeCode || "en",
			content: contentUpdate,
		});

		return {
			success: true,
			message: `Updated section with image: ${image.originalFilename}`,
			imageUrl,
			altText,
		};
	}

	// Update content via service
	if (input.content) {
		await ctx.services.sectionService.syncPageContents({
			pageSectionId: input.pageSectionId,
			localeCode: input.localeCode || "en",
			content: input.content,
		});
	}

	return {
		success: true,
		message: "Section updated",
	};
}
