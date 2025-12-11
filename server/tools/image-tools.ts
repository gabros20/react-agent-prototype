/**
 * Image Tools - Semantic image search and management
 *
 * Uses experimental_context for all service access (AI SDK v6 pattern).
 * No ServiceContainer.get() or module-level service instantiation.
 */

import { tool } from "ai";
import { z } from "zod";
import { images, pageSectionContents, pageSections, sectionTemplates } from "../db/schema";
import { eq, and } from "drizzle-orm";
import imageProcessingService from "../services/storage/image-processing.service";
import type { AgentContext } from "./types";

/**
 * Find image by natural language description
 */
export const findImageTool = tool({
	description:
		"Find an image by natural language description. Use when user mentions an image or asks to find/delete/modify a specific image.",
	inputSchema: z.object({
		description: z
			.string()
			.describe(
				'Natural language description (e.g., "the puppy image", "sunset photo")'
			),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		const { description } = input;
		try {
			const result = await ctx.vectorIndex.findImageByDescription(description);

			// Get full image details
			const image = await ctx.db.query.images.findFirst({
				where: eq(images.id, result.id),
				with: {
					metadata: true,
				},
			});

			if (!image) {
				return { success: false, error: "Image not found" };
			}

			return {
				success: true,
				image: {
					id: image.id,
					filename: image.filename,
					url: image.cdnUrl ?? (image.filePath ? `/uploads/${image.filePath}` : undefined),
					description: image.metadata?.description ?? undefined,
					tags: image.metadata?.tags
						? JSON.parse(image.metadata.tags as string)
						: [],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to find image",
			};
		}
	},
});

/**
 * Search for multiple images using semantic similarity
 * Score interpretation: closer to 0 = better match, -0.3 or better is strong, -0.5 is moderate, -0.7+ is weak
 */
export const searchImagesTool = tool({
	description: "Search for images using semantic similarity. IMPORTANT: Expand short queries with descriptive keywords (e.g., 'AI' → 'artificial intelligence robot technology futuristic', 'money plant' → 'indoor plant greenery botanical houseplant'). Returns ranked results with relevance: 'strong' (score >= -0.3), 'moderate' (-0.3 to -0.6), 'weak' (< -0.6). Default filter includes moderate matches.",
	inputSchema: z.object({
		query: z.string().describe("Search query - use multiple descriptive keywords for better results"),
		limit: z.number().optional().describe("Max results (default: 5)"),
		minScore: z.number().optional().describe("Minimum score threshold (default: -0.7)"),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		// Default minScore -0.7 to include moderate matches
		const { query, limit = 5, minScore = -0.7 } = input;
		try {
			// Fetch more results initially to allow filtering
			const { results } = await ctx.vectorIndex.searchImages(query, { limit: limit * 3 });

			// Filter by minimum score threshold
			const filteredResults = results.filter((r: { score: number }) => r.score >= minScore);

			// Get full image data including URLs from database
			const imageIds = filteredResults.map((r: { id: string }) => r.id);
			const fullImages = imageIds.length > 0
				? await ctx.db.query.images.findMany({
						where: (images, { inArray }) => inArray(images.id, imageIds),
						with: { metadata: true },
					})
				: [];

			// Create lookup map for quick access
			const imageMap = new Map(fullImages.map(img => [img.id, img]));

			const finalResults = filteredResults.slice(0, limit).map((r: { id: string; filename: string; description: string; score: number }) => {
				const img = imageMap.get(r.id);
				return {
					id: r.id,
					filename: r.filename,
					url: img?.cdnUrl ?? (img?.filePath ? `/uploads/${img.filePath}` : undefined),
					description: r.description,
					score: r.score,
					// Score thresholds: -0.3 or better = strong, -0.3 to -0.6 = moderate, below -0.6 = weak
					relevance: r.score >= -0.3 ? "strong" : r.score >= -0.6 ? "moderate" : "weak",
				};
			});

			return {
				success: true,
				count: finalResults.length,
				query,
				scoreThreshold: minScore,
				images: finalResults,
				hint: finalResults.length === 0
					? "No images matched the query well. Try different keywords or lower the minScore threshold."
					: finalResults[0].relevance === "strong"
						? "Found strong matches - the top result is highly relevant."
						: "Matches found but relevance is moderate/weak - verify they match user intent.",
			};
		} catch (error) {
			return {
				success: false,
				count: 0,
				images: [],
				error: error instanceof Error ? error.message : "Search failed",
			};
		}
	},
});

/**
 * Add image to page section (using inline JSON content pattern)
 */
export const addImageToSectionTool = tool({
	description: "Add an uploaded image to a page section field (hero image, background, etc.). Updates section content with image URL and alt text. IMPORTANT: Check section fields first using cms_getSectionFields to get the correct field name.",
	inputSchema: z.object({
		imageId: z
			.string()
			.describe(
				'Image ID (from findImage or searchImages)'
			),
		pageSectionId: z.string().describe("Page section ID"),
		fieldName: z
			.string()
			.describe('Field name from section template (get exact name using cms_getSectionFields first)'),
		localeCode: z.string().optional().default("en").describe("Locale code (default: 'en')"),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		const { imageId, pageSectionId, fieldName, localeCode = "en" } = input;
		try {
			// Get image details
			const image = await ctx.db.query.images.findFirst({
				where: eq(images.id, imageId),
				with: { metadata: true },
			});

			if (!image) {
				return { success: false, error: "Image not found" };
			}

			if (!image.filePath) {
				return { success: false, error: "Image has no file path" };
			}

			// Get current section content
			const currentContent = await ctx.db.query.pageSectionContents.findFirst({
				where: and(
					eq(pageSectionContents.pageSectionId, pageSectionId),
					eq(pageSectionContents.localeCode, localeCode)
				),
			});

			// Parse existing content or start fresh
			let content: Record<string, unknown> = {};
			if (currentContent) {
				try {
					content = typeof currentContent.content === 'string'
						? JSON.parse(currentContent.content)
						: currentContent.content as Record<string, unknown>;
				} catch (error) {
					ctx.logger.error({ message: 'Failed to parse existing content', error });
				}
			}

			// Add image field with proper URL and alt text
			const imageUrl = `/uploads/${image.filePath}`;
			const altText = image.metadata?.description || image.originalFilename;

			content[fieldName] = {
				url: imageUrl,
				alt: altText,
			};

			// Sync updated content
			await ctx.services.sectionService.syncPageContents({
				pageSectionId,
				localeCode,
				content,
			});

			return {
				success: true,
				message: `Added ${image.originalFilename} to ${fieldName}`,
				imageUrl,
				altText,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to add image",
			};
		}
	},
});

/**
 * Replace image in all sections (using inline JSON content pattern)
 */
export const replaceImageTool = tool({
	description: "Replace one image with another across all page sections. Searches section content and replaces image URLs.",
	inputSchema: z.object({
		oldImageDescription: z
			.string()
			.describe("Description of image to replace"),
		newImageId: z.string().describe("ID of new image"),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		const { oldImageDescription, newImageId } = input;
		try {
			// Find old image
			const searchResult = await ctx.vectorIndex.findImageByDescription(
				oldImageDescription
			);

			// Get full old image details from database
			const oldImage = await ctx.db.query.images.findFirst({
				where: eq(images.id, searchResult.id),
				with: { metadata: true },
			});

			if (!oldImage || !oldImage.filePath) {
				return { success: false, error: "Old image not found or has no file path" };
			}

			// Get new image details
			const newImage = await ctx.db.query.images.findFirst({
				where: eq(images.id, newImageId),
				with: { metadata: true },
			});

			if (!newImage || !newImage.filePath) {
				return { success: false, error: "New image not found or has no file path" };
			}

			// Get all section contents
			const allContents = await ctx.db.query.pageSectionContents.findMany();

			const oldImageUrl = `/uploads/${oldImage.filePath}`;
			const newImageUrl = `/uploads/${newImage.filePath}`;
			const newAltText = newImage.metadata?.description || newImage.originalFilename;

			let replacementCount = 0;

			// Search and replace in all section contents
			for (const contentRecord of allContents) {
				try {
					let content = typeof contentRecord.content === 'string'
						? JSON.parse(contentRecord.content)
						: contentRecord.content as Record<string, unknown>;

					let modified = false;

					// Recursively search for image fields and replace
					const replaceInObject = (obj: Record<string, unknown>): void => {
						for (const key in obj) {
							const value = obj[key];
							// Check if this is an image object with the old URL
							if (
								value &&
								typeof value === 'object' &&
								(value as Record<string, unknown>).url === oldImageUrl
							) {
								obj[key] = {
									url: newImageUrl,
									alt: newAltText,
								};
								modified = true;
								replacementCount++;
							} else if (value && typeof value === 'object') {
								// Recurse into nested objects
								replaceInObject(value as Record<string, unknown>);
							}
						}
					};

					replaceInObject(content);

					// Update if modified
					if (modified) {
						await ctx.db
							.update(pageSectionContents)
							.set({
								content: JSON.stringify(content),
								updatedAt: new Date()
							})
							.where(eq(pageSectionContents.id, contentRecord.id));
					}
				} catch (error) {
					ctx.logger.error({ message: `Failed to process content ${contentRecord.id}`, error });
				}
			}

			return {
				success: true,
				message: `Replaced ${oldImage.originalFilename} with ${newImage.originalFilename} in ${replacementCount} location(s)`,
				oldImageId: oldImage.id,
				newImageId,
				replacementCount,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Replace failed",
			};
		}
	},
});

/**
 * Update section content with uploaded image
 */
export const updateSectionImageTool = tool({
	description: "Update a section's image field with an uploaded image. Use this to change hero images, feature images, etc. to uploaded images from the system. IMPORTANT: Always check section fields first using cms_getSectionFields to get the correct field name before calling this tool.",
	inputSchema: z.object({
		pageSectionId: z.string().describe("Page section ID to update"),
		imageField: z.string().describe("Image field name from section template (get exact name using cms_getSectionFields first)"),
		imageId: z.string().describe("ID of uploaded image to use"),
		localeCode: z.string().optional().default("en").describe("Locale code (default: 'en')"),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		const { pageSectionId, imageField, imageId, localeCode = "en" } = input;
		try {
			// Get section to validate field name
			const section = await ctx.db.query.pageSections.findFirst({
				where: eq(pageSections.id, pageSectionId),
			});

			if (!section) {
				return { success: false, error: "Section not found" };
			}

			// Get section template to validate field
			const sectionTemplate = await ctx.db.query.sectionTemplates.findFirst({
				where: eq(sectionTemplates.id, section.sectionTemplateId),
			});

			if (!sectionTemplate) {
				return { success: false, error: "Section template not found" };
			}

			// Parse fields structure to find image fields
			const structure = typeof sectionTemplate.fields === 'string'
				? JSON.parse(sectionTemplate.fields)
				: sectionTemplate.fields;

			const imageFields: string[] = [];
			if (structure && structure.rows) {
				for (const row of structure.rows) {
					if (row.slots) {
						for (const slot of row.slots) {
							if (slot.type === 'image') {
								imageFields.push(slot.key);
							}
						}
					}
				}
			}

			// Validate imageField exists in template
			if (!imageFields.includes(imageField)) {
				if (imageFields.length === 0) {
					return {
						success: false,
						error: `Section "${sectionTemplate.name}" has no image fields defined`,
					};
				}
				return {
					success: false,
					error: `Field "${imageField}" not found in section template. Available image fields: ${imageFields.join(', ')}`,
					availableImageFields: imageFields,
				};
			}

			// Get image details
			const image = await ctx.db.query.images.findFirst({
				where: eq(images.id, imageId),
				with: { metadata: true },
			});

			if (!image) {
				return { success: false, error: "Image not found" };
			}

			if (!image.filePath) {
				return { success: false, error: "Image has no file path" };
			}

			// Get current section content
			const currentContent = await ctx.db.query.pageSectionContents.findFirst({
				where: and(
					eq(pageSectionContents.pageSectionId, pageSectionId),
					eq(pageSectionContents.localeCode, localeCode)
				),
			});

			// Parse existing content or start fresh
			let content: Record<string, unknown> = {};
			if (currentContent) {
				try {
					content = typeof currentContent.content === 'string'
						? JSON.parse(currentContent.content)
						: currentContent.content as Record<string, unknown>;
				} catch (error) {
					ctx.logger.error({ message: 'Failed to parse existing content', error });
				}
			}

			// Update image field with proper URL and alt text
			const imageUrl = `/uploads/${image.filePath}`;
			const altText = image.metadata?.description || image.originalFilename;

			content[imageField] = {
				url: imageUrl,
				alt: altText,
			};

			// Sync updated content
			await ctx.services.sectionService.syncPageContents({
				pageSectionId,
				localeCode,
				content,
			});

			return {
				success: true,
				message: `Updated ${imageField} with ${image.originalFilename}`,
				imageUrl,
				altText,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to update section image",
			};
		}
	},
});

/**
 * Delete image
 */
export const deleteImageTool = tool({
	description: "Delete an image permanently. This cannot be undone. Requires confirmed: true.",
	inputSchema: z.object({
		description: z.string().describe("Description of image to delete"),
		confirmed: z.boolean().optional().describe("Must be true to delete"),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		const { description, confirmed } = input;
		try {
			// Find image first
			const image = await ctx.vectorIndex.findImageByDescription(description);

			// Require confirmation
			if (!confirmed) {
				return {
					requiresConfirmation: true,
					message: `Are you sure you want to delete image "${image.filename}"? This cannot be undone. Set confirmed: true to proceed.`,
					image: { id: image.id, filename: image.filename }
				};
			}

			// Delete using processing service (handles filesystem + vector index + DB)
			await imageProcessingService.deleteImage(image.id);

			return {
				success: true,
				message: `Deleted image: ${image.filename}`,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Delete failed",
			};
		}
	},
});

/**
 * List all images in the system
 */
export const listAllImagesTool = tool({
	description: "List all images in the entire system (not just current conversation). Use when user asks 'show me all images', 'what images do we have', etc.",
	inputSchema: z.object({
		limit: z.number().optional().describe("Max results (default: 50)"),
		status: z.enum(["completed", "processing", "failed"]).optional().describe("Filter by status (optional)"),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		const { limit = 50, status } = input;
		try {
			const allImages = await ctx.db.query.images.findMany({
				where: status ? eq(images.status, status) : undefined,
				with: {
					metadata: true,
				},
				limit,
				orderBy: (images, { desc }) => [desc(images.uploadedAt)],
			});

			return {
				success: true,
				count: allImages.length,
				images: allImages.map((img) => ({
					id: img.id,
					filename: img.filename,
					originalFilename: img.originalFilename,
					url: img.cdnUrl ?? (img.filePath ? `/uploads/${img.filePath}` : undefined),
					status: img.status,
					uploadedAt: img.uploadedAt,
					description: img.metadata?.description,
					tags: img.metadata?.tags ? JSON.parse(img.metadata.tags as string) : [],
					categories: img.metadata?.categories ? JSON.parse(img.metadata.categories as string) : [],
				})),
			};
		} catch (error) {
			return {
				success: false,
				count: 0,
				images: [],
				error: error instanceof Error ? error.message : "Failed to list images",
			};
		}
	},
});
