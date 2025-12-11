import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../../db/client";
import * as schema from "../../db/schema";
import type { VectorIndexService } from "../vector-index";

export interface CreateSectionTemplateInput {
  key: string;
  name: string;
  description?: string;
  status?: "published" | "unpublished";
  fields: any; // RENAMED: elementsStructure → fields
  templateFile: string; // RENAMED: templateKey → templateFile
  defaultVariant?: string;
  cssBundle?: string;
}

export interface UpdateSectionTemplateInput {
  key?: string;
  name?: string;
  description?: string;
  status?: "published" | "unpublished";
  templateFile?: string; // RENAMED: templateKey → templateFile
  defaultVariant?: string;
  cssBundle?: string;
}

export interface AddSectionToPageInput {
  pageId: string;
  sectionTemplateId: string; // RENAMED: sectionDefId → sectionTemplateId
  sortOrder?: number;
  status?: "published" | "unpublished" | "draft";
  hidden?: boolean;
}

export interface SyncPageContentsInput {
  pageSectionId: string;
  localeCode: string;
  content: Record<string, any>;
}

export class SectionService {
  constructor(
    private db: DrizzleDB,
    private vectorIndex: VectorIndexService,
  ) {}

  /**
   * Normalize link fields in content to standard object structure
   * Converts string links to {href: "...", type: "url"} objects
   */
  private normalizeLinksInContent(content: Record<string, any>): Record<string, any> {
    const normalized = { ...content };

    for (const key in normalized) {
      const value = normalized[key];

      // Check if this field looks like a link field (ends with "Link" or "Href")
      if ((key.endsWith("Link") || key.endsWith("Href")) && value !== null && value !== undefined) {
        // If it's a string, convert to object
        if (typeof value === "string") {
          normalized[key] = {
            href: value,
            type: "url",
          };
        }
        // If it's already an object with href, ensure type is set
        else if (typeof value === "object" && value.href && !value.type) {
          normalized[key] = {
            ...value,
            type: "url",
          };
        }
      }
    }

    return normalized;
  }

  // ===========================================================================
  // Section Template Methods (RENAMED from SectionDef)
  // ===========================================================================

  async createSectionTemplate(input: CreateSectionTemplateInput) {
    // Validate key format
    this.validateKey(input.key);

    // Check if key already exists
    const existing = await this.db.query.sectionTemplates.findFirst({
      where: eq(schema.sectionTemplates.key, input.key),
    });

    if (existing) {
      throw new Error(`Section template with key '${input.key}' already exists`);
    }

    const sectionTemplate = {
      id: randomUUID(),
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "published",
      fields: JSON.stringify(input.fields),
      templateFile: input.templateFile,
      defaultVariant: input.defaultVariant ?? "default",
      cssBundle: input.cssBundle ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.sectionTemplates).values(sectionTemplate);

    // Index in vector DB
    await this.vectorIndex.add({
      id: sectionTemplate.id,
      type: "section_template",
      name: sectionTemplate.name,
      slug: sectionTemplate.key,
      searchableText: `${sectionTemplate.name} ${sectionTemplate.key} ${sectionTemplate.description || ""}`,
      metadata: { templateFile: sectionTemplate.templateFile },
    });

    return sectionTemplate;
  }

  async updateSectionTemplate(id: string, input: UpdateSectionTemplateInput) {
    const original = await this.getSectionTemplateById(id);
    if (!original) {
      throw new Error("Section template not found");
    }

    if (input.key) {
      this.validateKey(input.key);

      // Check key uniqueness (excluding current)
      const existing = await this.db.query.sectionTemplates.findFirst({
        where: eq(schema.sectionTemplates.key, input.key),
      });

      if (existing && existing.id !== id) {
        throw new Error(`Section template with key '${input.key}' already exists`);
      }
    }

    const updated = {
      ...input,
      updatedAt: new Date(),
    };

    await this.db
      .update(schema.sectionTemplates)
      .set(updated)
      .where(eq(schema.sectionTemplates.id, id));

    // Re-index if name/key changed
    if (input.name !== original.name || input.key !== original.key) {
      await this.vectorIndex.update(id, {
        type: "section_template",
        name: input.name || original.name,
        slug: input.key || original.key,
        searchableText: `${input.name || original.name} ${input.key || original.key} ${input.description || original.description || ""}`,
        metadata: { templateFile: input.templateFile || original.templateFile },
      });
    }

    return this.getSectionTemplateById(id);
  }

  async getSectionTemplateById(id: string) {
    // @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
    return await this.db.query.sectionTemplates.findFirst({
      where: eq(schema.sectionTemplates.id, id),
    });
  }

  async getSectionTemplateByKey(key: string) {
    // @ts-ignore - Drizzle ORM query.findFirst() has complex overloads that TypeScript cannot infer properly
    return await this.db.query.sectionTemplates.findFirst({
      where: eq(schema.sectionTemplates.key, key),
    });
  }

  async listSectionTemplates() {
    return await this.db.query.sectionTemplates.findMany({});
  }

  async deleteSectionTemplate(id: string) {
    await this.db.delete(schema.sectionTemplates).where(eq(schema.sectionTemplates.id, id));

    // Remove from vector index
    await this.vectorIndex.delete(id);
  }

  // ===========================================================================
  // Page Section Methods
  // ===========================================================================

  async addSectionToPage(input: AddSectionToPageInput) {
    // Verify page exists
    const page = await this.db.query.pages.findFirst({
      where: eq(schema.pages.id, input.pageId),
    });

    if (!page) {
      throw new Error(`Page with id '${input.pageId}' not found`);
    }

    // Verify section template exists
    const sectionTemplate = await this.db.query.sectionTemplates.findFirst({
      where: eq(schema.sectionTemplates.id, input.sectionTemplateId),
    });

    if (!sectionTemplate) {
      throw new Error(`Section template with id '${input.sectionTemplateId}' not found`);
    }

    // Determine sort order
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const existingSections = await this.db.query.pageSections.findMany({
        where: eq(schema.pageSections.pageId, input.pageId),
      });
      sortOrder = existingSections.length;
    }

    const pageSectionId = randomUUID();

    const pageSection = {
      id: pageSectionId,
      pageId: input.pageId,
      sectionTemplateId: input.sectionTemplateId,
      sortOrder,
      status: input.status ?? "published",
      hidden: input.hidden ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.pageSections).values(pageSection);

    // Create empty content for default locale so section renders
    const emptyContent = {};
    await this.db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId,
      localeCode: 'en',
      content: emptyContent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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

    // Normalize link fields in content (convert strings to objects)
    const normalizedContent = this.normalizeLinksInContent(input.content);

    // Check if content already exists
    const existing = await this.db.query.pageSectionContents.findFirst({
      where: (psc, { and, eq }) =>
        and(eq(psc.pageSectionId, input.pageSectionId), eq(psc.localeCode, input.localeCode)),
    });

    if (existing) {
      // Parse existing content to merge with new content
      let existingContent: Record<string, any> = {};
      try {
        existingContent = typeof existing.content === 'string'
          ? JSON.parse(existing.content)
          : (existing.content as Record<string, any>) || {};
      } catch {
        // If parsing fails, start fresh
        existingContent = {};
      }

      // MERGE: existing content + new content (new content wins on conflicts)
      const mergedContent = { ...existingContent, ...normalizedContent };

      // Update existing
      await this.db
        .update(schema.pageSectionContents)
        .set({
          content: JSON.stringify(mergedContent),
          updatedAt: new Date(),
        })
        .where(eq(schema.pageSectionContents.id, existing.id));

      return { ...existing, content: JSON.stringify(mergedContent), updatedAt: new Date() };
    } else {
      // Create new
      const newContent = {
        id: randomUUID(),
        pageSectionId: input.pageSectionId,
        localeCode: input.localeCode,
        content: JSON.stringify(normalizedContent),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db.insert(schema.pageSectionContents).values(newContent);

      return newContent;
    }
  }

  /**
   * Get all sections for a page (granular fetching)
   * @param pageId - Page ID
   * @param includeContent - Include full content (default: false for token efficiency)
   * @param localeCode - Locale for content (default: 'en')
   */
  async getPageSections(pageId: string, includeContent = false, localeCode = 'en') {
    // Verify page exists
    const page = await this.db.query.pages.findFirst({
      where: eq(schema.pages.id, pageId),
    });

    if (!page) {
      throw new Error(`Page with id '${pageId}' not found`);
    }

    // Fetch sections with optional content
    const sections = await this.db.query.pageSections.findMany({
      where: eq(schema.pageSections.pageId, pageId),
      with: includeContent ? {
        sectionTemplate: true,
        contents: true,
      } : {
        sectionTemplate: true,
      },
      orderBy: (ps, { asc }) => [asc(ps.sortOrder)],
    });

    // Format response
    return sections.map((section: any) => {
      const base = {
        id: section.id,
        sectionTemplateId: section.sectionTemplateId,
        sectionKey: section.sectionTemplate?.key,
        sectionName: section.sectionTemplate?.name,
        sortOrder: section.sortOrder,
        status: section.status,
        hidden: section.hidden,
      };

      if (includeContent && section.contents) {
        // Find content for requested locale
        const contentRecord = section.contents.find((c: any) => c.localeCode === localeCode);

        // Parse content if it's a JSON string
        let parsedContent = {};
        if (contentRecord?.content) {
          try {
            parsedContent = typeof contentRecord.content === 'string'
              ? JSON.parse(contentRecord.content)
              : contentRecord.content;
          } catch (error) {
            console.error(`Failed to parse content for section ${section.id}:`, error);
          }
        }

        return {
          ...base,
          content: parsedContent,
        };
      }

      return base;
    });
  }

  /**
   * Get content for a specific section (granular fetching)
   * @param pageSectionId - Page section ID
   * @param localeCode - Locale code (default: 'en')
   */
  async getSectionContent(pageSectionId: string, localeCode = 'en') {
    // Verify page section exists
    const pageSection = await this.db.query.pageSections.findFirst({
      where: eq(schema.pageSections.id, pageSectionId),
      with: {
        sectionTemplate: true,
      },
    });

    if (!pageSection) {
      throw new Error(`Page section with id '${pageSectionId}' not found`);
    }

    // Get content for locale
    const content = await this.db.query.pageSectionContents.findFirst({
      where: (psc, { and, eq }) =>
        and(eq(psc.pageSectionId, pageSectionId), eq(psc.localeCode, localeCode)),
    });

    if (!content) {
      return {
        pageSectionId,
        sectionKey: (pageSection as any).sectionTemplate?.key,
        sectionName: (pageSection as any).sectionTemplate?.name,
        localeCode,
        content: {},
        message: 'No content found for this locale',
      };
    }

    // Parse content if it's a JSON string
    let parsedContent = {};
    if (content.content) {
      try {
        parsedContent = typeof content.content === 'string'
          ? JSON.parse(content.content)
          : content.content;
      } catch (error) {
        console.error(`Failed to parse content for section ${pageSectionId}:`, error);
      }
    }

    return {
      pageSectionId,
      sectionKey: (pageSection as any).sectionTemplate?.key,
      sectionName: (pageSection as any).sectionTemplate?.name,
      localeCode,
      content: parsedContent,
    };
  }

  private validateKey(key: string): void {
    if (!/^[a-z0-9-]{2,64}$/.test(key)) {
      throw new Error(
        "Invalid key format: must be lowercase, alphanumeric with hyphens, 2-64 chars",
      );
    }
  }
}
