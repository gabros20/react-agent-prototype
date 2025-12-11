/**
 * browseImages Tool Implementation
 *
 * Unified search across Pexels and Unsplash.
 * Returns preview URLs and IDs for use with importImage.
 */

import { z } from "zod";
import { getPexelsService } from "../../services/ai/pexels.service";
import { getUnsplashService } from "../../services/ai/unsplash.service";

export const schema = z.object({
	query: z
		.string()
		.describe("Search query (e.g., 'modern office workspace', 'team meeting')"),
	provider: z
		.enum(["pexels", "unsplash", "both"])
		.optional()
		.describe("Provider to search (default: both)"),
	limit: z
		.number()
		.min(1)
		.max(20)
		.optional()
		.describe("Max results per provider (default: 5)"),
	orientation: z
		.enum(["landscape", "portrait", "square"])
		.optional()
		.describe("Photo orientation filter"),
	color: z.string().optional().describe("Color filter (provider-specific)"),
});

export type BrowseImagesInput = z.infer<typeof schema>;

interface PhotoResult {
	id: string | number;
	provider: "pexels" | "unsplash";
	photographer: string;
	photographerUrl: string;
	alt: string;
	previewUrl: string;
	width: number;
	height: number;
	color?: string;
}

export async function execute(input: BrowseImagesInput) {
	const provider = input.provider || "both";
	const limit = input.limit || 5;
	const results: PhotoResult[] = [];
	const errors: string[] = [];

	// Search Pexels
	if (provider === "pexels" || provider === "both") {
		const pexelsService = getPexelsService();

		if (!pexelsService.isConfigured()) {
			if (provider === "pexels") {
				return {
					success: false,
					error:
						"Pexels API key not configured. Set PEXELS_API_KEY environment variable.",
					photos: [],
					totalResults: 0,
				};
			}
			errors.push("Pexels not configured");
		} else {
			try {
				const pexelsResult = await pexelsService.search({
					query: input.query,
					perPage: limit,
					orientation: input.orientation,
					color: input.color as any,
				});

				for (const photo of pexelsResult.photos) {
					results.push({
						id: photo.id,
						provider: "pexels",
						photographer: photo.photographer,
						photographerUrl: photo.photographerUrl,
						alt: photo.alt,
						previewUrl: photo.previewUrl,
						width: photo.width,
						height: photo.height,
						color: photo.avgColor,
					});
				}
			} catch (error) {
				errors.push(
					`Pexels: ${error instanceof Error ? error.message : "Search failed"}`
				);
			}
		}
	}

	// Search Unsplash
	if (provider === "unsplash" || provider === "both") {
		const unsplashService = getUnsplashService();

		if (!unsplashService.isConfigured()) {
			if (provider === "unsplash") {
				return {
					success: false,
					error:
						"Unsplash API key not configured. Set UNSPLASH_ACCESS_KEY environment variable.",
					photos: [],
					totalResults: 0,
				};
			}
			errors.push("Unsplash not configured");
		} else {
			try {
				// Map orientation for Unsplash (uses "squarish" instead of "square")
				const unsplashOrientation =
					input.orientation === "square" ? "squarish" : input.orientation;

				const unsplashResult = await unsplashService.search({
					query: input.query,
					perPage: limit,
					orientation: unsplashOrientation as any,
					color: input.color as any,
				});

				for (const photo of unsplashResult.photos) {
					results.push({
						id: photo.id,
						provider: "unsplash",
						photographer: photo.photographer,
						photographerUrl: photo.photographerUrl,
						alt: photo.alt,
						previewUrl: photo.previewUrl,
						width: photo.width,
						height: photo.height,
						color: photo.color,
					});
				}
			} catch (error) {
				errors.push(
					`Unsplash: ${error instanceof Error ? error.message : "Search failed"}`
				);
			}
		}
	}

	if (results.length === 0 && errors.length > 0) {
		return {
			success: false,
			error: errors.join("; "),
			photos: [],
			totalResults: 0,
		};
	}

	return {
		success: true,
		photos: results,
		totalResults: results.length,
		query: input.query,
		provider: provider,
		...(errors.length > 0 && { warnings: errors }),
	};
}
