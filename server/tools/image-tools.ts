import { tool } from "ai";
import { z } from "zod";
import { db } from "../db/client";
import { images, conversationImages, pageSectionContents } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import imageProcessingService from "../services/storage/image-processing.service";

/**
 * Find image by natural language description
 */
export const findImageTool: any = tool({
	description:
		"Find an image by natural language description. Use when user mentions an image or asks to find/delete/modify a specific image.",
	inputSchema: z.object({
		description: z
			.string()
			.describe(
				'Natural language description (e.g., "the puppy image", "sunset photo")'
			),
	}),
	execute: async (input: { description: string }): Promise<any> => {
		const { description } = input;
		try {
			const { default: vectorIndex } = await import("../services/vector-index");
			const result = await vectorIndex.findImageByDescription(description);

			// Get full image details
			const image = await db.query.images.findFirst({
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
 * Search for multiple images
 */
export const searchImagesTool: any = tool({
	description: "Search for multiple images using natural language",
	inputSchema: z.object({
		query: z.string().describe("Search query"),
		limit: z.number().optional().describe("Max results (default: 10)"),
	}),
	execute: async (input: { query: string; limit?: number }): Promise<any> => {
		const { query, limit = 10 } = input;
		try {
			const { default: vectorIndex } = await import("../services/vector-index");
			const { results } = await vectorIndex.searchImages(query, { limit });

			// Get full image data including URLs from database
			const imageIds = results.map((r: any) => r.id);
			const fullImages = await db.query.images.findMany({
				where: (images, { inArray }) => inArray(images.id, imageIds),
				with: { metadata: true },
			});

			// Create lookup map for quick access
			const imageMap = new Map(fullImages.map(img => [img.id, img]));

			return {
				success: true,
				count: results.length,
				images: results.map((r: any) => {
					const img = imageMap.get(r.id);
					return {
						id: r.id,
						filename: r.filename,
						url: img?.cdnUrl ?? (img?.filePath ? `/uploads/${img.filePath}` : undefined),
						description: r.description,
						score: r.score,
					};
				}),
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
 * List images in current conversation
 */
export const listConversationImagesTool: any = tool({
	description: "List all images uploaded in the current conversation",
	inputSchema: z.object({
		sessionId: z.string().describe("Session/conversation ID"),
	}),
	execute: async (input: { sessionId: string }): Promise<any> => {
		const { sessionId } = input;
		try {
			const conversationImgs = await db.query.conversationImages.findMany({
				where: eq(conversationImages.sessionId, sessionId),
				with: {
					image: {
						with: {
							metadata: true,
						},
					},
				},
			});

			return {
				success: true,
				images: conversationImgs.map((ci) => ({
					id: ci.image.id,
					filename: ci.image.filename,
					status: ci.image.status,
					uploadedAt: ci.uploadedAt,
					description: ci.image.metadata?.description,
				})),
			};
		} catch (error) {
			return {
				success: false,
				images: [],
				error: error instanceof Error ? error.message : "Failed to list images",
			};
		}
	},
});

/**
 * Add image to page section (using inline JSON content pattern)
 */
export const addImageToSectionTool: any = tool({
	description: "Add an uploaded image to a page section field (hero image, background, etc.). Updates section content with image URL and alt text. IMPORTANT: Check section definition first using cms_getSectionDef to get the correct field name.",
	inputSchema: z.object({
		imageId: z
			.string()
			.describe(
				'Image ID (from findImage or listConversationImages)'
			),
		pageSectionId: z.string().describe("Page section ID"),
		fieldName: z
			.string()
			.describe('Field name from section definition (get exact name using cms_getSectionDef first)'),
		localeCode: z.string().optional().default("en").describe("Locale code (default: 'en')"),
	}),
	execute: async (input: { imageId: string; pageSectionId: string; fieldName: string; localeCode?: string }): Promise<any> => {
		const { imageId, pageSectionId, fieldName, localeCode = "en" } = input;
		try {
			// Get image details
			const image = await db.query.images.findFirst({
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
			const currentContent = await db.query.pageSectionContents.findFirst({
				where: and(
					eq(pageSectionContents.pageSectionId, pageSectionId),
					eq(pageSectionContents.localeCode, localeCode)
				),
			});

			// Parse existing content or start fresh
			let content: Record<string, any> = {};
			if (currentContent) {
				try {
					content = typeof currentContent.content === 'string'
						? JSON.parse(currentContent.content)
						: currentContent.content as Record<string, any>;
				} catch (error) {
					console.error('Failed to parse existing content:', error);
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
			const { SectionService } = await import("../services/cms/section-service");
			const { default: vectorIndex } = await import("../services/vector-index");
			const service = new SectionService(db, vectorIndex);
			await service.syncPageContents({
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
export const replaceImageTool: any = tool({
	description: "Replace one image with another across all page sections. Searches section content and replaces image URLs.",
	inputSchema: z.object({
		oldImageDescription: z
			.string()
			.describe("Description of image to replace"),
		newImageId: z.string().describe("ID of new image"),
	}),
	execute: async (input: { oldImageDescription: string; newImageId: string }): Promise<any> => {
		const { oldImageDescription, newImageId } = input;
		try {
			// Find old image
			const { default: vectorIndex } = await import("../services/vector-index");
			const searchResult = await vectorIndex.findImageByDescription(
				oldImageDescription
			);

			// Get full old image details from database
			const oldImage = await db.query.images.findFirst({
				where: eq(images.id, searchResult.id),
				with: { metadata: true },
			});

			if (!oldImage || !oldImage.filePath) {
				return { success: false, error: "Old image not found or has no file path" };
			}

			// Get new image details
			const newImage = await db.query.images.findFirst({
				where: eq(images.id, newImageId),
				with: { metadata: true },
			});

			if (!newImage || !newImage.filePath) {
				return { success: false, error: "New image not found or has no file path" };
			}

			// Get all section contents
			const allContents = await db.query.pageSectionContents.findMany();

			const oldImageUrl = `/uploads/${oldImage.filePath}`;
			const newImageUrl = `/uploads/${newImage.filePath}`;
			const newAltText = newImage.metadata?.description || newImage.originalFilename;

			let replacementCount = 0;

			// Search and replace in all section contents
			for (const contentRecord of allContents) {
				try {
					let content = typeof contentRecord.content === 'string'
						? JSON.parse(contentRecord.content)
						: contentRecord.content as Record<string, any>;

					let modified = false;

					// Recursively search for image fields and replace
					const replaceInObject = (obj: any): void => {
						for (const key in obj) {
							const value = obj[key];
							// Check if this is an image object with the old URL
							if (
								value &&
								typeof value === 'object' &&
								value.url === oldImageUrl
							) {
								obj[key] = {
									url: newImageUrl,
									alt: newAltText,
								};
								modified = true;
								replacementCount++;
							} else if (value && typeof value === 'object') {
								// Recurse into nested objects
								replaceInObject(value);
							}
						}
					};

					replaceInObject(content);

					// Update if modified
					if (modified) {
						await db
							.update(pageSectionContents)
							.set({
								content: JSON.stringify(content),
								updatedAt: new Date()
							})
							.where(eq(pageSectionContents.id, contentRecord.id));
					}
				} catch (error) {
					console.error(`Failed to process content ${contentRecord.id}:`, error);
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
export const updateSectionImageTool: any = tool({
	description: "Update a section's image field with an uploaded image. Use this to change hero images, feature images, etc. to uploaded images from the system. IMPORTANT: Always check the section definition first using cms_getSectionDef to get the correct field name before calling this tool.",
	inputSchema: z.object({
		pageSectionId: z.string().describe("Page section ID to update"),
		imageField: z.string().describe("Image field name from section definition (get exact name using cms_getSectionDef first)"),
		imageId: z.string().describe("ID of uploaded image to use"),
		localeCode: z.string().optional().default("en").describe("Locale code (default: 'en')"),
	}),
	execute: async (input: { pageSectionId: string; imageField: string; imageId: string; localeCode?: string }): Promise<any> => {
		const { pageSectionId, imageField, imageId, localeCode = "en" } = input;
		try {
			// Get section to validate field name
			const { pageSections, sectionDefinitions } = await import("../db/schema");
			const section = await db.query.pageSections.findFirst({
				where: eq(pageSections.id, pageSectionId),
			});

			if (!section) {
				return { success: false, error: "Section not found" };
			}

			// Get section definition to validate field
			const sectionDef = await db.query.sectionDefinitions.findFirst({
				where: eq(sectionDefinitions.id, section.sectionDefId),
			});

			if (!sectionDef) {
				return { success: false, error: "Section definition not found" };
			}

			// Parse elements structure to find image fields
			const structure = typeof sectionDef.elementsStructure === 'string'
				? JSON.parse(sectionDef.elementsStructure)
				: sectionDef.elementsStructure;

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

			// Validate imageField exists in definition
			if (!imageFields.includes(imageField)) {
				if (imageFields.length === 0) {
					return {
						success: false,
						error: `Section "${sectionDef.name}" has no image fields defined`,
					};
				}
				return {
					success: false,
					error: `Field "${imageField}" not found in section definition. Available image fields: ${imageFields.join(', ')}`,
					availableImageFields: imageFields,
				};
			}

			// Get image details
			const image = await db.query.images.findFirst({
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
			const currentContent = await db.query.pageSectionContents.findFirst({
				where: and(
					eq(pageSectionContents.pageSectionId, pageSectionId),
					eq(pageSectionContents.localeCode, localeCode)
				),
			});

			// Parse existing content or start fresh
			let content: Record<string, any> = {};
			if (currentContent) {
				try {
					content = typeof currentContent.content === 'string'
						? JSON.parse(currentContent.content)
						: currentContent.content as Record<string, any>;
				} catch (error) {
					console.error('Failed to parse existing content:', error);
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
			const { SectionService } = await import("../services/cms/section-service");
			const { default: vectorIndex } = await import("../services/vector-index");
			const service = new SectionService(db, vectorIndex);
			await service.syncPageContents({
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
export const deleteImageTool: any = tool({
	description: "Delete an image by finding it with natural language",
	inputSchema: z.object({
		description: z.string().describe("Description of image to delete"),
	}),
	execute: async (input: { description: string }): Promise<any> => {
		const { description } = input;
		try {
			// Find image
			const { default: vectorIndex } = await import("../services/vector-index");
			const image = await vectorIndex.findImageByDescription(description);

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
export const listAllImagesTool: any = tool({
	description: "List all images in the entire system (not just current conversation). Use when user asks 'show me all images', 'what images do we have', etc.",
	inputSchema: z.object({
		limit: z.number().optional().describe("Max results (default: 50)"),
		status: z.enum(["completed", "processing", "failed"]).optional().describe("Filter by status (optional)"),
	}),
	execute: async (input: { limit?: number; status?: "completed" | "processing" | "failed" }): Promise<any> => {
		const { limit = 50, status } = input;
		try {
			const allImages = await db.query.images.findMany({
				where: status ? eq(images.status, status as "completed" | "processing" | "failed") : undefined,
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
