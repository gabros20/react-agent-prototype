import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../../db/client";
import * as schema from "../../db/schema";
import type { VectorIndexService } from "../vector-index";

export interface CreateCollectionTemplateInput {
	slug: string;
	name: string;
	description?: string;
	status?: "published" | "unpublished";
	fields: any; // RENAMED: elementsStructure → fields
	hasSlug?: boolean; // NEW
	orderDirection?: "asc" | "desc"; // NEW
}

export interface UpdateCollectionTemplateInput {
	slug?: string;
	name?: string;
	description?: string;
	status?: "published" | "unpublished";
	hasSlug?: boolean;
	orderDirection?: "asc" | "desc";
}

export interface UpsertEntryInput {
	collectionId: string;
	slug: string;
	title: string;
	localeCode: string;
	content: Record<string, any>;
	// Post metadata (optional)
	author?: string;
	excerpt?: string;
	featuredImage?: string;
	category?: string;
}

export interface UpdateEntryMetadataInput {
	title?: string;
	author?: string;
	excerpt?: string;
	featuredImage?: string;
	category?: string;
	status?: "draft" | "published" | "archived";
}

export class EntryService {
	constructor(private db: DrizzleDB, private vectorIndex: VectorIndexService) {}

	async createCollectionTemplate(input: CreateCollectionTemplateInput) {
		// Validate slug format
		this.validateSlug(input.slug);

		// Check if slug already exists
		const existing = await this.db.query.collectionTemplates.findFirst({
			where: eq(schema.collectionTemplates.slug, input.slug),
		});

		if (existing) {
			throw new Error(`Collection with slug '${input.slug}' already exists`);
		}

		const collectionTemplate = {
			id: randomUUID(),
			slug: input.slug,
			name: input.name,
			description: input.description ?? null,
			status: input.status ?? "published",
			fields: JSON.stringify(input.fields),
			hasSlug: input.hasSlug ?? true,
			orderDirection: input.orderDirection ?? "desc",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		await this.db.insert(schema.collectionTemplates).values(collectionTemplate);

		// Index in vector DB
		await this.vectorIndex.add({
			id: collectionTemplate.id,
			type: "collection",
			name: collectionTemplate.name,
			slug: collectionTemplate.slug,
			searchableText: `${collectionTemplate.name} ${collectionTemplate.slug} ${collectionTemplate.description || ""}`,
			metadata: {},
		});

		return collectionTemplate;
	}

	async updateCollectionTemplate(id: string, input: UpdateCollectionTemplateInput) {
		if (input.slug) {
			this.validateSlug(input.slug);

			// Check slug uniqueness (excluding current)
			const existing = await this.db.query.collectionTemplates.findFirst({
				where: eq(schema.collectionTemplates.slug, input.slug),
			});

			if (existing && existing.id !== id) {
				throw new Error(`Collection with slug '${input.slug}' already exists`);
			}
		}

		const updated = {
			...input,
			updatedAt: new Date(),
		};

		await this.db.update(schema.collectionTemplates).set(updated).where(eq(schema.collectionTemplates.id, id));

		return this.getCollectionTemplateById(id);
	}

	async getCollectionTemplateById(id: string) {
		// @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
		return await this.db.query.collectionTemplates.findFirst({
			where: eq(schema.collectionTemplates.id, id),
		});
	}

	async getCollectionTemplateBySlug(slug: string) {
		// @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
		return await this.db.query.collectionTemplates.findFirst({
			where: eq(schema.collectionTemplates.slug, slug),
		});
	}

	async listCollectionTemplates() {
		return await this.db.query.collectionTemplates.findMany({});
	}

	async deleteCollectionTemplate(id: string) {
		await this.db.delete(schema.collectionTemplates).where(eq(schema.collectionTemplates.id, id));
	}

	async upsertEntry(input: UpsertEntryInput) {
		this.validateSlug(input.slug);

		// Verify collection exists
		const collection = await this.db.query.collectionTemplates.findFirst({
			where: eq(schema.collectionTemplates.id, input.collectionId),
		});

		if (!collection) {
			throw new Error(`Collection with id '${input.collectionId}' not found`);
		}

		// Verify locale exists
		const locale = await this.db.query.locales.findFirst({
			where: eq(schema.locales.code, input.localeCode),
		});

		if (!locale) {
			throw new Error(`Locale with code '${input.localeCode}' not found`);
		}

		// Resolve image paths (UUID -> /uploads/ path)
		const resolvedFeaturedImage = await this.resolveImagePath(input.featuredImage);
		const resolvedContent = await this.resolveContentImagePaths({ ...input.content });

		// Check if entry already exists
		let entry = await this.db.query.collectionEntries.findFirst({
			where: eq(schema.collectionEntries.slug, input.slug),
		});

		const isNew = !entry;

		if (!entry) {
			// Create new entry
			const newEntry = {
				id: randomUUID(),
				collectionId: input.collectionId,
				slug: input.slug,
				title: input.title,
				status: "draft" as const,
				author: input.author ?? null,
				excerpt: input.excerpt ?? null,
				featuredImage: resolvedFeaturedImage,
				category: input.category ?? null,
				publishedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			await this.db.insert(schema.collectionEntries).values(newEntry);
			entry = newEntry;
		} else {
			// Update existing entry
			const updateData: any = {
				title: input.title,
				updatedAt: new Date(),
			};

			// Update metadata if provided
			if (input.author !== undefined) updateData.author = input.author;
			if (input.excerpt !== undefined) updateData.excerpt = input.excerpt;
			if (input.featuredImage !== undefined) updateData.featuredImage = resolvedFeaturedImage;
			if (input.category !== undefined) updateData.category = input.category;

			await this.db.update(schema.collectionEntries).set(updateData).where(eq(schema.collectionEntries.id, entry.id));
		}

		// Upsert entry content
		const existingContent = await this.db.query.entryContents.findFirst({
			where: (ec, { and, eq }) => and(eq(ec.entryId, entry.id), eq(ec.localeCode, input.localeCode)),
		});

		if (existingContent) {
			// Update existing content
			await this.db
				.update(schema.entryContents)
				.set({
					content: JSON.stringify(resolvedContent),
					updatedAt: new Date(),
				})
				.where(eq(schema.entryContents.id, existingContent.id));
		} else {
			// Create new content
			await this.db.insert(schema.entryContents).values({
				id: randomUUID(),
				entryId: entry.id,
				localeCode: input.localeCode,
				content: JSON.stringify(resolvedContent),
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		// Index in vector DB (only on create)
		if (isNew) {
			await this.vectorIndex.add({
				id: entry.id,
				type: "entry",
				name: entry.title,
				slug: entry.slug,
				searchableText: `${entry.title} ${entry.slug}`,
				metadata: { collectionId: entry.collectionId },
			});
		}

		return entry;
	}

	async listEntries(collectionId: string, localeCode?: string) {
		if (localeCode) {
			return await this.db.query.collectionEntries.findMany({
				where: eq(schema.collectionEntries.collectionId, collectionId),
				with: {
					contents: {
						where: eq(schema.entryContents.localeCode, localeCode),
					},
				},
			});
		}

		return await this.db.query.collectionEntries.findMany({
			where: eq(schema.collectionEntries.collectionId, collectionId),
			with: {
				contents: true,
			},
		});
	}

	async getEntryById(id: string, localeCode?: string) {
		if (localeCode) {
			// @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
			return await this.db.query.collectionEntries.findFirst({
				where: eq(schema.collectionEntries.id, id),
				with: {
					contents: {
						where: eq(schema.entryContents.localeCode, localeCode),
					},
				},
			});
		}

		// @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
		return await this.db.query.collectionEntries.findFirst({
			where: eq(schema.collectionEntries.id, id),
			with: {
				contents: true,
			},
		});
	}

	async deleteEntry(id: string) {
		await this.db.delete(schema.collectionEntries).where(eq(schema.collectionEntries.id, id));

		// Remove from vector index
		await this.vectorIndex.delete(id);
	}

	/**
	 * Get all entries for a collection (granular fetching)
	 * @param collectionId - Collection ID
	 * @param includeContent - Include full content (default: false for token efficiency)
	 * @param localeCode - Locale for content (default: 'en')
	 */
	async getCollectionEntries(collectionId: string, includeContent = false, localeCode = "en") {
		// Verify collection exists
		const collection = await this.db.query.collectionTemplates.findFirst({
			where: eq(schema.collectionTemplates.id, collectionId),
		});

		if (!collection) {
			throw new Error(`Collection with id '${collectionId}' not found`);
		}

		// Fetch entries with optional content
		if (includeContent) {
			const entries = await this.db.query.collectionEntries.findMany({
				where: eq(schema.collectionEntries.collectionId, collectionId),
				with: {
					contents: true,
				},
			});

			// Format response with content for requested locale
			return entries.map((entry: any) => {
				const contentRecord = entry.contents?.find((c: any) => c.localeCode === localeCode);

				// Parse content if it's a JSON string
				let parsedContent = {};
				if (contentRecord?.content) {
					try {
						parsedContent = typeof contentRecord.content === "string" ? JSON.parse(contentRecord.content) : contentRecord.content;
					} catch (error) {
						console.error(`Failed to parse content for entry ${entry.id}:`, error);
					}
				}

				return {
					id: entry.id,
					slug: entry.slug,
					title: entry.title,
					collectionId: entry.collectionId,
					status: entry.status,
					author: entry.author,
					excerpt: entry.excerpt,
					featuredImage: entry.featuredImage,
					category: entry.category,
					publishedAt: entry.publishedAt,
					createdAt: entry.createdAt,
					content: parsedContent,
				};
			});
		} else {
			// Lightweight - only metadata
			const entries = await this.db.query.collectionEntries.findMany({
				where: eq(schema.collectionEntries.collectionId, collectionId),
			});

			return entries.map((entry: any) => ({
				id: entry.id,
				slug: entry.slug,
				title: entry.title,
				collectionId: entry.collectionId,
				status: entry.status,
				author: entry.author,
				excerpt: entry.excerpt,
				featuredImage: entry.featuredImage,
				category: entry.category,
				publishedAt: entry.publishedAt,
				createdAt: entry.createdAt,
			}));
		}
	}

	/**
	 * Get content for a specific entry (granular fetching)
	 * @param entryId - Entry ID
	 * @param localeCode - Locale code (default: 'en')
	 */
	async getEntryContent(entryId: string, localeCode = "en") {
		// Verify entry exists
		const entry = await this.db.query.collectionEntries.findFirst({
			where: eq(schema.collectionEntries.id, entryId),
		});

		if (!entry) {
			throw new Error(`Entry with id '${entryId}' not found`);
		}

		// Get content for locale
		const content = await this.db.query.entryContents.findFirst({
			where: (ec, { and, eq }) => and(eq(ec.entryId, entryId), eq(ec.localeCode, localeCode)),
		});

		if (!content) {
			return {
				entryId,
				slug: entry.slug,
				title: entry.title,
				localeCode,
				content: {},
				message: "No content found for this locale",
			};
		}

		// Parse content if it's a JSON string
		let parsedContent = {};
		if (content.content) {
			try {
				parsedContent = typeof content.content === "string" ? JSON.parse(content.content) : content.content;
			} catch (error) {
				console.error(`Failed to parse content for entry ${entryId}:`, error);
			}
		}

		return {
			entryId,
			slug: entry.slug,
			title: entry.title,
			localeCode,
			content: parsedContent,
		};
	}

	/**
	 * Publish an entry (set status to published and set publishedAt timestamp)
	 * @param id - Entry ID
	 */
	async publishEntry(id: string) {
		const entry = await this.db.query.collectionEntries.findFirst({
			where: eq(schema.collectionEntries.id, id),
		});

		if (!entry) {
			throw new Error(`Entry with id '${id}' not found`);
		}

		const updateData: any = {
			status: "published",
			updatedAt: new Date(),
		};

		// Set publishedAt only if not already published
		if (!entry.publishedAt) {
			updateData.publishedAt = new Date();
		}

		await this.db.update(schema.collectionEntries).set(updateData).where(eq(schema.collectionEntries.id, id));

		return this.getEntryById(id);
	}

	/**
	 * Archive an entry (set status to archived)
	 * @param id - Entry ID
	 */
	async archiveEntry(id: string) {
		const entry = await this.db.query.collectionEntries.findFirst({
			where: eq(schema.collectionEntries.id, id),
		});

		if (!entry) {
			throw new Error(`Entry with id '${id}' not found`);
		}

		await this.db
			.update(schema.collectionEntries)
			.set({
				status: "archived",
				updatedAt: new Date(),
			})
			.where(eq(schema.collectionEntries.id, id));

		return this.getEntryById(id);
	}

	/**
	 * Update entry metadata (title, author, excerpt, featuredImage, category)
	 * @param id - Entry ID
	 * @param metadata - Metadata to update
	 */
	async updateEntryMetadata(id: string, metadata: UpdateEntryMetadataInput) {
		const entry = await this.db.query.collectionEntries.findFirst({
			where: eq(schema.collectionEntries.id, id),
		});

		if (!entry) {
			throw new Error(`Entry with id '${id}' not found`);
		}

		const updateData: any = {
			updatedAt: new Date(),
		};

		if (metadata.title !== undefined) updateData.title = metadata.title;
		if (metadata.author !== undefined) updateData.author = metadata.author;
		if (metadata.excerpt !== undefined) updateData.excerpt = metadata.excerpt;
		if (metadata.featuredImage !== undefined) {
			// Resolve UUID to path if needed
			updateData.featuredImage = await this.resolveImagePath(metadata.featuredImage);
		}
		if (metadata.category !== undefined) updateData.category = metadata.category;
		if (metadata.status !== undefined) {
			updateData.status = metadata.status;
			// Clear publishedAt if reverting to draft, set it if publishing
			if (metadata.status === "draft") {
				updateData.publishedAt = null;
			} else if (metadata.status === "published" && !entry.publishedAt) {
				updateData.publishedAt = new Date();
			}
		}

		await this.db.update(schema.collectionEntries).set(updateData).where(eq(schema.collectionEntries.id, id));

		return this.getEntryById(id);
	}

	/**
	 * List published entries for a collection
	 * @param collectionId - Collection ID
	 * @param localeCode - Locale code (default: 'en')
	 */
	async listPublishedEntries(collectionId: string, localeCode = "en") {
		const entries = await this.db.query.collectionEntries.findMany({
			where: (ce, { and, eq }) => and(eq(ce.collectionId, collectionId), eq(ce.status, "published")),
			with: {
				contents: {
					where: eq(schema.entryContents.localeCode, localeCode),
				},
			},
			orderBy: (ce, { desc }) => [desc(ce.publishedAt)],
		});

		return entries.map((entry: any) => {
			const contentRecord = entry.contents?.[0];
			let parsedContent = {};

			if (contentRecord?.content) {
				try {
					parsedContent = typeof contentRecord.content === "string" ? JSON.parse(contentRecord.content) : contentRecord.content;
				} catch (error) {
					console.error(`Failed to parse content for entry ${entry.id}:`, error);
				}
			}

			return {
				id: entry.id,
				slug: entry.slug,
				title: entry.title,
				status: entry.status,
				author: entry.author,
				excerpt: entry.excerpt,
				featuredImage: entry.featuredImage,
				category: entry.category,
				publishedAt: entry.publishedAt,
				createdAt: entry.createdAt,
				content: parsedContent,
			};
		});
	}

	/**
	 * Get entries by category
	 * @param collectionId - Collection ID
	 * @param category - Category to filter by
	 * @param localeCode - Locale code (default: 'en')
	 */
	async getEntriesByCategory(collectionId: string, category: string, localeCode = "en") {
		const entries = await this.db.query.collectionEntries.findMany({
			where: (ce, { and, eq }) => and(eq(ce.collectionId, collectionId), eq(ce.category, category), eq(ce.status, "published")),
			with: {
				contents: {
					where: eq(schema.entryContents.localeCode, localeCode),
				},
			},
			orderBy: (ce, { desc }) => [desc(ce.publishedAt)],
		});

		return entries.map((entry: any) => {
			const contentRecord = entry.contents?.[0];
			let parsedContent = {};

			if (contentRecord?.content) {
				try {
					parsedContent = typeof contentRecord.content === "string" ? JSON.parse(contentRecord.content) : contentRecord.content;
				} catch (error) {
					console.error(`Failed to parse content for entry ${entry.id}:`, error);
				}
			}

			return {
				id: entry.id,
				slug: entry.slug,
				title: entry.title,
				status: entry.status,
				author: entry.author,
				excerpt: entry.excerpt,
				featuredImage: entry.featuredImage,
				category: entry.category,
				publishedAt: entry.publishedAt,
				createdAt: entry.createdAt,
				content: parsedContent,
			};
		});
	}

	/**
	 * Get entry by slug
	 * @param slug - Entry slug
	 * @param localeCode - Locale code (default: 'en')
	 */
	async getEntryBySlug(slug: string, localeCode = "en") {
		// @ts-ignore - Drizzle ORM query.findFirst() has complex overloads
		const entry = await this.db.query.collectionEntries.findFirst({
			where: eq(schema.collectionEntries.slug, slug),
			with: {
				contents: {
					where: eq(schema.entryContents.localeCode, localeCode),
				},
				collection: true,
			},
		});

		if (!entry) {
			return null;
		}

		const contentRecord = entry.contents?.[0];
		let parsedContent = {};

		if (contentRecord?.content) {
			try {
				parsedContent = typeof contentRecord.content === "string" ? JSON.parse(contentRecord.content) : contentRecord.content;
			} catch (error) {
				console.error(`Failed to parse content for entry ${entry.id}:`, error);
			}
		}

		return {
			id: entry.id,
			slug: entry.slug,
			title: entry.title,
			status: entry.status,
			author: entry.author,
			excerpt: entry.excerpt,
			featuredImage: entry.featuredImage,
			category: entry.category,
			publishedAt: entry.publishedAt,
			createdAt: entry.createdAt,
			content: parsedContent,
			collection: entry.collection,
		};
	}

	private validateSlug(slug: string): void {
		if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
			throw new Error("Invalid slug format: must be lowercase, alphanumeric with hyphens, 2-64 chars");
		}
	}

	/**
	 * Check if a string is a UUID format
	 */
	private isUuid(value: string): boolean {
		return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
	}

	/**
	 * Resolve an image reference to a full path.
	 * - If value is a UUID, looks up the `images` table and returns `/uploads/${filePath}`
	 * - If value is already a path/URL (contains '/'), returns as-is
	 * - Returns null if UUID not found or value is null/undefined
	 */
	async resolveImagePath(value: string | null | undefined): Promise<string | null> {
		if (!value) return null;

		// If it's already a path (contains '/'), return as-is
		if (value.includes("/")) {
			return value;
		}

		// Check if it's a UUID
		if (this.isUuid(value)) {
			const image = await this.db.query.images.findFirst({
				where: eq(schema.images.id, value),
				columns: { filePath: true },
			});

			if (image?.filePath) {
				return `/uploads/${image.filePath}`;
			}

			// UUID not found in images table
			return null;
		}

		// Not a UUID and not a path - return as-is (could be an external URL)
		return value;
	}

	/**
	 * Resolve image paths in content object (mutates the object)
	 * Specifically handles content.cover.url
	 */
	async resolveContentImagePaths(content: Record<string, any>): Promise<Record<string, any>> {
		if (content.cover && typeof content.cover === "object" && content.cover.url) {
			const resolvedUrl = await this.resolveImagePath(content.cover.url);
			if (resolvedUrl) {
				content.cover.url = resolvedUrl;
			}
		}
		return content;
	}
}
