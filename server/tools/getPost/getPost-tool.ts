/**
 * getPost Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z
	.object({
		slug: z.string().optional().describe("Get single post by slug"),
		all: z.boolean().optional().describe("Get all posts"),
		collectionSlug: z
			.string()
			.optional()
			.default("blog")
			.describe('Collection slug (default: "blog")'),
		status: z
			.enum(["draft", "published", "archived", "all"])
			.optional()
			.default("published")
			.describe("Filter by status (default: published)"),
		category: z.string().optional().describe("Filter by category"),
		localeCode: z.string().optional().default("en").describe("Locale code"),
	})
	.refine((data) => data.slug || data.all, {
		message: "Provide slug or set all: true",
	});

export type GetPostInput = z.infer<typeof schema>;

export async function execute(input: GetPostInput, ctx: AgentContext) {
	if (input.slug) {
		const entry = await ctx.services.entryService.getEntryBySlug(
			input.slug,
			input.localeCode || "en",
		);

		if (!entry) {
			return {
				success: false,
				count: 0,
				items: [],
				error: `Post not found: ${input.slug}`,
			};
		}

		return {
			success: true,
			count: 1,
			items: [formatPostFull(entry)],
		};
	}

	if (input.all) {
		const collectionSlug = input.collectionSlug || "blog";

		const collection =
			await ctx.services.entryService.getCollectionTemplateBySlug(
				collectionSlug,
			);
		if (!collection) {
			return {
				success: false,
				count: 0,
				items: [],
				error: `Collection "${collectionSlug}" not found`,
			};
		}

		let entries: any[];

		if (input.category) {
			entries = await ctx.services.entryService.getEntriesByCategory(
				collection.id,
				input.category,
				input.localeCode || "en",
			);
		} else if (input.status === "published" || input.status === undefined) {
			entries = await ctx.services.entryService.listPublishedEntries(
				collection.id,
				input.localeCode || "en",
			);
		} else if (input.status === "all") {
			entries = await ctx.services.entryService.getCollectionEntries(
				collection.id,
				true,
				input.localeCode || "en",
			);
		} else {
			const allEntries = await ctx.services.entryService.getCollectionEntries(
				collection.id,
				true,
				input.localeCode || "en",
			);
			entries = allEntries.filter((e: any) => e.status === input.status);
		}

		return {
			success: true,
			count: entries.length,
			items: entries.map((e: any) => formatPostLight(e)),
			collection: {
				slug: collection.slug,
				name: collection.name,
			},
			filters: {
				status: input.status || "published",
				category: input.category || null,
			},
		};
	}

	return {
		success: false,
		count: 0,
		items: [],
		error: "Provide slug or set all: true",
	};
}

function formatPostLight(entry: any) {
	const cover = entry.content?.cover;
	return {
		id: entry.id,
		slug: entry.slug,
		title: entry.title,
		status: entry.status,
		author: entry.author,
		excerpt: entry.excerpt,
		featuredImage: entry.featuredImage,
		coverImage: cover || null,
		category: entry.category,
		publishedAt: entry.publishedAt,
		createdAt: entry.createdAt,
	};
}

function formatPostFull(entry: any) {
	return {
		id: entry.id,
		slug: entry.slug,
		title: entry.title,
		status: entry.status,
		author: entry.author,
		excerpt: entry.excerpt,
		featuredImage: entry.featuredImage,
		category: entry.category,
		publishedAt: entry.publishedAt,
		createdAt: entry.createdAt,
		content: entry.content,
		collection: {
			slug: entry.collection.slug,
			name: entry.collection.name,
		},
	};
}
