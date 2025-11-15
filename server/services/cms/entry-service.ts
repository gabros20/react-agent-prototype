import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../../db/client";
import * as schema from "../../db/schema";
import type { VectorIndexService } from "../vector-index";

export interface CreateCollectionDefInput {
  slug: string;
  name: string;
  description?: string;
  status?: "published" | "unpublished";
  elementsStructure: any;
}

export interface UpdateCollectionDefInput {
  slug?: string;
  name?: string;
  description?: string;
  status?: "published" | "unpublished";
}

export interface UpsertEntryInput {
  collectionId: string;
  slug: string;
  title: string;
  localeCode: string;
  content: Record<string, any>;
}

export class EntryService {
  constructor(
    private db: DrizzleDB,
    private vectorIndex: VectorIndexService,
  ) {}

  async createCollectionDef(input: CreateCollectionDefInput) {
    // Validate slug format
    this.validateSlug(input.slug);

    // Check if slug already exists
    const existing = await this.db.query.collectionDefinitions.findFirst({
      where: eq(schema.collectionDefinitions.slug, input.slug),
    });

    if (existing) {
      throw new Error(`Collection with slug '${input.slug}' already exists`);
    }

    const collectionDef = {
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "published",
      elementsStructure: JSON.stringify(input.elementsStructure),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.collectionDefinitions).values(collectionDef);

    // Index in vector DB
    await this.vectorIndex.add({
      id: collectionDef.id,
      type: "collection",
      name: collectionDef.name,
      slug: collectionDef.slug,
      searchableText: `${collectionDef.name} ${collectionDef.slug} ${collectionDef.description || ""}`,
      metadata: {},
    });

    return collectionDef;
  }

  async updateCollectionDef(id: string, input: UpdateCollectionDefInput) {
    if (input.slug) {
      this.validateSlug(input.slug);

      // Check slug uniqueness (excluding current)
      const existing = await this.db.query.collectionDefinitions.findFirst({
        where: eq(schema.collectionDefinitions.slug, input.slug),
      });

      if (existing && existing.id !== id) {
        throw new Error(`Collection with slug '${input.slug}' already exists`);
      }
    }

    const updated = {
      ...input,
      updatedAt: new Date(),
    };

    await this.db
      .update(schema.collectionDefinitions)
      .set(updated)
      .where(eq(schema.collectionDefinitions.id, id));

    return this.getCollectionDefById(id);
  }

  async getCollectionDefById(id: string) {
    // @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
    return await this.db.query.collectionDefinitions.findFirst({
      where: eq(schema.collectionDefinitions.id, id),
    });
  }

  async getCollectionDefBySlug(slug: string) {
    // @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
    return await this.db.query.collectionDefinitions.findFirst({
      where: eq(schema.collectionDefinitions.slug, slug),
    });
  }

  async listCollectionDefs() {
    return await this.db.query.collectionDefinitions.findMany({});
  }

  async deleteCollectionDef(id: string) {
    await this.db
      .delete(schema.collectionDefinitions)
      .where(eq(schema.collectionDefinitions.id, id));
  }

  async upsertEntry(input: UpsertEntryInput) {
    this.validateSlug(input.slug);

    // Verify collection exists
    const collection = await this.db.query.collectionDefinitions.findFirst({
      where: eq(schema.collectionDefinitions.id, input.collectionId),
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db.insert(schema.collectionEntries).values(newEntry);
      entry = newEntry;
    } else {
      // Update existing entry
      await this.db
        .update(schema.collectionEntries)
        .set({
          title: input.title,
          updatedAt: new Date(),
        })
        .where(eq(schema.collectionEntries.id, entry.id));
    }

    // Upsert entry content
    const existingContent = await this.db.query.entryContents.findFirst({
      where: (ec, { and, eq }) =>
        and(eq(ec.entryId, entry.id), eq(ec.localeCode, input.localeCode)),
    });

    if (existingContent) {
      // Update existing content
      await this.db
        .update(schema.entryContents)
        .set({
          content: JSON.stringify(input.content),
          updatedAt: new Date(),
        })
        .where(eq(schema.entryContents.id, existingContent.id));
    } else {
      // Create new content
      await this.db.insert(schema.entryContents).values({
        id: randomUUID(),
        entryId: entry.id,
        localeCode: input.localeCode,
        content: JSON.stringify(input.content),
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
  async getCollectionEntries(collectionId: string, includeContent = false, localeCode = 'en') {
    // Verify collection exists
    const collection = await this.db.query.collectionDefinitions.findFirst({
      where: eq(schema.collectionDefinitions.id, collectionId),
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
        const content = entry.contents?.find((c: any) => c.localeCode === localeCode);
        return {
          id: entry.id,
          slug: entry.slug,
          title: entry.title,
          collectionId: entry.collectionId,
          content: content?.content || {},
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
      }));
    }
  }

  /**
   * Get content for a specific entry (granular fetching)
   * @param entryId - Entry ID
   * @param localeCode - Locale code (default: 'en')
   */
  async getEntryContent(entryId: string, localeCode = 'en') {
    // Verify entry exists
    const entry = await this.db.query.collectionEntries.findFirst({
      where: eq(schema.collectionEntries.id, entryId),
    });

    if (!entry) {
      throw new Error(`Entry with id '${entryId}' not found`);
    }

    // Get content for locale
    const content = await this.db.query.entryContents.findFirst({
      where: (ec, { and, eq }) =>
        and(eq(ec.entryId, entryId), eq(ec.localeCode, localeCode)),
    });

    if (!content) {
      return {
        entryId,
        slug: entry.slug,
        title: entry.title,
        localeCode,
        content: {},
        message: 'No content found for this locale',
      };
    }

    return {
      entryId,
      slug: entry.slug,
      title: entry.title,
      localeCode,
      content: content.content,
    };
  }

  private validateSlug(slug: string): void {
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
      throw new Error(
        "Invalid slug format: must be lowercase, alphanumeric with hyphens, 2-64 chars",
      );
    }
  }
}
