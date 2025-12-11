/**
 * createPost Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	collectionSlug: z
		.string()
		.default("blog")
		.describe('Collection slug (default: "blog")'),
	slug: z.string().describe("URL-friendly post slug"),
	title: z.string().describe("Post title"),
	content: z
		.object({
			body: z.string().describe("Post body (supports markdown)"),
			cover: z
				.object({
					url: z.string(),
					alt: z.string(),
				})
				.optional()
				.describe("Cover image"),
			tags: z.array(z.string()).optional().describe("Post tags"),
		})
		.describe("Post content"),
	author: z.string().optional().describe("Author name"),
	excerpt: z.string().optional().describe("Short summary/excerpt"),
	featuredImage: z.string().optional().describe("Featured image URL"),
	category: z.string().optional().describe("Post category"),
	localeCode: z.string().optional().default("en").describe("Locale code"),
});

export type CreatePostInput = z.infer<typeof schema>;

export async function execute(input: CreatePostInput, ctx: AgentContext) {
	const collection =
		await ctx.services.entryService.getCollectionTemplateBySlug(
			input.collectionSlug || "blog",
		);
	if (!collection) {
		return {
			success: false,
			error: `Collection "${input.collectionSlug}" not found`,
		};
	}

	const entry = await ctx.services.entryService.upsertEntry({
		collectionId: collection.id,
		slug: input.slug,
		title: input.title,
		localeCode: input.localeCode || "en",
		content: input.content,
		author: input.author,
		excerpt: input.excerpt,
		featuredImage: input.featuredImage,
		category: input.category,
	});

	return {
		success: true,
		count: 1,
		items: [
			{
				id: entry.id,
				slug: entry.slug,
				title: entry.title,
				status: "draft",
				message:
					'Post created as draft. Use updatePost with status: "published" to publish.',
			},
		],
	};
}
