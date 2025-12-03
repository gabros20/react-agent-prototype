import { randomUUID } from "node:crypto";
import path from "node:path";
import { db } from "../../db/client";
import { images, imageMetadata } from "../../db/schema";
import { eq } from "drizzle-orm";
import imageStorageService from "./image-storage.service";
import { generateSHA256 } from "../../utils/hash";
import type { SaveImageResult } from "./image-storage.service";
import type { ImageMetadata } from "../ai/metadata-generation.service";

export interface ImageProcessingResult {
	imageId: string;
	isNew: boolean;
	status: "processing" | "completed" | "failed";
}

export interface ImageDetails {
	id: string;
	filename: string;
	originalFilename: string;
	status: "processing" | "completed" | "failed";
	fileSize: number;
	width?: number;
	height?: number;
	url?: string;
	cdnUrl?: string;
	uploadedAt: Date;
	processedAt?: Date;
	metadata?: ImageMetadata;
	thumbnailUrl?: string;
}

export class ImageProcessingService {
	// Use singleton storage service
	private storage = imageStorageService;

	/**
	 * Main entry point: process uploaded image end-to-end
	 * 1. Validate and hash
	 * 2. Check for duplicates
	 * 3. Save to storage
	 * 4. Create DB record
	 * 5. Queue async jobs
	 */
	async processImage(params: {
		buffer: Buffer;
		filename: string;
		sessionId?: string; // Optional - kept for backwards compatibility but no longer used
		mediaType?: string;
		fixedId?: string; // Optional fixed ID for seeding
	}): Promise<ImageProcessingResult> {
		const { buffer, filename } = params;

		// 1. Generate SHA256 hash
		const sha256 = generateSHA256(buffer);

		// 2. Check for duplicate first (outside transaction)
		const duplicate = await db.query.images.findFirst({
			where: eq(images.sha256Hash, sha256),
		});

		if (duplicate) {
			// Return existing image (no longer tracking per-conversation)
			return {
				imageId: duplicate.id,
				isNew: false,
				status: duplicate.status as "processing" | "completed" | "failed",
			};
		}

		// 3. Save to storage first (file operations - outside transaction)
		const stored = await this.storage.saveImage(buffer, {
			filename,
			mediaType: params.mediaType || "image/jpeg",
			fixedId: params.fixedId, // Pass through fixed ID for seeding
		});

		const imageId = stored.id;
		const ext = path.extname(filename);

		// 4. Insert image record into database
		try {
			await db.insert(images).values({
				id: imageId,
				filename: imageId + ext,
				originalFilename: filename,
				mediaType: params.mediaType || "image/jpeg",
				storageType: "filesystem",
				filePath: stored.originalPath,
				cdnUrl: stored.cdnUrl,
				thumbnailData: stored.thumbnailBuffer,
				fileSize: buffer.length,
				width: stored.width,
				height: stored.height,
				sha256Hash: sha256,
				status: "processing",
				uploadedAt: new Date(),
			});
		} catch (error: any) {
			// If database insert fails, clean up the file
			if (stored.originalPath) {
				await this.storage.deleteImage(stored.originalPath).catch(() => {
					// Ignore cleanup errors
				});
			}
			throw error;
		}

		const result = {
			imageId,
			isNew: true,
			status: "processing" as const,
			storedFile: stored,
		};

		// 6. Queue async jobs if new image (outside transaction)
		if (result.isNew && result.storedFile) {
			const { imageQueue } = await import("../../queues/image-queue");
			await imageQueue.add(
				"generate-metadata",
				{ imageId: result.imageId, filePath: result.storedFile.originalPath },
				{ jobId: `metadata-${result.imageId}` }
			);
			await imageQueue.add(
				"generate-variants",
				{ imageId: result.imageId, filePath: result.storedFile.originalPath },
				{ jobId: `variants-${result.imageId}` }
			);
		}

		return {
			imageId: result.imageId,
			isNew: result.isNew,
			status: result.status,
		};
	}

	/**
	 * Check if image with same SHA256 hash already exists
	 * Used for deduplication
	 */
	async findDuplicate(sha256: string) {
		const existing = await db.query.images.findFirst({
			where: eq(images.sha256Hash, sha256),
		});
		return existing || null;
	}

	/**
	 * Get complete image details with metadata and variants
	 */
	async getImageWithDetails(imageId: string): Promise<ImageDetails> {
		const image = await db.query.images.findFirst({
			where: eq(images.id, imageId),
			with: {
				metadata: true,
			},
		});

		if (!image) {
			throw new Error(`Image not found: ${imageId}`);
		}

		// Parse metadata fields from JSON strings
		let parsedMetadata: ImageMetadata | undefined;
		if (image.metadata) {
			parsedMetadata = {
				description: image.metadata.description || "",
				detailedDescription: image.metadata.detailedDescription ?? undefined,
				tags: image.metadata.tags
					? JSON.parse(image.metadata.tags as string)
					: [],
				categories: image.metadata.categories
					? JSON.parse(image.metadata.categories as string)
					: [],
				objects: image.metadata.objects
					? JSON.parse(image.metadata.objects as string)
					: [],
				colors: image.metadata.colors
					? JSON.parse(image.metadata.colors as string)
					: { dominant: [], palette: [] },
				mood: image.metadata.mood || "",
				style: image.metadata.style || "",
				composition: image.metadata.composition
					? JSON.parse(image.metadata.composition as string)
					: {
							orientation: "landscape" as const,
							subject: "",
							background: "",
						},
				searchableText: image.metadata.searchableText || "",
			};
		}

		return {
			id: image.id,
			filename: image.filename,
			originalFilename: image.originalFilename,
			status: image.status as "processing" | "completed" | "failed",
			fileSize: image.fileSize,
			width: image.width ?? undefined,
			height: image.height ?? undefined,
			url: image.cdnUrl ?? (image.filePath ? `/uploads${image.filePath}` : undefined),
			cdnUrl: image.cdnUrl ?? undefined,
			uploadedAt: image.uploadedAt,
			processedAt: image.processedAt ?? undefined,
			metadata: parsedMetadata,
			thumbnailUrl: image.id ? `/api/images/${image.id}/thumbnail` : undefined,
		};
	}

	/**
	 * Get image processing status
	 */
	async getImageStatus(
		imageId: string
	): Promise<{
		id: string;
		status: "processing" | "completed" | "failed";
		processedAt?: Date;
		error?: string;
	}> {
		const image = await db.query.images.findFirst({
			where: eq(images.id, imageId),
		});

		if (!image) {
			throw new Error(`Image not found: ${imageId}`);
		}

		return {
			id: image.id,
			status: image.status as "processing" | "completed" | "failed",
			processedAt: image.processedAt || undefined,
			error: image.error || undefined,
		};
	}

	/**
	 * Delete image and clean up all references
	 */
	async deleteImage(imageId: string): Promise<void> {
		const image = await db.query.images.findFirst({
			where: eq(images.id, imageId),
		});

		if (!image) {
			throw new Error(`Image not found: ${imageId}`);
		}

		// Delete from filesystem (only if filePath exists)
		if (image.filePath) {
			await this.storage.deleteImage(image.filePath);
		}

		// Delete from vector index if available
		try {
			const { ServiceContainer } = await import("../service-container");
			const vectorIndex = ServiceContainer.get().vectorIndex;
			await vectorIndex.deleteImage(imageId);
		} catch (error) {
			console.warn("Failed to delete from vector index:", error);
		}

		// Database delete cascades to metadata and variants
		await db.delete(images).where(eq(images.id, imageId));
	}
}

export default new ImageProcessingService();
