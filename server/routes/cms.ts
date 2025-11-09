import express from "express";
import { z } from "zod";
import type { ServiceContainer } from "../services/service-container";
import { getSiteAndEnv } from "../utils/get-context";

const createPageSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  indexing: z.boolean().optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

const updatePageSchema = createPageSchema.partial();

const createSectionDefSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,64}$/),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  status: z.enum(["published", "unpublished"]).optional(),
  elementsStructure: z.any(),
  templateKey: z.string().min(1),
  defaultVariant: z.string().optional(),
  cssBundle: z.string().optional(),
});

const updateSectionDefSchema = createSectionDefSchema.partial();

const addSectionToPageSchema = z.object({
  sectionDefId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
  status: z.enum(["published", "unpublished"]).optional(),
});

const syncPageContentsSchema = z.object({
  content: z.record(z.string(), z.any()),
});

const createCollectionDefSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  status: z.enum(["published", "unpublished"]).optional(),
  elementsStructure: z.any(),
});

const updateCollectionDefSchema = createCollectionDefSchema.partial();

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
        type: z.enum(["page", "section_def", "collection", "entry"]).optional(),
        limit: z.number().int().min(1).max(10).optional().default(3),
      });

      const { query, type, limit } = schema.parse(req.body);

      const results = await services.vectorIndex.search(query, type, limit);

      res.json({ data: results, statusCode: 200 });
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
      res.json({ data: pages, statusCode: 200 });
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
      res.status(201).json({ data: page, statusCode: 201 });
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/teams/:team/sites/:site/environments/:env/pages/:page
  router.get("/pages/:page", async (req, res, next) => {
    try {
      const page = await services.pageService.getPageById(req.params.page);
      if (!page) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Page not found" },
          statusCode: 404,
        });
      }
      res.json({ data: page, statusCode: 200 });
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
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Page not found" },
          statusCode: 404,
        });
      }
      res.json({ data: page, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/teams/:team/sites/:site/environments/:env/pages/:page
  router.delete("/pages/:page", async (req, res, next) => {
    try {
      await services.pageService.deletePage(req.params.page);
      res.json({ data: { success: true }, statusCode: 200 });
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
      res.status(201).json({ data: pageSection, statusCode: 201 });
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
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Page not found" },
          statusCode: 404,
        });
      }
      res.json({ data: page, statusCode: 200 });
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
      res.status(201).json({ data: content, statusCode: 201 });
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // SECTION DEFINITIONS
  // =========================================================================

  // GET /v1/teams/:team/sites/:site/environments/:env/sections
  router.get("/sections", async (req, res, next) => {
    try {
      const sections = await services.sectionService.listSectionDefs();
      res.json({ data: sections, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/teams/:team/sites/:site/environments/:env/sections
  router.post("/sections", async (req, res, next) => {
    try {
      const input = createSectionDefSchema.parse(req.body);
      const section = await services.sectionService.createSectionDef(input);
      res.status(201).json({ data: section, statusCode: 201 });
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/teams/:team/sites/:site/environments/:env/sections/:section
  router.get("/sections/:section", async (req, res, next) => {
    try {
      const section = await services.sectionService.getSectionDefById(req.params.section);
      if (!section) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Section definition not found" },
          statusCode: 404,
        });
      }
      res.json({ data: section, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // PUT /v1/teams/:team/sites/:site/environments/:env/sections/:section
  router.put("/sections/:section", async (req, res, next) => {
    try {
      const input = updateSectionDefSchema.parse(req.body);
      const section = await services.sectionService.updateSectionDef(req.params.section, input);
      if (!section) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Section definition not found" },
          statusCode: 404,
        });
      }
      res.json({ data: section, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/teams/:team/sites/:site/environments/:env/sections/:section
  router.delete("/sections/:section", async (req, res, next) => {
    try {
      await services.sectionService.deleteSectionDef(req.params.section);
      res.json({ data: { success: true }, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // COLLECTION DEFINITIONS
  // =========================================================================

  // GET /v1/teams/:team/sites/:site/environments/:env/collections
  router.get("/collections", async (req, res, next) => {
    try {
      const collections = await services.entryService.listCollectionDefs();
      res.json({ data: collections, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/teams/:team/sites/:site/environments/:env/collections
  router.post("/collections", async (req, res, next) => {
    try {
      const input = createCollectionDefSchema.parse(req.body);
      const collection = await services.entryService.createCollectionDef(input);
      res.status(201).json({ data: collection, statusCode: 201 });
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/teams/:team/sites/:site/environments/:env/collections/:collection
  router.get("/collections/:collection", async (req, res, next) => {
    try {
      const collection = await services.entryService.getCollectionDefById(req.params.collection);
      if (!collection) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Collection not found" },
          statusCode: 404,
        });
      }
      res.json({ data: collection, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // PUT /v1/teams/:team/sites/:site/environments/:env/collections/:collection
  router.put("/collections/:collection", async (req, res, next) => {
    try {
      const input = updateCollectionDefSchema.parse(req.body);
      const collection = await services.entryService.updateCollectionDef(
        req.params.collection,
        input,
      );
      if (!collection) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Collection not found" },
          statusCode: 404,
        });
      }
      res.json({ data: collection, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/teams/:team/sites/:site/environments/:env/collections/:collection
  router.delete("/collections/:collection", async (req, res, next) => {
    try {
      await services.entryService.deleteCollectionDef(req.params.collection);
      res.json({ data: { success: true }, statusCode: 200 });
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
      res.json({ data: entries, statusCode: 200 });
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
      res.status(201).json({ data: entry, statusCode: 201 });
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
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Entry not found" },
          statusCode: 404,
        });
      }
      res.json({ data: entry, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/teams/:team/sites/:site/environments/:env/collections/:collection/entries/:entry
  router.delete("/collections/:collection/entries/:entry", async (req, res, next) => {
    try {
      await services.entryService.deleteEntry(req.params.entry);
      res.json({ data: { success: true }, statusCode: 200 });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
