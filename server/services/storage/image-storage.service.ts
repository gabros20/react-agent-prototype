import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

export interface StorageConfig {
	uploadsDir: string;
	baseUrl: string;
	useCDN: boolean;
	cdnUrl?: string;
}

export interface SaveImageResult {
	id: string;
	originalPath: string;
	thumbnailPath: string;
	thumbnailBuffer: Buffer;
	cdnUrl?: string;
	width: number;
	height: number;
}

export class ImageStorageService {
	constructor(private config: StorageConfig) {}

	/**
	 * Save image to filesystem with date-based organization
	 * Generates thumbnail for BLOB storage
	 */
	async saveImage(
		file: Buffer,
		metadata: { filename: string; mediaType: string; fixedId?: string },
	): Promise<SaveImageResult> {
		const id = metadata.fixedId || randomUUID();
		const ext = path.extname(metadata.filename);
		const date = new Date();
		const datePath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;

		// Resolve uploadsDir to absolute path for consistency
		const absoluteUploadsDir = path.resolve(this.config.uploadsDir);

		// Create directory structure
		const originalDir = path.join(
			absoluteUploadsDir,
			"images",
			datePath,
			"original",
		);
		const variantDir = path.join(
			absoluteUploadsDir,
			"images",
			datePath,
			"variants",
		);

		await fs.mkdir(originalDir, { recursive: true });
		await fs.mkdir(variantDir, { recursive: true });

		// Get image metadata
		const imageMetadata = await sharp(file).metadata();
		const width = imageMetadata.width || 0;
		const height = imageMetadata.height || 0;

		// Save original
		const originalPath = path.join(originalDir, `${id}${ext}`);
		await fs.writeFile(originalPath, file);

		// Generate thumbnail (150x150 WebP) for BLOB storage
		const thumbnailBuffer = await sharp(file)
			.resize(150, 150, { fit: "cover" })
			.webp({ quality: 70 })
			.toBuffer();

		const thumbnailPath = path.join(variantDir, `${id}_thumbnail.webp`);
		await fs.writeFile(thumbnailPath, thumbnailBuffer);

		// Upload to CDN if configured
		let cdnUrl: string | undefined;
		if (this.config.useCDN && this.config.cdnUrl) {
			cdnUrl = await this.uploadToCDN(originalPath, id);
		}

		// Return paths relative to uploadsDir (strip the absolute uploadsDir prefix)
		return {
			id,
			originalPath: originalPath.replace(absoluteUploadsDir + "/", ""),
			thumbnailPath: thumbnailPath.replace(absoluteUploadsDir + "/", ""),
			thumbnailBuffer,
			cdnUrl,
			width,
			height,
		};
	}

	/**
	 * Generate image variants (different sizes and formats)
	 */
	async generateVariants(
		imageId: string,
		originalPath: string,
	): Promise<
		Array<{
			variantType: string;
			format: string;
			width: number;
			height: number;
			fileSize: number;
			filePath: string;
		}>
	> {
		const variants = [
			{ name: "small", width: 640, quality: 80 },
			{ name: "medium", width: 1024, quality: 85 },
			{ name: "large", width: 1920, quality: 90 },
		];

		const formats = ["webp", "avif"];
		const results: Array<{
			variantType: string;
			format: string;
			width: number;
			height: number;
			fileSize: number;
			filePath: string;
		}> = [];

		const fullOriginalPath = path.join(this.config.uploadsDir, originalPath);

		for (const variant of variants) {
			for (const format of formats) {
				const outputPath = fullOriginalPath
					.replace("/original/", "/variants/")
					.replace(/\.[^.]+$/, `_${variant.name}.${format}`);

				let sharpInstance = sharp(fullOriginalPath).resize(variant.width, null, {
					withoutEnlargement: true,
				});

				if (format === "webp") {
					sharpInstance = sharpInstance.webp({ quality: variant.quality });
				} else if (format === "avif") {
					sharpInstance = sharpInstance.avif({ quality: variant.quality });
				}

				await sharpInstance.toFile(outputPath);

				const stats = await fs.stat(outputPath);
				const metadata = await sharp(outputPath).metadata();

				// Return path relative to uploadsDir
				const absoluteUploadsDir = path.resolve(this.config.uploadsDir);

				results.push({
					variantType: variant.name,
					format,
					width: metadata.width || variant.width,
					height: metadata.height || 0,
					fileSize: stats.size,
					filePath: outputPath.replace(absoluteUploadsDir + "/", ""),
				});
			}
		}

		return results;
	}

	/**
	 * Upload to CDN (placeholder - implement based on your CDN)
	 */
	private async uploadToCDN(filePath: string, imageId: string): Promise<string> {
		// TODO: Implement CDN upload logic (S3, Cloudflare R2, etc.)
		// For now, return a placeholder
		return `${this.config.cdnUrl}/${imageId}`;
	}

	/**
	 * Delete image and all variants
	 */
	async deleteImage(originalPath: string): Promise<void> {
		const fullPath = path.join(this.config.uploadsDir, originalPath);

		// Delete original
		await fs.unlink(fullPath).catch(() => {
			// Ignore if file doesn't exist
		});

		// Delete variants directory
		const variantsDir = path.dirname(fullPath).replace("/original", "/variants");
		const imageId = path.basename(fullPath, path.extname(fullPath));

		try {
			const files = await fs.readdir(variantsDir);
			const variantFiles = files.filter((f) => f.startsWith(imageId));

			await Promise.all(
				variantFiles.map((f) =>
					fs.unlink(path.join(variantsDir, f)).catch(() => {
						// Ignore errors
					}),
				),
			);
		} catch {
			// Directory might not exist
		}
	}
}

// Export singleton instance
export default new ImageStorageService({
	uploadsDir: process.env.UPLOADS_DIR || "./uploads",
	baseUrl: process.env.BASE_URL || "http://localhost:3000",
	useCDN: process.env.USE_CDN === "true",
	cdnUrl: process.env.CDN_URL,
});
