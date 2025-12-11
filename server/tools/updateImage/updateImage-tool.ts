/**
 * updateImage Tool Implementation
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { images, imageMetadata } from "../../db/schema";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	id: z.string().uuid().describe("Image ID to update"),
	description: z.string().optional().describe("New description"),
	tags: z.array(z.string()).optional().describe("New tags"),
	categories: z.array(z.string()).optional().describe("New categories"),
});

export type UpdateImageInput = z.infer<typeof schema>;

export async function execute(input: UpdateImageInput, ctx: AgentContext) {
	const image = await ctx.db.query.images.findFirst({
		where: eq(images.id, input.id),
		with: { metadata: true },
	});

	if (!image) {
		return { success: false, error: `Image not found: ${input.id}` };
	}

	const updates: any = {};
	if (input.description !== undefined) updates.description = input.description;
	if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
	if (input.categories !== undefined)
		updates.categories = JSON.stringify(input.categories);

	if (image.metadata) {
		await ctx.db
			.update(imageMetadata)
			.set(updates)
			.where(eq(imageMetadata.imageId, input.id));
	}

	return {
		success: true,
		message: "Image metadata updated",
		id: input.id,
	};
}
