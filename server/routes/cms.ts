import express from "express";
import { z } from "zod";
import type { ServiceContainer } from "../services/service-container";
import { getSiteAndEnv } from "../utils/get-context";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";

const createPageSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  indexing: z.boolean().optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

const updatePageSchema = createPageSchema.partial();

const createSectionTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,64}$/),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  status: z.enum(["published", "unpublished"]).optional(),
  fields: z.any(), // RENAMED: elementsStructure → fields
  templateFile: z.string().min(1), // RENAMED: templateKey → templateFile
  defaultVariant: z.string().optional(),
  cssBundle: z.string().optional(),
});

const updateSectionTemplateSchema = createSectionTemplateSchema.partial();

const addSectionToPageSchema = z.object({
  sectionTemplateId: z.string().uuid(), // RENAMED: sectionDefId → sectionTemplateId
  sortOrder: z.number().int().min(0).optional(),
  status: z.enum(["published", "unpublished", "draft"]).optional(), // UPDATED: added draft
  hidden: z.boolean().optional(), // NEW
});

const syncPageContentsSchema = z.object({
  content: z.record(z.string(), z.any()),
});

const createCollectionTemplateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  status: z.enum(["published", "unpublished"]).optional(),
  fields: z.any(), // RENAMED: elementsStructure → fields
  hasSlug: z.boolean().optional(), // NEW
  orderDirection: z.enum(["asc", "desc"]).optional(), // NEW
});

const updateCollectionTemplateSchema = createCollectionTemplateSchema.partial();

const upsertEntrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  title: z.string().min(1).max(200),
  content: z.record(z.string(), z.any()),
});

export function createCMSRoutes(services: ServiceContainer) {
  const router = express.Router();

  // =========================================================================
  // RESOURCE SEARCH (Vector-based fuzzy search)
  // =========================================================================

  // POST /v1/teams/:team/sites/:site/environments/:env/search/resources
  router.post("/search/resources", async (req, res, next) => {
    try {
      const schema = z.object({
        query: z.string().min(1),
        type: z.enum(["page", "section_template", "collection", "entry"]).optional(),
        limit: z.number().int().min(1).max(10).optional().default(3),
      });

      const { query, type, limit } = schema.parse(req.body);

      const results = await services.vectorIndex.search(query, type, limit);

      res.json(ApiResponse.success(results));
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // PAGES
  // =========================================================================

  // GET /v1/teams/:team/sites/:site/environments/:env/pages
  router.get("/pages", async (req, res, next) => {
    try {
      const { q } = req.query;
      const pages = await services.pageService.listPages(q as string);
      res.json(ApiResponse.success(pages));
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/teams/:team/sites/:site/environments/:env/pages
  router.post("/pages", async (req, res, next) => {
    try {
      const input = createPageSchema.parse(req.body);

      // Get site and environment IDs (using defaults from env vars)
      const { siteId, environmentId } = await getSiteAndEnv(
        services.pageService.db,
        process.env.DEFAULT_SITE || "local-site",
        process.env.DEFAULT_ENV || "main",
      );

      const page = await services.pageService.createPage({
        ...input,
        siteId,
        environmentId,
      });
      res.status(HttpStatus.CREATED).json(ApiResponse.success(page));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/teams/:team/sites/:site/environments/:env/pages/:page
  router.get("/pages/:page", async (req, res, next) => {
    try {
      const page = await services.pageService.getPageById(req.params.page);
      if (!page) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error(ErrorCodes.NOT_FOUND, "Page not found")
        );
      }
      res.json(ApiResponse.success(page));
    } catch (error) {
      next(error);
    }
  });

  // PUT /v1/teams/:team/sites/:site/environments/:env/pages/:page
  router.put("/pages/:page", async (req, res, next) => {
    try {
      const input = updatePageSchema.parse(req.body);
      const page = await services.pageService.updatePage(req.params.page, input);
      if (!page) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error(ErrorCodes.NOT_FOUND, "Page not found")
        );
      }
      res.json(ApiResponse.success(page));
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/teams/:team/sites/:site/environments/:env/pages/:page
  router.delete("/pages/:page", async (req, res, next) => {
    try {
      await services.pageService.deletePage(req.params.page);
      res.json(ApiResponse.success({ success: true }));
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/teams/:team/sites/:site/environments/:env/pages/:page/section
  router.post("/pages/:page/section", async (req, res, next) => {
    try {
      const input = addSectionToPageSchema.parse(req.body);
      const pageSection = await services.sectionService.addSectionToPage({
        pageId: req.params.page,
        ...input,
      });
      res.status(HttpStatus.CREATED).json(ApiResponse.success(pageSection));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/teams/:team/sites/:site/environments/:env/pages/:page/contents
  router.get("/pages/:page/contents", async (req, res, next) => {
    try {
      const { locale = "en" } = req.query;
      const page = await services.pageService.getPageBySlug(req.params.page);
      if (!page) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error(ErrorCodes.NOT_FOUND, "Page not found")
        );
      }
      res.json(ApiResponse.success(page));
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/teams/:team/sites/:site/environments/:env/pages/:page/sections/:section/contents
  router.post("/pages/:page/sections/:section/contents", async (req, res, next) => {
    try {
      const { locale = "en" } = req.query;
      const input = syncPageContentsSchema.parse(req.body);
      const content = await services.sectionService.syncPageContents({
        pageSectionId: req.params.section,
        localeCode: locale as string,
        content: input.content,
      });
      res.status(HttpStatus.CREATED).json(ApiResponse.success(content));
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // SECTION DEFINITIONS
  // =========================================================================

  // GET /v1/teams/:team/sites/:site/environments/:env/sections
  router.get("/sections", async (_req, res, next) => {
    try {
      const sections = await services.sectionService.listSectionTemplates();
      res.json(ApiResponse.success(sections));
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/teams/:team/sites/:site/environments/:env/sections
  router.post("/sections", async (req, res, next) => {
    try {
      const input = createSectionTemplateSchema.parse(req.body);
      const section = await services.sectionService.createSectionTemplate(input);
      res.status(HttpStatus.CREATED).json(ApiResponse.success(section));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/teams/:team/sites/:site/environments/:env/sections/:section
  router.get("/sections/:section", async (req, res, next) => {
    try {
      const section = await services.sectionService.getSectionTemplateById(req.params.section);
      if (!section) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error(ErrorCodes.NOT_FOUND, "Section template not found")
        );
      }
      res.json(ApiResponse.success(section));
    } catch (error) {
      next(error);
    }
  });

  // PUT /v1/teams/:team/sites/:site/environments/:env/sections/:section
  router.put("/sections/:section", async (req, res, next) => {
    try {
      const input = updateSectionTemplateSchema.parse(req.body);
      const section = await services.sectionService.updateSectionTemplate(req.params.section, input);
      if (!section) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error(ErrorCodes.NOT_FOUND, "Section template not found")
        );
      }
      res.json(ApiResponse.success(section));
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/teams/:team/sites/:site/environments/:env/sections/:section
  router.delete("/sections/:section", async (req, res, next) => {
    try {
      await services.sectionService.deleteSectionTemplate(req.params.section);
      res.json(ApiResponse.success({ success: true }));
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // COLLECTION DEFINITIONS
  // =========================================================================

  // GET /v1/teams/:team/sites/:site/environments/:env/collections
  router.get("/collections", async (_req, res, next) => {
    try {
      const collections = await services.entryService.listCollectionTemplates();
      res.json(ApiResponse.success(collections));
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/teams/:team/sites/:site/environments/:env/collections
  router.post("/collections", async (req, res, next) => {
    try {
      const input = createCollectionTemplateSchema.parse(req.body);
      const collection = await services.entryService.createCollectionTemplate(input);
      res.status(HttpStatus.CREATED).json(ApiResponse.success(collection));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/teams/:team/sites/:site/environments/:env/collections/:collection
  router.get("/collections/:collection", async (req, res, next) => {
    try {
      const collection = await services.entryService.getCollectionTemplateById(req.params.collection);
      if (!collection) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error(ErrorCodes.NOT_FOUND, "Collection not found")
        );
      }
      res.json(ApiResponse.success(collection));
    } catch (error) {
      next(error);
    }
  });

  // PUT /v1/teams/:team/sites/:site/environments/:env/collections/:collection
  router.put("/collections/:collection", async (req, res, next) => {
    try {
      const input = updateCollectionTemplateSchema.parse(req.body);
      const collection = await services.entryService.updateCollectionTemplate(
        req.params.collection,
        input,
      );
      if (!collection) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error(ErrorCodes.NOT_FOUND, "Collection not found")
        );
      }
      res.json(ApiResponse.success(collection));
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/teams/:team/sites/:site/environments/:env/collections/:collection
  router.delete("/collections/:collection", async (req, res, next) => {
    try {
      await services.entryService.deleteCollectionTemplate(req.params.collection);
      res.json(ApiResponse.success({ success: true }));
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // COLLECTION ENTRIES
  // =========================================================================

  // GET /v1/teams/:team/sites/:site/environments/:env/collections/:collection/entries
  router.get("/collections/:collection/entries", async (req, res, next) => {
    try {
      const { locale } = req.query;
      const entries = await services.entryService.listEntries(
        req.params.collection,
        locale as string,
      );
      res.json(ApiResponse.success(entries));
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/teams/:team/sites/:site/environments/:env/collections/:collection/entries
  router.post("/collections/:collection/entries", async (req, res, next) => {
    try {
      const { locale = "en" } = req.query;
      const input = upsertEntrySchema.parse(req.body);
      const entry = await services.entryService.upsertEntry({
        collectionId: req.params.collection,
        localeCode: locale as string,
        ...input,
      });
      res.status(HttpStatus.CREATED).json(ApiResponse.success(entry));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/teams/:team/sites/:site/environments/:env/collections/:collection/entries/:entry
  router.get("/collections/:collection/entries/:entry", async (req, res, next) => {
    try {
      const { locale } = req.query;
      const entry = await services.entryService.getEntryById(req.params.entry, locale as string);
      if (!entry) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error(ErrorCodes.NOT_FOUND, "Entry not found")
        );
      }
      res.json(ApiResponse.success(entry));
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/teams/:team/sites/:site/environments/:env/collections/:collection/entries/:entry
  router.delete("/collections/:collection/entries/:entry", async (req, res, next) => {
    try {
      await services.entryService.deleteEntry(req.params.entry);
      res.json(ApiResponse.success({ success: true }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
