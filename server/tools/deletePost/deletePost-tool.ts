/**
 * deletePost Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	slugs: z
		.array(z.string())
		.describe("Post slugs to delete (always array, even for single)"),
	confirmed: z.boolean().optional().describe("Must be true to actually delete"),
});

export type DeletePostInput = z.infer<typeof schema>;

export async function execute(input: DeletePostInput, ctx: AgentContext) {
	const postsToDelete: any[] = [];
	for (const slug of input.slugs) {
		const entry = await ctx.services.entryService.getEntryBySlug(slug);
		if (entry) {
			postsToDelete.push(entry);
		}
	}

	if (postsToDelete.length === 0) {
		return { success: false, error: "No posts found with provided slugs" };
	}

	if (!input.confirmed) {
		return {
			requiresConfirmation: true,
			message: `Are you sure you want to PERMANENTLY DELETE ${postsToDelete.length} post(s)? This cannot be undone. Consider using status: 'archived' instead. Set confirmed: true to proceed.`,
			items: postsToDelete.map((p) => ({
				slug: p.slug,
				title: p.title,
				status: p.status,
			})),
		};
	}

	const deleted: any[] = [];
	for (const post of postsToDelete) {
		await ctx.services.entryService.deleteEntry(post.id);
		deleted.push({ slug: post.slug, title: post.title });
	}

	return {
		success: true,
		message: `Deleted ${deleted.length} post(s) permanently`,
		deleted,
	};
}
