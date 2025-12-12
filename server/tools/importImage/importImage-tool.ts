/**
 * importImage Tool Implementation
 *
 * Unified download from Pexels or Unsplash.
 * Downloads external photo to local system.
 *
 * Uses ImageService for all database operations (no direct DB access).
 */

import { z } from "zod";
import { getPexelsService } from "../../services/ai/pexels.service";
import { getUnsplashService } from "../../services/ai/unsplash.service";
import imageProcessingService from "../../services/storage/image-processing.service";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	provider: z.enum(["pexels", "unsplash"]).describe("Image provider"),
	photoId: z
		.union([z.string(), z.number()])
		.describe("Photo ID from browseImages results"),
});

export type ImportImageInput = z.infer<typeof schema>;

export async function execute(input: ImportImageInput, ctx: AgentContext) {
	const sessionId = ctx.sessionId;
	const imageService = ctx.services.imageService;

	if (!sessionId) {
		return {
			success: false,
			error: "Session ID not available in context",
		};
	}

	// Normalize photoId to string for source tag
	const photoIdStr = String(input.photoId);
	const sourceTag = `${input.provider}:${photoIdStr}`;

	// Check for duplicate via service
	const existingImage = await imageService.findBySource(sourceTag);

	if (existingImage) {
		const localUrl = imageService.getImageUrl(existingImage);
		const providerName = input.provider === "pexels" ? "Pexels" : "Unsplash";

		return {
			success: true,
			isNew: false,
			imageId: existingImage.id,
			url: localUrl,
			filename: existingImage.originalFilename || existingImage.filename,
			description: existingImage.metadata?.description,
			photographer:
				existingImage.metadata?.detailedDescription
					?.replace("Photo by ", "")
					.replace(` on ${providerName}`, "") || "Unknown",
			message: `Photo already in system (duplicate by ${providerName} ID)`,
		};
	}

	// Download based on provider
	if (input.provider === "pexels") {
		return downloadFromPexels(input.photoId, sessionId, sourceTag, ctx);
	} else {
		return downloadFromUnsplash(photoIdStr, sessionId, sourceTag, ctx);
	}
}

async function downloadFromPexels(
	photoId: string | number,
	sessionId: string,
	sourceTag: string,
	ctx: AgentContext
) {
	const pexelsService = getPexelsService();

	if (!pexelsService.isConfigured()) {
		return {
			success: false,
			error:
				"Pexels API key not configured. Set PEXELS_API_KEY environment variable.",
		};
	}

	try {
		// Pexels expects number
		const numericId =
			typeof photoId === "number" ? photoId : parseInt(photoId, 10);
		const download = await pexelsService.downloadPhoto(numericId);

		return processAndSaveImage(
			download,
			sessionId,
			sourceTag,
			"Pexels",
			ctx
		);
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Download failed",
		};
	}
}

async function downloadFromUnsplash(
	photoId: string,
	sessionId: string,
	sourceTag: string,
	ctx: AgentContext
) {
	const unsplashService = getUnsplashService();

	if (!unsplashService.isConfigured()) {
		return {
			success: false,
			error:
				"Unsplash API key not configured. Set UNSPLASH_ACCESS_KEY environment variable.",
		};
	}

	try {
		const download = await unsplashService.downloadPhoto(photoId);

		return processAndSaveImage(
			download,
			sessionId,
			sourceTag,
			"Unsplash",
			ctx
		);
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Download failed",
		};
	}
}

async function processAndSaveImage(
	download: {
		buffer: Buffer;
		metadata: {
			filename: string;
			photographer: string;
			photographerUrl: string;
			alt: string;
		};
	},
	sessionId: string,
	sourceTag: string,
	providerName: string,
	ctx: AgentContext
) {
	const imageService = ctx.services.imageService;

	// Process through image processing service
	const processResult = await imageProcessingService.processImage({
		buffer: download.buffer,
		filename: download.metadata.filename,
		sessionId: sessionId,
		mediaType: "image/jpeg",
	});

	// Wait a moment for initial DB record to be created
	await new Promise((resolve) => setTimeout(resolve, 200));

	// Add/update metadata with attribution via service
	const attribution = `Photo by ${download.metadata.photographer} on ${providerName}`;

	await imageService.upsertMetadata({
		imageId: processResult.imageId,
		description: download.metadata.alt,
		detailedDescription: attribution,
		altText: download.metadata.alt,
		source: sourceTag,
	});

	// Poll for completion (wait for processing to finish)
	const maxWaitMs = 30000; // 30 seconds
	const pollIntervalMs = 2000; // 2 seconds
	const startTime = Date.now();

	let finalStatus = "processing";
	let imageRecord = await imageService.getStatus(processResult.imageId);

	while (Date.now() - startTime < maxWaitMs) {
		imageRecord = await imageService.getStatus(processResult.imageId);

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

	const localUrl = imageRecord?.filePath
		? `/uploads/${imageRecord.filePath}`
		: undefined;

	if (finalStatus !== "completed") {
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
}
