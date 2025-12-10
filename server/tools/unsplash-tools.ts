/**
 * Unsplash Stock Photo Tools
 *
 * Two tools for sourcing free stock photos:
 * - unsplash_searchPhotos: Browse photos by keyword
 * - unsplash_downloadPhoto: Download selected photo into system
 *
 * DESIGN NOTE: The Unsplash service is intentionally kept as a singleton via
 * getUnsplashService(). It's a stateless API client that only needs an API key
 * (from env vars) and doesn't require session context or database access.
 * This is acceptable per the architectural decision to avoid bloating
 * AgentContext with stateless external API wrappers.
 */

import { tool } from "ai";
import { z } from "zod";
import { images, imageMetadata } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getUnsplashService } from "../services/ai/unsplash.service";
import imageProcessingService from "../services/storage/image-processing.service";
import type { AgentContext } from "./types";

// ============================================================================
// Tool 1: Search Photos
// ============================================================================

export const unsplashSearchPhotosTool = tool({
	description: `Search Unsplash for free stock photos. Use unsplash_downloadPhoto to add to system.`,
	inputSchema: z.object({
		query: z.string().describe("Search query (e.g., 'team meeting', 'modern office')"),
		perPage: z
			.number()
			.min(1)
			.max(30)
			.optional()
			.describe("Number of results (1-30, default: 10)"),
		orientation: z
			.enum(["landscape", "portrait", "squarish"])
			.optional()
			.describe("Photo orientation filter"),
		color: z
			.enum([
				"black_and_white",
				"black",
				"white",
				"yellow",
				"orange",
				"red",
				"purple",
				"magenta",
				"green",
				"teal",
				"blue",
			])
			.optional()
			.describe("Color filter"),
	}),
	execute: async (input) => {
		// Unsplash service is stateless - uses singleton pattern (see file header)
		const unsplashService = getUnsplashService();

		if (!unsplashService.isConfigured()) {
			return {
				success: false,
				error: "Unsplash API key not configured. Set UNSPLASH_ACCESS_KEY environment variable.",
				photos: [],
				totalResults: 0,
			};
		}

		try {
			const result = await unsplashService.search({
				query: input.query,
				perPage: input.perPage || 10,
				orientation: input.orientation,
				color: input.color,
			});

			return {
				success: true,
				photos: result.photos.map((photo) => ({
					id: photo.id,
					photographer: photo.photographer,
					photographerUrl: photo.photographerUrl,
					alt: photo.alt,
					previewUrl: photo.previewUrl,
					color: photo.color,
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

export const unsplashDownloadPhotoTool = tool({
	description: `Download Unsplash photo to local system. Returns local URL for use in CMS.`,
	inputSchema: z.object({
		photoId: z.string().describe("Unsplash photo ID (from search results)"),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		const sessionId = ctx.sessionId;

		if (!sessionId) {
			return {
				success: false,
				error: "Session ID not available in context",
			};
		}

		// Unsplash service is stateless - uses singleton pattern (see file header)
		const unsplashService = getUnsplashService();

		if (!unsplashService.isConfigured()) {
			return {
				success: false,
				error: "Unsplash API key not configured. Set UNSPLASH_ACCESS_KEY environment variable.",
			};
		}

		try {
			// Check for duplicate by Unsplash ID
			const sourceTag = `unsplash:${input.photoId}`;
			const existing = await ctx.db.query.imageMetadata.findFirst({
				where: eq(imageMetadata.source, sourceTag),
			});

			if (existing) {
				// Get the image record
				const existingImage = await ctx.db.query.images.findFirst({
					where: eq(images.id, existing.imageId),
					with: { metadata: true },
				});

				if (existingImage) {
					// Get the local URL
					const localUrl = existingImage.filePath ? `/uploads/${existingImage.filePath}` : undefined;

					return {
						success: true,
						isNew: false,
						imageId: existingImage.id,
						url: localUrl,
						filename: existingImage.originalFilename || existingImage.filename,
						description: existingImage.metadata?.description,
						photographer: existingImage.metadata?.detailedDescription?.replace("Photo by ", "").replace(" on Unsplash", "") || "Unknown",
						message: "Photo already in system (duplicate by Unsplash ID)",
					};
				}
			}

			// Download the photo
			const download = await unsplashService.downloadPhoto(input.photoId);

			// Process through image processing service
			const processResult = await imageProcessingService.processImage({
				buffer: download.buffer,
				filename: download.metadata.filename,
				sessionId: sessionId,
				mediaType: "image/jpeg",
			});

			// Wait a moment for initial DB record to be created
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Add/update metadata with Unsplash attribution
			const attribution = `Photo by ${download.metadata.photographer} on Unsplash`;

			await ctx.db
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
			let imageRecord: typeof images.$inferSelect | null = null;
			while (Date.now() - startTime < maxWaitMs) {
				imageRecord = await ctx.db.query.images.findFirst({
					where: eq(images.id, processResult.imageId),
				}) ?? null;

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

			// Get the local URL - filePath exists even while processing (file is on disk)
			const localUrl = imageRecord?.filePath ? `/uploads/${imageRecord.filePath}` : undefined;

			if (finalStatus !== "completed") {
				// Still processing after timeout - return anyway
				return {
					success: true,
					isNew: true,
					imageId: processResult.imageId,
					url: localUrl,
					filename: download.metadata.filename,
					description: download.metadata.alt,
					photographer: download.metadata.photographer,
					photographerUrl: download.metadata.photographerUrl,
					message: `Downloaded. Processing still in progress. ${attribution}`,
					status: "processing" as const,
				};
			}

			return {
				success: true,
				isNew: true,
				imageId: processResult.imageId,
				url: localUrl,
				filename: download.metadata.filename,
				description: download.metadata.alt,
				photographer: download.metadata.photographer,
				photographerUrl: download.metadata.photographerUrl,
				message: `Downloaded and processed. ${attribution}`,
				status: "completed" as const,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Download failed",
			};
		}
	},
});
