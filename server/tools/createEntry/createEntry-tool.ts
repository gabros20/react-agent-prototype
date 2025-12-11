/**
 * createEntry Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	collectionId: z.string().uuid().describe("Collection ID"),
	slug: z.string().describe("Entry slug"),
	title: z.string().describe("Entry title"),
	content: z.record(z.string(), z.any()).optional().describe("Entry content"),
	status: z
		.enum(["draft", "published"])
		.optional()
		.default("draft")
		.describe("Initial status"),
	localeCode: z.string().optional().default("en").describe("Locale code"),
});

export type CreateEntryInput = z.infer<typeof schema>;

export async function execute(input: CreateEntryInput, ctx: AgentContext) {
	const entry = await ctx.services.entryService.upsertEntry({
		collectionId: input.collectionId,
		slug: input.slug,
		title: input.title,
		localeCode: input.localeCode || "en",
		content: input.content || {},
	});

	return {
		success: true,
		count: 1,
		items: [
			{
				id: entry.id,
				slug: entry.slug,
				title: entry.title,
				status: entry.status || "draft",
			},
		],
	};
}
