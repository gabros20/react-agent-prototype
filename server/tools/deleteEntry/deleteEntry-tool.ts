/**
 * deleteEntry Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	ids: z
		.array(z.string().uuid())
		.describe("Entry IDs to delete (always array, even for single)"),
	confirmed: z.boolean().optional().describe("Must be true to actually delete"),
});

export type DeleteEntryInput = z.infer<typeof schema>;

export async function execute(input: DeleteEntryInput, ctx: AgentContext) {
	const entriesToDelete: any[] = [];
	for (const id of input.ids) {
		const entry = await ctx.services.entryService.getEntryContent(id, "en");
		if (entry) {
			entriesToDelete.push(entry);
		}
	}

	if (entriesToDelete.length === 0) {
		return { success: false, error: "No entries found with provided IDs" };
	}

	if (!input.confirmed) {
		return {
			requiresConfirmation: true,
			message: `Are you sure you want to delete ${entriesToDelete.length} entry(s)? This cannot be undone. Set confirmed: true to proceed.`,
			items: entriesToDelete.map((e) => ({
				id: e.id,
				slug: e.slug,
				title: e.title,
			})),
		};
	}

	const deleted: any[] = [];
	for (const entry of entriesToDelete) {
		await ctx.services.entryService.deleteEntry(entry.id);
		deleted.push({ id: entry.id, slug: entry.slug, title: entry.title });
	}

	return {
		success: true,
		message: `Deleted ${deleted.length} entry(s)`,
		deleted,
	};
}
