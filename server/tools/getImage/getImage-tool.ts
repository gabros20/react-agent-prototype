/**
 * getImage Tool Implementation
 *
 * Uses ImageService for all database operations (no direct DB access).
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z
	.object({
		id: z.string().uuid().optional().describe("Get single image by UUID"),
		query: z
			.string()
			.optional()
			.describe(
				'Semantic search query (expand short queries: "AI" → "artificial intelligence technology")',
			),
		all: z.boolean().optional().describe("Get all images"),
		limit: z
			.number()
			.optional()
			.describe("Max results (default: 5 for query, 50 for all)"),
		status: z
			.enum(["completed", "processing", "failed"])
			.optional()
			.describe("Filter by processing status"),
		minScore: z
			.number()
			.optional()
			.describe("Minimum similarity score for query (default: -0.7)"),
	})
	.refine((data) => data.id || data.query || data.all, {
		message: "Provide id, query, or set all: true",
	});

export type GetImageInput = z.infer<typeof schema>;

export async function execute(input: GetImageInput, ctx: AgentContext) {
	const imageService = ctx.services.imageService;

	if (input.id) {
		const image = await imageService.getById(input.id);

		if (!image) {
			return {
				success: false,
				count: 0,
				items: [],
				error: `Image not found: ${input.id}`,
			};
		}

		return {
			success: true,
			count: 1,
			items: [imageService.formatImage(image)],
		};
	}

	if (input.query) {
		const limit = input.limit || 5;
		const minScore = input.minScore ?? -0.7;

		try {
			const { results } = await imageService.search(input.query, {
				limit,
				minScore,
			});

			const finalResults = results.map((r) => ({
				...r,
				relevance:
					r.description && r.description.length > 0
						? "strong"
						: "moderate",
			}));

			return {
				success: true,
				count: finalResults.length,
				query: input.query,
				items: finalResults,
				hint:
					finalResults.length === 0
						? "No images matched. Try different keywords or lower minScore."
						: "Matches found - verify they fit user intent.",
			};
		} catch (error) {
			return {
				success: false,
				count: 0,
				items: [],
				error: error instanceof Error ? error.message : "Search failed",
			};
		}
	}

	if (input.all) {
		const limit = input.limit || 50;

		const allImages = await imageService.list({
			status: input.status as "completed" | "processing" | "failed" | undefined,
			limit,
		});

		return {
			success: true,
			count: allImages.length,
			items: allImages.map((img) => imageService.formatImage(img)),
		};
	}

	return {
		success: false,
		count: 0,
		items: [],
		error: "Provide id, query, or set all: true",
	};
}
