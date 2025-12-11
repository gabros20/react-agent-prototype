/**
 * getEntry Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z
	.object({
		id: z.string().uuid().optional().describe("Get single entry by UUID"),
		slug: z.string().optional().describe("Get single entry by slug"),
		collectionId: z
			.string()
			.uuid()
			.optional()
			.describe("Get all entries in collection"),
		all: z.boolean().optional().describe("Get all entries (requires collectionId)"),
		includeContent: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include full entry content"),
		status: z
			.enum(["draft", "published", "archived"])
			.optional()
			.describe("Filter by status"),
		localeCode: z.string().optional().default("en").describe("Locale code"),
	})
	.refine((data) => data.id || data.slug || data.collectionId, {
		message: "Provide id, slug, or collectionId",
	});

export type GetEntryInput = z.infer<typeof schema>;

export async function execute(input: GetEntryInput, ctx: AgentContext) {
	if (input.id) {
		const entry = await ctx.services.entryService.getEntryContent(
			input.id,
			input.localeCode || "en",
		);
		if (!entry) {
			return {
				success: false,
				count: 0,
				items: [],
				error: `Entry not found: ${input.id}`,
			};
		}
		return {
			success: true,
			count: 1,
			items: [entry],
		};
	}

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
				error: `Entry not found: ${input.slug}`,
			};
		}
		return {
			success: true,
			count: 1,
			items: [formatEntry(entry, input.includeContent)],
		};
	}

	if (input.collectionId) {
		let entries = await ctx.services.entryService.getCollectionEntries(
			input.collectionId,
			input.includeContent || false,
			input.localeCode || "en",
		);

		if (input.status) {
			entries = entries.filter((e: any) => e.status === input.status);
		}

		return {
			success: true,
			count: entries.length,
			collectionId: input.collectionId,
			items: entries.map((e: any) => formatEntry(e, input.includeContent)),
		};
	}

	return {
		success: false,
		count: 0,
		items: [],
		error: "Provide id, slug, or collectionId",
	};
}

function formatEntry(entry: any, includeContent?: boolean) {
	const base = {
		id: entry.id,
		slug: entry.slug,
		title: entry.title,
		status: entry.status,
		createdAt: entry.createdAt,
	};

	if (includeContent) {
		return {
			...base,
			content: entry.content,
			collection: entry.collection,
		};
	}

	return base;
}
