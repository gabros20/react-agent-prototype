/**
 * deleteSection Tool Implementation
 */

import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	ids: z
		.array(z.string().uuid())
		.describe("Page section IDs to delete (always array, even for single)"),
	confirmed: z.boolean().optional().describe("Must be true to actually delete"),
});

export type DeleteSectionInput = z.infer<typeof schema>;

export async function execute(input: DeleteSectionInput, ctx: AgentContext) {
	const { pageSections } = await import("../../db/schema");

	const sections = await ctx.db.query.pageSections.findMany({
		where: inArray(pageSections.id, input.ids),
	});

	if (sections.length === 0) {
		return { success: false, error: "No sections found with provided IDs" };
	}

	if (sections.length !== input.ids.length) {
		return {
			success: false,
			error: `Found ${sections.length} of ${input.ids.length} sections`,
		};
	}

	if (!input.confirmed) {
		return {
			requiresConfirmation: true,
			message: `Are you sure you want to delete ${sections.length} section(s)? This cannot be undone. Set confirmed: true to proceed.`,
			count: sections.length,
		};
	}

	for (const sectionId of input.ids) {
		await ctx.db.delete(pageSections).where(eq(pageSections.id, sectionId));
	}

	return {
		success: true,
		message: `Deleted ${input.ids.length} section(s)`,
		deletedCount: input.ids.length,
	};
}
