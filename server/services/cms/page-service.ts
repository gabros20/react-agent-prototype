import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import type { DrizzleDB } from "../../db/client";
import * as schema from "../../db/schema";
import type { VectorIndexService } from "../vector-index";

export interface CreatePageInput {
  name: string;
  slug: string;
  siteId: string;
  environmentId: string;
  indexing?: boolean;
  meta?: Record<string, any>;
}

export interface UpdatePageInput {
  name?: string;
  slug?: string;
  indexing?: boolean;
  meta?: Record<string, any>;
}

export class PageService {
  constructor(
    public db: DrizzleDB,
    private vectorIndex: VectorIndexService,
  ) {}

  async createPage(input: CreatePageInput) {
    // Validation
    this.validateSlug(input.slug);

    // Check if slug already exists
    const existing = await this.db.query.pages.findFirst({
      where: eq(schema.pages.slug, input.slug),
    });

    if (existing) {
      throw new Error(`Page with slug '${input.slug}' already exists`);
    }

    // Create page
    const page = {
      id: randomUUID(),
      siteId: input.siteId,
      environmentId: input.environmentId,
      slug: input.slug,
      name: input.name,
      indexing: input.indexing ?? true,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.pages).values(page);

    // Index in vector DB
    await this.vectorIndex.add({
      id: page.id,
      type: "page",
      name: page.name,
      slug: page.slug,
      searchableText: `${page.name} ${page.slug}`,
      metadata: { siteId: page.siteId },
    });

    return page;
  }

  async updatePage(id: string, input: UpdatePageInput) {
    const original = await this.getPageById(id);
    if (!original) {
      throw new Error("Page not found");
    }

    if (input.slug) {
      this.validateSlug(input.slug);

      // Check slug uniqueness (excluding current page)
      const existing = await this.db.query.pages.findFirst({
        where: eq(schema.pages.slug, input.slug),
      });

      if (existing && existing.id !== id) {
        throw new Error(`Page with slug '${input.slug}' already exists`);
      }
    }

    const updated = {
      ...input,
      meta: input.meta ? JSON.stringify(input.meta) : undefined,
      updatedAt: new Date(),
    };

    await this.db.update(schema.pages).set(updated).where(eq(schema.pages.id, id));

    // Re-index if name/slug changed
    if (input.name !== original.name || input.slug !== original.slug) {
      await this.vectorIndex.update(id, {
        type: "page",
        name: input.name || original.name,
        slug: input.slug || original.slug,
        searchableText: `${input.name || original.name} ${input.slug || original.slug}`,
        metadata: { siteId: original.siteId },
      });
    }

    return this.getPageById(id);
  }

  async getPageById(id: string) {
    // @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
    return await this.db.query.pages.findFirst({
      where: eq(schema.pages.id, id),
      with: {
        pageSections: {
          with: {
            sectionDefinition: true,
            contents: true,
          },
          orderBy: (ps, { asc }) => [asc(ps.sortOrder)],
        },
      },
    });
  }

  async getPageBySlug(slug: string, includeContent = false, localeCode = 'en') {
    if (!includeContent) {
      // Lightweight - only page metadata and section IDs
      // @ts-ignore - Drizzle ORM query.findFirst() has complex overloads
      const page = await this.db.query.pages.findFirst({
        where: eq(schema.pages.slug, slug),
        with: {
          pageSections: {
            with: {
              sectionDefinition: true,
            },
            orderBy: (ps, { asc }) => [asc(ps.sortOrder)],
          },
        },
      });

      if (!page) return null;

      return {
        ...page,
        sectionIds: (page as any).pageSections?.map((ps: any) => ps.id) || [],
        sectionCount: (page as any).pageSections?.length || 0,
      };
    }

    // Full fetch - includes all content (original behavior)
    // @ts-ignore - Drizzle ORM query.findFirst() has complex overloads
    const page = await this.db.query.pages.findFirst({
      where: eq(schema.pages.slug, slug),
      with: {
        pageSections: {
          with: {
            sectionDefinition: true,
            contents: true,
          },
          orderBy: (ps, { asc }) => [asc(ps.sortOrder)],
        },
      },
    });

    if (!page) return null;

    // Format sections with content for requested locale
    return {
      ...page,
      pageSections: (page as any).pageSections?.map((ps: any) => {
        const contentRecord = ps.contents?.find((c: any) => c.localeCode === localeCode);
        
        // Parse content if it's a JSON string
        let parsedContent = {};
        if (contentRecord?.content) {
          try {
            parsedContent = typeof contentRecord.content === 'string' 
              ? JSON.parse(contentRecord.content) 
              : contentRecord.content;
          } catch (error) {
            console.error(`Failed to parse content for section ${ps.id}:`, error);
          }
        }
        
        return {
          ...ps,
          content: parsedContent,
        };
      }),
    };
  }

  async listPages(query?: string) {
    if (query) {
      return await this.db.query.pages.findMany({
        where: like(schema.pages.name, `%${query}%`),
      });
    }
    return await this.db.query.pages.findMany({});
  }

  async deletePage(id: string) {
    await this.db.delete(schema.pages).where(eq(schema.pages.id, id));

    // Remove from vector index
    await this.vectorIndex.delete(id);
  }

  private validateSlug(slug: string): void {
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
      throw new Error(
        "Invalid slug format: must be lowercase, alphanumeric with hyphens, 2-64 chars",
      );
    }
  }
}
