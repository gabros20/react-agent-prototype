/**
 * updateEntry Tool Implementation
 *
 * Uses EntryService for all database operations (no direct DB access).
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
	const entryService = ctx.services.entryService;

	// Get entry with content via service
	const entryWithContent = await entryService.getEntryContent(
		input.id,
		input.localeCode || "en",
	);

	if (!entryWithContent) {
		return { success: false, error: `Entry not found: ${input.id}` };
	}

	// Update metadata if provided
	if (input.title || input.status) {
		await entryService.updateEntryMetadata(input.id, {
			title: input.title,
			status: input.status,
		});
	}

	// Update content if provided
	if (input.content) {
		// Get full entry record to get collectionId
		const entryRecord = await entryService.getEntryById(input.id);

		if (entryRecord) {
			await entryService.upsertEntry({
				collectionId: entryRecord.collectionId,
				slug: input.slug || entryWithContent.slug,
				title: input.title || entryWithContent.title,
				localeCode: input.localeCode || "en",
				content: {
					...entryWithContent.content,
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
