/**
 * deletePage Tool Implementation
 *
 * Delete page(s) and all sections. Array param. Requires confirmed.
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

// ============================================================================
// Schema
// ============================================================================

export const schema = z.object({
	ids: z
		.array(z.string().uuid())
		.describe("Page IDs to delete (always array, even for single)"),
	removeFromNavigation: z
		.boolean()
		.optional()
		.describe("Also remove from navigation if present"),
	confirmed: z.boolean().optional().describe("Must be true to actually delete"),
});

export type DeletePageInput = z.infer<typeof schema>;

// ============================================================================
// Execute
// ============================================================================

export async function execute(input: DeletePageInput, ctx: AgentContext) {
	// Get all pages to show what will be deleted
	const pagesToDelete: any[] = [];
	for (const id of input.ids) {
		const page = await ctx.services.pageService.getPageById(id);
		if (page) {
			pagesToDelete.push(page);
		}
	}

	if (pagesToDelete.length === 0) {
		return { success: false, error: "No pages found with provided IDs" };
	}

	// Require confirmation
	if (!input.confirmed) {
		return {
			requiresConfirmation: true,
			message: `Are you sure you want to delete ${pagesToDelete.length} page(s)? This will permanently remove the page(s) and all sections. Set confirmed: true to proceed.`,
			items: pagesToDelete.map((p) => ({
				id: p.id,
				name: p.name,
				slug: p.slug,
			})),
		};
	}

	// Delete each page
	const deleted: any[] = [];
	for (const page of pagesToDelete) {
		await ctx.services.pageService.deletePage(page.id);
		deleted.push({ id: page.id, name: page.name, slug: page.slug });
	}

	return {
		success: true,
		message: `Deleted ${deleted.length} page(s)`,
		deleted,
	};
}
