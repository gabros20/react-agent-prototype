/**
 * updateSection Tool Implementation
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
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
	const { pageSections, images, sectionTemplates } = await import(
		"../../db/schema"
	);

	const section = await ctx.db.query.pageSections.findFirst({
		where: eq(pageSections.id, input.pageSectionId),
	});

	if (!section) {
		return { success: false, error: "Section not found" };
	}

	if (
		input.status !== undefined ||
		input.hidden !== undefined ||
		input.sortOrder !== undefined
	) {
		const updates: any = {};
		if (input.status !== undefined) updates.status = input.status;
		if (input.hidden !== undefined) updates.hidden = input.hidden;
		if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

		await ctx.db
			.update(pageSections)
			.set(updates)
			.where(eq(pageSections.id, input.pageSectionId));
	}

	if (input.imageId && input.imageField) {
		const sectionTemplate = await ctx.db.query.sectionTemplates.findFirst({
			where: eq(sectionTemplates.id, section.sectionTemplateId),
		});

		if (sectionTemplate) {
			const fields =
				typeof sectionTemplate.fields === "string"
					? JSON.parse(sectionTemplate.fields)
					: sectionTemplate.fields;

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

		const image = await ctx.db.query.images.findFirst({
			where: eq(images.id, input.imageId),
			with: { metadata: true },
		});

		if (!image || !image.filePath) {
			return { success: false, error: "Image not found or has no file path" };
		}

		const imageUrl = `/uploads/${image.filePath}`;
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
