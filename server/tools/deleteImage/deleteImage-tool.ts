/**
 * deleteImage Tool Implementation
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { images } from "../../db/schema";
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
	const imagesToDelete: any[] = [];
	for (const id of input.ids) {
		const image = await ctx.db.query.images.findFirst({
			where: eq(images.id, id),
			with: { metadata: true },
		});
		if (image) {
			imagesToDelete.push(image);
		}
	}

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
				url:
					img.cdnUrl ?? (img.filePath ? `/uploads/${img.filePath}` : undefined),
			})),
		};
	}

	const deleted: any[] = [];
	for (const image of imagesToDelete) {
		try {
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
