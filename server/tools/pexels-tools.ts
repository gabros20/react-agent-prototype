/**
 * Pexels Stock Photo Tools
 *
 * Two tools for sourcing free stock photos:
 * - pexels_searchPhotos: Browse photos by keyword
 * - pexels_downloadPhoto: Download selected photo into system
 */

import { tool } from "ai";
import { z } from "zod";
import { db } from "../db/client";
import { images, imageMetadata, conversationImages } from "../db/schema";
import { eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getPexelsService } from "../services/ai/pexels.service";
import imageProcessingService from "../services/storage/image-processing.service";

// ============================================================================
// Tool 1: Search Photos
// ============================================================================

export const pexelsSearchPhotosTool: any = tool({
	description: `Search free stock photos from Pexels. Returns preview results with photographer credits. Use pexels_downloadPhoto to add selected photos to the system.`,
	inputSchema: z.object({
		query: z.string().describe("Search query (e.g., 'sunset beach', 'modern office')"),
		perPage: z
			.number()
			.min(1)
			.max(80)
			.optional()
			.describe("Number of results (1-80, default: 10)"),
		orientation: z
			.enum(["landscape", "portrait", "square"])
			.optional()
			.describe("Photo orientation filter"),
		color: z
			.enum([
				"red",
				"orange",
				"yellow",
				"green",
				"turquoise",
				"blue",
				"violet",
				"pink",
				"brown",
				"black",
				"gray",
				"white",
			])
			.optional()
			.describe("Color filter"),
	}),
	execute: async (input: {
		query: string;
		perPage?: number;
		orientation?: "landscape" | "portrait" | "square";
		color?: string;
	}): Promise<any> => {
		const pexelsService = getPexelsService();

		if (!pexelsService.isConfigured()) {
			return {
				success: false,
				error: "Pexels API key not configured. Set PEXELS_API_KEY environment variable.",
				photos: [],
				totalResults: 0,
			};
		}

		try {
			const result = await pexelsService.search({
				query: input.query,
				perPage: input.perPage || 10,
				orientation: input.orientation,
				color: input.color as any,
			});

			return {
				success: true,
				photos: result.photos.map((photo) => ({
					id: photo.id,
					photographer: photo.photographer,
					photographerUrl: photo.photographerUrl,
					alt: photo.alt,
					previewUrl: photo.previewUrl,
					avgColor: photo.avgColor,
					width: photo.width,
					height: photo.height,
				})),
				totalResults: result.totalResults,
				query: input.query,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Search failed",
				photos: [],
				totalResults: 0,
			};
		}
	},
});

// ============================================================================
// Tool 2: Download Photo
// ============================================================================

export const pexelsDownloadPhotoTool: any = tool({
	description: `Download a Pexels photo into the system. Checks for duplicates, processes image, stores attribution. Photo becomes searchable via cms_searchImages after processing completes.`,
	inputSchema: z.object({
		photoId: z.number().describe("Pexels photo ID (from search results)"),
		sessionId: z.string().describe("Current session ID"),
	}),
	execute: async (input: { photoId: number; sessionId: string }): Promise<any> => {
		const pexelsService = getPexelsService();

		if (!pexelsService.isConfigured()) {
			return {
				success: false,
				error: "Pexels API key not configured. Set PEXELS_API_KEY environment variable.",
			};
		}

		try {
			// Check for duplicate by Pexels ID
			const sourceTag = `pexels:${input.photoId}`;
			const existing = await db.query.imageMetadata.findFirst({
				where: eq(imageMetadata.source, sourceTag),
			});

			if (existing) {
				// Get the image record
				const existingImage = await db.query.images.findFirst({
					where: eq(images.id, existing.imageId),
					with: { metadata: true },
				});

				if (existingImage) {
					// Check if already linked to this conversation
					const alreadyLinked = await db.query.conversationImages.findFirst({
						where: (ci, { and, eq }) =>
							and(
								eq(ci.sessionId, input.sessionId),
								eq(ci.imageId, existingImage.id)
							),
					});

					// Link to conversation if not already
					if (!alreadyLinked) {
						await db.insert(conversationImages).values({
							id: randomUUID(),
							sessionId: input.sessionId,
							imageId: existingImage.id,
							uploadedAt: new Date(),
						});
					}

					return {
						success: true,
						isNew: false,
						imageId: existingImage.id,
						photographer: existingImage.metadata?.detailedDescription?.replace("Photo by ", "").replace(" on Pexels", "") || "Unknown",
						message: "Photo already in system, linked to conversation",
					};
				}
			}

			// Download the photo
			const download = await pexelsService.downloadPhoto(input.photoId);

			// Process through image processing service
			const processResult = await imageProcessingService.processImage({
				buffer: download.buffer,
				filename: download.metadata.filename,
				sessionId: input.sessionId,
				mediaType: "image/jpeg",
			});

			// Wait a moment for initial DB record to be created
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Add/update metadata with Pexels attribution
			const attribution = `Photo by ${download.metadata.photographer} on Pexels`;

			await db
				.insert(imageMetadata)
				.values({
					id: randomUUID(),
					imageId: processResult.imageId,
					description: download.metadata.alt,
					detailedDescription: attribution,
					altText: download.metadata.alt,
					source: sourceTag,
					generatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: imageMetadata.imageId,
					set: {
						description: download.metadata.alt,
						detailedDescription: attribution,
						source: sourceTag,
					},
				});

			// Poll for completion (wait for processing to finish)
			const maxWaitMs = 30000; // 30 seconds
			const pollIntervalMs = 2000; // 2 seconds
			const startTime = Date.now();

			let finalStatus = "processing";
			while (Date.now() - startTime < maxWaitMs) {
				const imageRecord = await db.query.images.findFirst({
					where: eq(images.id, processResult.imageId),
				});

				if (imageRecord?.status === "completed") {
					finalStatus = "completed";
					break;
				}

				if (imageRecord?.status === "failed") {
					finalStatus = "failed";
					break;
				}

				await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
			}

			if (finalStatus === "failed") {
				return {
					success: false,
					error: "Image processing failed",
					imageId: processResult.imageId,
				};
			}

			if (finalStatus !== "completed") {
				// Still processing after timeout - return anyway
				return {
					success: true,
					isNew: true,
					imageId: processResult.imageId,
					photographer: download.metadata.photographer,
					photographerUrl: download.metadata.photographerUrl,
					message: `Downloaded. Processing still in progress. ${attribution}`,
					status: "processing",
				};
			}

			return {
				success: true,
				isNew: true,
				imageId: processResult.imageId,
				photographer: download.metadata.photographer,
				photographerUrl: download.metadata.photographerUrl,
				message: `Downloaded and processed. ${attribution}`,
				status: "completed",
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Download failed",
			};
		}
	},
});

// ============================================================================
// Export All Tools
// ============================================================================

export const pexelsTools = {
	pexels_searchPhotos: pexelsSearchPhotosTool,
	pexels_downloadPhoto: pexelsDownloadPhotoTool,
};
