/**
 * updatePost Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	slug: z.string().describe("Post slug to update"),
	title: z.string().optional().describe("New title"),
	content: z
		.object({
			body: z.string().optional(),
			cover: z
				.object({
					url: z.string(),
					alt: z.string(),
				})
				.optional(),
			tags: z.array(z.string()).optional(),
		})
		.optional()
		.describe("New content (merges with existing)"),
	status: z
		.enum(["draft", "published", "archived"])
		.optional()
		.describe("New status (requires confirmed for publish/archive)"),
	author: z.string().optional().describe("New author"),
	excerpt: z.string().optional().describe("New excerpt"),
	featuredImage: z.string().optional().describe("New featured image URL"),
	category: z.string().optional().describe("New category"),
	localeCode: z.string().optional().default("en").describe("Locale code"),
	confirmed: z
		.boolean()
		.optional()
		.describe("Required for status changes to published/archived"),
});

export type UpdatePostInput = z.infer<typeof schema>;

export async function execute(input: UpdatePostInput, ctx: AgentContext) {
	const entry = await ctx.services.entryService.getEntryBySlug(
		input.slug,
		input.localeCode || "en",
	);
	if (!entry) {
		return { success: false, error: `Post "${input.slug}" not found` };
	}

	if (input.status && input.status !== entry.status) {
		if (!input.confirmed) {
			const action =
				input.status === "published"
					? "publish"
					: input.status === "archived"
						? "archive"
						: "change status of";
			return {
				requiresConfirmation: true,
				message: `Are you sure you want to ${action} "${entry.title}"? Set confirmed: true to proceed.`,
				items: [
					{
						slug: entry.slug,
						title: entry.title,
						currentStatus: entry.status,
						newStatus: input.status,
					},
				],
			};
		}

		if (input.status === "published") {
			const published = await ctx.services.entryService.publishEntry(entry.id);
			if (!published) {
				return {
					success: false,
					error: `Failed to publish post: ${entry.slug}`,
				};
			}
		}

		if (input.status === "archived") {
			await ctx.services.entryService.archiveEntry(entry.id);
		}
	}

	let featuredImageToUpdate = input.featuredImage;
	if (input.content?.cover?.url && !featuredImageToUpdate) {
		featuredImageToUpdate = input.content.cover.url;
	}

	if (
		input.title ||
		input.author ||
		input.excerpt ||
		featuredImageToUpdate ||
		input.category ||
		input.status
	) {
		await ctx.services.entryService.updateEntryMetadata(entry.id, {
			title: input.title,
			author: input.author,
			excerpt: input.excerpt,
			featuredImage: featuredImageToUpdate,
			category: input.category,
			status: input.status,
		});
	}

	if (input.content) {
		const collection = await ctx.services.entryService.getCollectionTemplateById(
			entry.collection.id,
		);
		await ctx.services.entryService.upsertEntry({
			collectionId: collection!.id,
			slug: entry.slug,
			title: input.title || entry.title,
			localeCode: input.localeCode || "en",
			content: {
				...entry.content,
				...input.content,
			},
		});
	}

	const updated = await ctx.services.entryService.getEntryBySlug(
		input.slug,
		input.localeCode || "en",
	);

	return {
		success: true,
		count: 1,
		items: [
			{
				id: entry.id,
				slug: entry.slug,
				title: input.title || entry.title,
				status: updated?.status || entry.status,
				message: "Post updated successfully",
			},
		],
	};
}
