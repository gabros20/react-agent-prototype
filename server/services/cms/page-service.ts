import { DrizzleDB } from "../../db/client";
import * as schema from "../../db/schema";
import { eq, like } from "drizzle-orm";
import { randomUUID } from "crypto";

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
  constructor(public db: DrizzleDB) {}

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

    return page;
  }

  async updatePage(id: string, input: UpdatePageInput) {
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

    return this.getPageById(id);
  }

  async getPageById(id: string) {
    return await this.db.query.pages.findFirst({
      where: eq(schema.pages.id, id),
    });
  }

  async getPageBySlug(slug: string) {
    return await this.db.query.pages.findFirst({
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
  }

  async listPages(query?: string) {
    if (query) {
      return await this.db.query.pages.findMany({
        where: like(schema.pages.name, `%${query}%`),
      });
    }
    return await this.db.query.pages.findMany();
  }

  async deletePage(id: string) {
    await this.db.delete(schema.pages).where(eq(schema.pages.id, id));
  }

  private validateSlug(slug: string): void {
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
      throw new Error(
        "Invalid slug format: must be lowercase, alphanumeric with hyphens, 2-64 chars",
      );
    }
  }
}
