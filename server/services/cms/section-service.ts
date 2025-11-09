import { DrizzleDB } from "../../db/client";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface CreateSectionDefInput {
  key: string;
  name: string;
  description?: string;
  status?: "published" | "unpublished";
  elementsStructure: any;
  templateKey: string;
  defaultVariant?: string;
  cssBundle?: string;
}

export interface UpdateSectionDefInput {
  key?: string;
  name?: string;
  description?: string;
  status?: "published" | "unpublished";
  templateKey?: string;
  defaultVariant?: string;
  cssBundle?: string;
}

export interface AddSectionToPageInput {
  pageId: string;
  sectionDefId: string;
  sortOrder?: number;
  status?: "published" | "unpublished";
}

export interface SyncPageContentsInput {
  pageSectionId: string;
  localeCode: string;
  content: Record<string, any>;
}

export class SectionService {
  constructor(private db: DrizzleDB) {}

  async createSectionDef(input: CreateSectionDefInput) {
    // Validate key format
    this.validateKey(input.key);

    // Check if key already exists
    const existing = await this.db.query.sectionDefinitions.findFirst({
      where: eq(schema.sectionDefinitions.key, input.key),
    });

    if (existing) {
      throw new Error(`Section definition with key '${input.key}' already exists`);
    }

    const sectionDef = {
      id: randomUUID(),
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "published",
      elementsStructure: JSON.stringify(input.elementsStructure),
      templateKey: input.templateKey,
      defaultVariant: input.defaultVariant ?? "default",
      cssBundle: input.cssBundle ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.sectionDefinitions).values(sectionDef);

    return sectionDef;
  }

  async updateSectionDef(id: string, input: UpdateSectionDefInput) {
    if (input.key) {
      this.validateKey(input.key);

      // Check key uniqueness (excluding current)
      const existing = await this.db.query.sectionDefinitions.findFirst({
        where: eq(schema.sectionDefinitions.key, input.key),
      });

      if (existing && existing.id !== id) {
        throw new Error(`Section definition with key '${input.key}' already exists`);
      }
    }

    const updated = {
      ...input,
      updatedAt: new Date(),
    };

    await this.db
      .update(schema.sectionDefinitions)
      .set(updated)
      .where(eq(schema.sectionDefinitions.id, id));

    return this.getSectionDefById(id);
  }

  async getSectionDefById(id: string) {
    return await this.db.query.sectionDefinitions.findFirst({
      where: eq(schema.sectionDefinitions.id, id),
    });
  }

  async getSectionDefByKey(key: string) {
    return await this.db.query.sectionDefinitions.findFirst({
      where: eq(schema.sectionDefinitions.key, key),
    });
  }

  async listSectionDefs() {
    return await this.db.query.sectionDefinitions.findMany();
  }

  async deleteSectionDef(id: string) {
    await this.db.delete(schema.sectionDefinitions).where(eq(schema.sectionDefinitions.id, id));
  }

  async addSectionToPage(input: AddSectionToPageInput) {
    // Verify page exists
    const page = await this.db.query.pages.findFirst({
      where: eq(schema.pages.id, input.pageId),
    });

    if (!page) {
      throw new Error(`Page with id '${input.pageId}' not found`);
    }

    // Verify section definition exists
    const sectionDef = await this.db.query.sectionDefinitions.findFirst({
      where: eq(schema.sectionDefinitions.id, input.sectionDefId),
    });

    if (!sectionDef) {
      throw new Error(`Section definition with id '${input.sectionDefId}' not found`);
    }

    // Determine sort order
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const existingSections = await this.db.query.pageSections.findMany({
        where: eq(schema.pageSections.pageId, input.pageId),
      });
      sortOrder = existingSections.length;
    }

    const pageSection = {
      id: randomUUID(),
      pageId: input.pageId,
      sectionDefId: input.sectionDefId,
      sortOrder,
      status: input.status ?? "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.pageSections).values(pageSection);

    return pageSection;
  }

  async syncPageContents(input: SyncPageContentsInput) {
    // Verify page section exists
    const pageSection = await this.db.query.pageSections.findFirst({
      where: eq(schema.pageSections.id, input.pageSectionId),
    });

    if (!pageSection) {
      throw new Error(`Page section with id '${input.pageSectionId}' not found`);
    }

    // Verify locale exists
    const locale = await this.db.query.locales.findFirst({
      where: eq(schema.locales.code, input.localeCode),
    });

    if (!locale) {
      throw new Error(`Locale with code '${input.localeCode}' not found`);
    }

    // Check if content already exists
    const existing = await this.db.query.pageSectionContents.findFirst({
      where: (psc, { and, eq }) =>
        and(eq(psc.pageSectionId, input.pageSectionId), eq(psc.localeCode, input.localeCode)),
    });

    if (existing) {
      // Update existing
      await this.db
        .update(schema.pageSectionContents)
        .set({
          content: JSON.stringify(input.content),
          updatedAt: new Date(),
        })
        .where(eq(schema.pageSectionContents.id, existing.id));

      return { ...existing, content: JSON.stringify(input.content), updatedAt: new Date() };
    } else {
      // Create new
      const newContent = {
        id: randomUUID(),
        pageSectionId: input.pageSectionId,
        localeCode: input.localeCode,
        content: JSON.stringify(input.content),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db.insert(schema.pageSectionContents).values(newContent);

      return newContent;
    }
  }

  private validateKey(key: string): void {
    if (!/^[a-z0-9-]{2,64}$/.test(key)) {
      throw new Error(
        "Invalid key format: must be lowercase, alphanumeric with hyphens, 2-64 chars",
      );
    }
  }
}
