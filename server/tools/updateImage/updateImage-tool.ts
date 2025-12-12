/**
 * updateImage Tool Implementation
 *
 * Uses ImageService for all database operations (no direct DB access).
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	id: z.string().uuid().describe("Image ID to update"),
	description: z.string().optional().describe("New description"),
	tags: z.array(z.string()).optional().describe("New tags"),
	categories: z.array(z.string()).optional().describe("New categories"),
});

export type UpdateImageInput = z.infer<typeof schema>;

export async function execute(input: UpdateImageInput, ctx: AgentContext) {
	const imageService = ctx.services.imageService;

	// Check if image exists via service
	const image = await imageService.getById(input.id);

	if (!image) {
		return { success: false, error: `Image not found: ${input.id}` };
	}

	// Update metadata via service
	const success = await imageService.updateMetadata(input.id, {
		description: input.description,
		tags: input.tags,
		categories: input.categories,
	});

	if (!success) {
		return { success: false, error: "Failed to update image metadata" };
	}

	return {
		success: true,
		message: "Image metadata updated",
		id: input.id,
	};
}
