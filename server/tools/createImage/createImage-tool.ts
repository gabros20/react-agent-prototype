/**
 * createImage Tool Implementation
 *
 * Upload new image via buffer. Returns imageId after processing.
 * Note: This is primarily used internally by importImage and file upload routes.
 * Direct agent calls are less common - agents typically use browseImages + importImage.
 *
 * Uses ImageService for all database operations (no direct DB access).
 */

import { z } from "zod";
import imageProcessingService from "../../services/storage/image-processing.service";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	base64: z.string().describe("Base64-encoded image data"),
	filename: z.string().describe("Original filename with extension"),
	mediaType: z
		.string()
		.optional()
		.describe("MIME type (default: auto-detect from filename)"),
	description: z.string().optional().describe("Initial image description"),
});

export type CreateImageInput = z.infer<typeof schema>;

export async function execute(input: CreateImageInput, ctx: AgentContext) {
	const sessionId = ctx.sessionId;
	const imageService = ctx.services.imageService;

	if (!sessionId) {
		return {
			success: false,
			error: "Session ID not available in context",
		};
	}

	try {
		// Decode base64 to buffer
		const buffer = Buffer.from(input.base64, "base64");

		// Auto-detect media type if not provided
		const mediaType =
			input.mediaType || getMediaTypeFromFilename(input.filename);

		// Process through image processing service
		const processResult = await imageProcessingService.processImage({
			buffer,
			filename: input.filename,
			sessionId,
			mediaType,
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
				imageId: processResult.imageId,
				url: localUrl,
				filename: input.filename,
				status: "processing" as const,
				message: "Uploaded. Processing still in progress.",
			};
		}

		return {
			success: true,
			imageId: processResult.imageId,
			url: localUrl,
			filename: input.filename,
			status: "completed" as const,
			message: "Uploaded and processed successfully.",
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Upload failed",
		};
	}
}

function getMediaTypeFromFilename(filename: string): string {
	const ext = filename.toLowerCase().split(".").pop();
	const mimeTypes: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
		avif: "image/avif",
	};
	return mimeTypes[ext || ""] || "image/jpeg";
}
