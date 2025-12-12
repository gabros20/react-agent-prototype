/**
 * deleteImage Tool Implementation
 *
 * Uses ImageService for all database operations (no direct DB access).
 */

import { z } from "zod";
import imageProcessingService from "../../services/storage/image-processing.service";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	ids: z
		.array(z.string().uuid())
		.describe("Image IDs to delete (always array, even for single)"),
	confirmed: z.boolean().optional().describe("Must be true to actually delete"),
});

export type DeleteImageInput = z.infer<typeof schema>;

export async function execute(input: DeleteImageInput, ctx: AgentContext) {
	const imageService = ctx.services.imageService;

	// Get all images to delete via service
	const imagesToDelete = await imageService.getByIds(input.ids);

	if (imagesToDelete.length === 0) {
		return { success: false, error: "No images found with provided IDs" };
	}

	if (!input.confirmed) {
		return {
			requiresConfirmation: true,
			message: `Are you sure you want to delete ${imagesToDelete.length} image(s)? This cannot be undone. Set confirmed: true to proceed.`,
			items: imagesToDelete.map((img) => ({
				id: img.id,
				filename: img.filename,
				url: imageService.getImageUrl(img),
			})),
		};
	}

	const deleted: { id: string; filename: string }[] = [];
	for (const image of imagesToDelete) {
		try {
			// Use imageProcessingService for full cleanup (files + DB via service)
			await imageProcessingService.deleteImage(image.id);
			deleted.push({ id: image.id, filename: image.filename });
		} catch {
			// Continue with remaining images
		}
	}

	return {
		success: true,
		message: `Deleted ${deleted.length} image(s)`,
		deleted,
	};
}
