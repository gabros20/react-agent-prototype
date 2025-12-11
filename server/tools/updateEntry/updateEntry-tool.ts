/**
 * updateEntry Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	id: z.string().uuid().describe("Entry ID to update"),
	slug: z.string().optional().describe("New slug"),
	title: z.string().optional().describe("New title"),
	content: z
		.record(z.string(), z.any())
		.optional()
		.describe("New content (merges with existing)"),
	status: z
		.enum(["draft", "published", "archived"])
		.optional()
		.describe("New status"),
	localeCode: z.string().optional().default("en").describe("Locale code"),
});

export type UpdateEntryInput = z.infer<typeof schema>;

export async function execute(input: UpdateEntryInput, ctx: AgentContext) {
	const entry = (await ctx.services.entryService.getEntryContent(
		input.id,
		input.localeCode || "en",
	)) as any;
	if (!entry) {
		return { success: false, error: `Entry not found: ${input.id}` };
	}

	if (input.title || input.status) {
		await ctx.services.entryService.updateEntryMetadata(input.id, {
			title: input.title,
			status: input.status,
		});
	}

	if (input.content) {
		const entryRecord = await ctx.db.query.collectionEntries.findFirst({
			where: (entries, { eq }) => eq(entries.id, input.id),
		});

		if (entryRecord) {
			await ctx.services.entryService.upsertEntry({
				collectionId: entryRecord.collectionId,
				slug: input.slug || entry.slug,
				title: input.title || entry.title,
				localeCode: input.localeCode || "en",
				content: {
					...entry.content,
					...input.content,
				},
			});
		}
	}

	return {
		success: true,
		message: "Entry updated",
		id: input.id,
	};
}
