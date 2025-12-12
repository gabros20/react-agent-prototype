/**
 * ImageService
 *
 * Service layer for image CRUD operations.
 * Provides a unified API for all image-related database operations.
 */

import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { DrizzleDB } from "../../db/client";
import * as schema from "../../db/schema";
import type { VectorIndexService } from "../vector-index";

// ============================================================================
// Types
// ============================================================================

/**
 * Image with metadata - uses schema inference for type safety
 */
export type ImageWithMetadata = Awaited<ReturnType<typeof getImageWithMetadataType>>;

// Helper type function for inference
async function getImageWithMetadataType(db: DrizzleDB) {
	const result = await db.query.images.findFirst({ with: { metadata: true } });
	return result;
}

export interface CreateImageMetadataInput {
	imageId: string;
	description?: string;
	detailedDescription?: string;
	altText?: string;
	source?: string;
	tags?: string[];
	categories?: string[];
}

export interface UpdateImageMetadataInput {
	description?: string;
	tags?: string[];
	categories?: string[];
}

export interface ImageSearchResult {
	id: string;
	filename: string;
	url: string | undefined;
	description: string | undefined;
	tags: string[];
	categories: string[];
	status: string;
	uploadedAt: Date | null;
}

// ============================================================================
// ImageService
// ============================================================================

export class ImageService {
	constructor(
		private db: DrizzleDB,
		private vectorIndex: VectorIndexService
	) {}

	// ============================================================================
	// Read Operations
	// ============================================================================

	/**
	 * Get image by ID with metadata
	 */
	async getById(id: string): Promise<NonNullable<ImageWithMetadata> | null> {
		const image = await this.db.query.images.findFirst({
			where: eq(schema.images.id, id),
			with: { metadata: true },
		});
		return image ?? null;
	}

	/**
	 * Get multiple images by IDs
	 */
	async getByIds(ids: string[]): Promise<NonNullable<ImageWithMetadata>[]> {
		if (ids.length === 0) return [];
		const results = await this.db.query.images.findMany({
			where: inArray(schema.images.id, ids),
			with: { metadata: true },
		});
		return results as NonNullable<ImageWithMetadata>[];
	}

	/**
	 * Find image by source tag (e.g., "pexels:123456")
	 */
	async findBySource(source: string): Promise<NonNullable<ImageWithMetadata> | null> {
		const metadata = await this.db.query.imageMetadata.findFirst({
			where: eq(schema.imageMetadata.source, source),
		});

		if (!metadata) return null;

		return this.getById(metadata.imageId);
	}

	/**
	 * List all images with optional status filter
	 */
	async list(options?: {
		status?: "processing" | "completed" | "failed";
		limit?: number;
	}): Promise<NonNullable<ImageWithMetadata>[]> {
		const { status, limit = 50 } = options ?? {};

		const results = await this.db.query.images.findMany({
			where: status ? eq(schema.images.status, status) : undefined,
			with: { metadata: true },
			limit,
			orderBy: (imgs, { desc }) => [desc(imgs.uploadedAt)],
		});

		return results as NonNullable<ImageWithMetadata>[];
	}

	/**
	 * Search images by semantic query
	 */
	async search(
		query: string,
		options?: { limit?: number; minScore?: number }
	): Promise<{ results: ImageSearchResult[]; total: number }> {
		const { limit = 5, minScore = -0.7 } = options ?? {};

		// Get semantic search results
		const { results: vectorResults, total } = await this.vectorIndex.searchImages(query, {
			limit: limit * 3, // Over-fetch for filtering
		});

		// Filter by score
		const filteredResults = vectorResults.filter(
			(r: { score: number }) => r.score >= minScore
		);

		// Get full image records for the results
		const imageIds = filteredResults.map((r: { id: string }) => r.id);
		const fullImages = imageIds.length > 0 ? await this.getByIds(imageIds) : [];
		const imageMap = new Map(fullImages.map((img) => [img.id, img]));

		// Build final results with full data
		const results: ImageSearchResult[] = filteredResults
			.slice(0, limit)
			.map((r: { id: string; filename: string; description: string; score: number }) => {
				const img = imageMap.get(r.id);
				return {
					id: r.id,
					filename: r.filename || img?.filename || "unknown",
					url: img?.cdnUrl ?? (img?.filePath ? `/uploads/${img.filePath}` : undefined),
					description: r.description || img?.metadata?.description || undefined,
					tags: this.parseTags(img?.metadata?.tags as string | null | undefined),
					categories: this.parseCategories(img?.metadata?.categories as string | null | undefined),
					status: img?.status || "unknown",
					uploadedAt: img?.uploadedAt ?? null,
				};
			});

		return { results, total: filteredResults.length };
	}

	// ============================================================================
	// Write Operations
	// ============================================================================

	/**
	 * Create or update image metadata
	 */
	async upsertMetadata(input: CreateImageMetadataInput): Promise<void> {
		const existing = await this.db.query.imageMetadata.findFirst({
			where: eq(schema.imageMetadata.imageId, input.imageId),
		});

		const data = {
			description: input.description ?? null,
			detailedDescription: input.detailedDescription ?? null,
			altText: input.altText ?? null,
			source: input.source ?? null,
			tags: input.tags ? JSON.stringify(input.tags) : null,
			categories: input.categories ? JSON.stringify(input.categories) : null,
			generatedAt: new Date(),
		};

		if (existing) {
			await this.db
				.update(schema.imageMetadata)
				.set(data)
				.where(eq(schema.imageMetadata.imageId, input.imageId));
		} else {
			await this.db.insert(schema.imageMetadata).values({
				id: randomUUID(),
				imageId: input.imageId,
				...data,
			});
		}
	}

	/**
	 * Update image metadata fields
	 */
	async updateMetadata(
		imageId: string,
		updates: UpdateImageMetadataInput
	): Promise<boolean> {
		const image = await this.getById(imageId);
		if (!image) return false;

		const data: Record<string, any> = {};
		if (updates.description !== undefined) {
			data.description = updates.description;
		}
		if (updates.tags !== undefined) {
			data.tags = JSON.stringify(updates.tags);
		}
		if (updates.categories !== undefined) {
			data.categories = JSON.stringify(updates.categories);
		}

		if (Object.keys(data).length === 0) return true;

		if (image.metadata) {
			await this.db
				.update(schema.imageMetadata)
				.set(data)
				.where(eq(schema.imageMetadata.imageId, imageId));
		} else {
			// Create metadata if it doesn't exist
			await this.db.insert(schema.imageMetadata).values({
				id: randomUUID(),
				imageId,
				...data,
				generatedAt: new Date(),
			});
		}

		return true;
	}

	/**
	 * Delete image and clean up references
	 * Note: Physical file deletion is handled by imageProcessingService
	 */
	async delete(id: string): Promise<boolean> {
		const image = await this.getById(id);
		if (!image) return false;

		// Delete metadata first (foreign key)
		await this.db
			.delete(schema.imageMetadata)
			.where(eq(schema.imageMetadata.imageId, id));

		// Delete image record
		await this.db
			.delete(schema.images)
			.where(eq(schema.images.id, id));

		// Remove from vector index
		try {
			await this.vectorIndex.delete(id);
		} catch {
			// Vector index deletion is best-effort
		}

		return true;
	}

	/**
	 * Get image status by ID
	 */
	async getStatus(id: string): Promise<{
		id: string;
		status: string;
		filePath: string | null;
	} | null> {
		const image = await this.db.query.images.findFirst({
			where: eq(schema.images.id, id),
			columns: { id: true, status: true, filePath: true },
		});
		return image ?? null;
	}

	/**
	 * Get image thumbnail data (for serving)
	 */
	async getThumbnail(id: string): Promise<Buffer | null> {
		const image = await this.db.query.images.findFirst({
			where: eq(schema.images.id, id),
			columns: { thumbnailData: true },
		});
		return image?.thumbnailData ?? null;
	}

	// ============================================================================
	// Formatting Helpers
	// ============================================================================

	/**
	 * Format image for tool response
	 */
	formatImage(image: NonNullable<ImageWithMetadata>): ImageSearchResult {
		return {
			id: image.id,
			filename: image.filename,
			url: image.cdnUrl ?? (image.filePath ? `/uploads/${image.filePath}` : undefined),
			description: image.metadata?.description ?? undefined,
			tags: this.parseTags(image.metadata?.tags as string | null | undefined),
			categories: this.parseCategories(image.metadata?.categories as string | null | undefined),
			status: image.status,
			uploadedAt: image.uploadedAt,
		};
	}

	/**
	 * Get URL for image
	 */
	getImageUrl(image: NonNullable<ImageWithMetadata>): string | undefined {
		return image.cdnUrl ?? (image.filePath ? `/uploads/${image.filePath}` : undefined);
	}

	// ============================================================================
	// Private Helpers
	// ============================================================================

	private parseTags(tags: string | null | undefined): string[] {
		if (!tags) return [];
		try {
			return JSON.parse(tags);
		} catch {
			return [];
		}
	}

	private parseCategories(categories: string | null | undefined): string[] {
		if (!categories) return [];
		try {
			return JSON.parse(categories);
		} catch {
			return [];
		}
	}
}
