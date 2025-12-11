/**
 * getImage Tool Implementation
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { images } from "../../db/schema";
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
	if (input.id) {
		const image = await ctx.db.query.images.findFirst({
			where: eq(images.id, input.id),
			with: { metadata: true },
		});

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
			items: [formatImage(image)],
		};
	}

	if (input.query) {
		const limit = input.limit || 5;
		const minScore = input.minScore ?? -0.7;

		try {
			const { results } = await ctx.vectorIndex.searchImages(input.query, {
				limit: limit * 3,
			});

			const filteredResults = results.filter(
				(r: { score: number }) => r.score >= minScore,
			);

			const imageIds = filteredResults.map((r: { id: string }) => r.id);
			const fullImages =
				imageIds.length > 0
					? await ctx.db.query.images.findMany({
							where: (imgs, { inArray }) => inArray(imgs.id, imageIds),
							with: { metadata: true },
						})
					: [];

			const imageMap = new Map(fullImages.map((img) => [img.id, img]));

			const finalResults = filteredResults
				.slice(0, limit)
				.map(
					(r: {
						id: string;
						filename: string;
						description: string;
						score: number;
					}) => {
						const img = imageMap.get(r.id);
						return {
							id: r.id,
							filename: r.filename,
							url:
								img?.cdnUrl ?? (img?.filePath ? `/uploads/${img.filePath}` : undefined),
							description: r.description,
							score: r.score,
							relevance:
								r.score >= -0.3
									? "strong"
									: r.score >= -0.6
										? "moderate"
										: "weak",
						};
					},
				);

			return {
				success: true,
				count: finalResults.length,
				query: input.query,
				items: finalResults,
				hint:
					finalResults.length === 0
						? "No images matched. Try different keywords or lower minScore."
						: finalResults[0].relevance === "strong"
							? "Strong matches found."
							: "Matches are moderate/weak - verify they fit user intent.",
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

		const allImages = await ctx.db.query.images.findMany({
			where: input.status ? eq(images.status, input.status) : undefined,
			with: { metadata: true },
			limit,
			orderBy: (imgs, { desc }) => [desc(imgs.uploadedAt)],
		});

		return {
			success: true,
			count: allImages.length,
			items: allImages.map(formatImage),
		};
	}

	return {
		success: false,
		count: 0,
		items: [],
		error: "Provide id, query, or set all: true",
	};
}

function formatImage(image: any) {
	return {
		id: image.id,
		filename: image.filename,
		originalFilename: image.originalFilename,
		url:
			image.cdnUrl ?? (image.filePath ? `/uploads/${image.filePath}` : undefined),
		status: image.status,
		uploadedAt: image.uploadedAt,
		description: image.metadata?.description,
		tags: image.metadata?.tags
			? JSON.parse(image.metadata.tags as string)
			: [],
		categories: image.metadata?.categories
			? JSON.parse(image.metadata.categories as string)
			: [],
	};
}
