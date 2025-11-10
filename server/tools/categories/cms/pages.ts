// @ts-nocheck - Drizzle ORM query method type inference issues
import { z } from 'zod'
import { createCMSTool } from '../../registry'
import type { AgentContext } from '../../types'

// Get page by slug or ID
export const getPageTool = createCMSTool({
  id: 'cms.getPage',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'page'],
  description:
    'Get a page by slug or ID with all sections and localized content. Returns page structure with sorted sections.',
  inputSchema: z.object({
    slug: z.string().optional().describe('Page slug (e.g., "home")'),
    id: z.string().optional().describe('Page ID (UUID)'),
    locale: z.string().optional().default('en').describe('Locale code (default: en)')
  }),
  execute: async (input, context) => {
    const { services } = context

    // Validate input
    if (!input.slug && !input.id) {
      throw new Error('Either slug or id must be provided')
    }

    // Fetch page
    let page
    if (input.id) {
      page = await services.pageService.getPageById(input.id)
    } else if (input.slug) {
      page = await services.pageService.getPageBySlug(input.slug)
    }

    if (!page) {
      throw new Error(`Page not found: ${input.slug || input.id}`)
    }

    return {
      id: page.id,
      slug: page.slug,
      name: page.name,
      indexing: page.indexing,
      meta: page.meta,
      sections: page.pageSections?.map((ps: any) => ({
        id: ps.id,
        sectionDefId: ps.sectionDefId,
        sectionKey: ps.sectionDefinition?.key,
        sectionName: ps.sectionDefinition?.name,
        sortOrder: ps.sortOrder,
        status: ps.status,
        content: ps.contents?.find((c: any) => c.localeCode === input.locale)?.content
      })) || []
    }
  }
})

// List pages
export const listPagesTool = createCMSTool({
  id: 'cms.listPages',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'page', 'list'],
  description: 'List all pages with optional search query. Returns array of pages.',
  inputSchema: z.object({
    query: z.string().optional().describe('Optional search query for page name')
  }),
  execute: async (input, context) => {
    const { services } = context

    const pages = await services.pageService.listPages(input.query)

    return {
      count: pages.length,
      pages: pages.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        indexing: p.indexing,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    }
  }
})

// Create page
export const createPageTool = createCMSTool({
  id: 'cms.createPage',
  category: 'cms',
  riskLevel: 'moderate',
  requiresApproval: false,
  allowedModes: ['cms-crud'],
  tags: ['write', 'page', 'create'],
  description:
    'Create a new page. Slug must be unique, lowercase, alphanumeric with hyphens (2-64 chars). Automatically indexes in vector search.',
  inputSchema: z.object({
    name: z.string().min(1).max(100).describe('Page name (e.g., "About Us")'),
    slug: z
      .string()
      .regex(/^[a-z0-9-]{2,64}$/)
      .describe('Unique page slug (e.g., "about")'),
    indexing: z.boolean().optional().default(true).describe('Enable search indexing'),
    meta: z
      .record(z.any())
      .optional()
      .describe('Page metadata (e.g., { title, description })')
  }),
  execute: async (input, context) => {
    const { services, logger, traceId } = context

    logger.info({ traceId, tool: 'cms.createPage', input })

    // Create page (service handles vector indexing)
    const page = await services.pageService.createPage({
      ...input,
      siteId: process.env.DEFAULT_SITE || 'site-1',
      environmentId: process.env.DEFAULT_ENV || 'env-1'
    })

    // Validation: Verify page exists
    // @ts-ignore - Drizzle ORM type inference issue
    const exists = await services.pageService.getPageById(page.id)
    if (!exists) {
      throw new Error('Validation failed: Page not found in DB after creation')
    }

    logger.info({ traceId, tool: 'cms.createPage', result: 'success', pageId: page.id })

    return {
      id: page.id,
      slug: page.slug,
      name: page.name,
      indexing: page.indexing,
      message: `Page "${page.name}" created successfully`
    }
  }
})

// Update page
export const updatePageTool = createCMSTool({
  id: 'cms.updatePage',
  category: 'cms',
  riskLevel: 'moderate',
  requiresApproval: false, // Approval required if slug changes (handled in execute)
  allowedModes: ['cms-crud'],
  tags: ['write', 'page', 'update'],
  description:
    'Update an existing page. Changing slug affects URLs (consider requiring approval). Automatically re-indexes if name/slug changed.',
  inputSchema: z.object({
    id: z.string().describe('Page ID (UUID)'),
    name: z.string().min(1).max(100).optional().describe('New page name'),
    slug: z
      .string()
      .regex(/^[a-z0-9-]{2,64}$/)
      .optional()
      .describe('New page slug'),
    indexing: z.boolean().optional().describe('Enable/disable search indexing'),
    meta: z.record(z.any()).optional().describe('Updated metadata')
  }),
  execute: async (input, context) => {
    const { services, logger, traceId } = context

    logger.info({ traceId, tool: 'cms.updatePage', input })

    // Get original page
    // @ts-ignore - Drizzle ORM type inference issue
    const original = await services.pageService.getPageById(input.id)
    if (!original) {
      throw new Error(`Page not found: ${input.id}`)
    }

    // Check if slug is changing (high risk)
    if (input.slug && input.slug !== original.slug) {
      logger.warn({
        traceId,
        tool: 'cms.updatePage',
        warning: 'Slug change detected',
        oldSlug: original.slug,
        newSlug: input.slug
      })
      // In production, this would trigger HITL approval
      // For prototype, just log warning
    }

    // Update page (service handles vector re-indexing)
    const updated = await services.pageService.updatePage(input.id, {
      name: input.name,
      slug: input.slug,
      indexing: input.indexing,
      meta: input.meta
    })

    // Validation: Verify changes applied
    // @ts-ignore - Drizzle ORM type inference issue
    const validated = await services.pageService.getPageById(input.id)
    if (!validated || (input.name && validated.name !== input.name)) {
      throw new Error('Validation failed: Changes not applied')
    }

    logger.info({ traceId, tool: 'cms.updatePage', result: 'success', pageId: input.id })

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      message: `Page "${updated.name}" updated successfully`
    }
  }
})

// Add section to page
export const addSectionToPageTool = createCMSTool({
  id: 'cms.addSectionToPage',
  category: 'cms',
  riskLevel: 'moderate',
  requiresApproval: false,
  allowedModes: ['cms-crud'],
  tags: ['write', 'page', 'section'],
  description:
    'Add a section to a page. Section definition must exist. Sort order defaults to end of list.',
  inputSchema: z.object({
    pageId: z.string().describe('Page ID (UUID)'),
    sectionDefId: z.string().describe('Section definition ID (UUID)'),
    sortOrder: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Display order (default: append to end)')
  }),
  execute: async (input, context) => {
    const { services, logger, traceId } = context

    logger.info({ traceId, tool: 'cms.addSectionToPage', input })

    // Add section
    const pageSection = await services.sectionService.addSectionToPage({
      pageId: input.pageId,
      sectionDefId: input.sectionDefId,
      sortOrder: input.sortOrder
    })

    // Validation: Verify section attached
    // @ts-ignore - Drizzle ORM type inference issue
    const page = await services.pageService.getPageById(input.pageId)
    const sectionExists = page.pageSections?.some((ps: any) => ps.id === pageSection.id)

    if (!sectionExists) {
      throw new Error('Validation failed: Section not attached to page')
    }

    logger.info({ traceId, tool: 'cms.addSectionToPage', result: 'success', sectionId: pageSection.id })

    return {
      id: pageSection.id,
      pageId: input.pageId,
      sectionDefId: input.sectionDefId,
      sortOrder: pageSection.sortOrder,
      message: 'Section added to page successfully'
    }
  }
})

// Sync page contents
export const syncPageContentsTool = createCMSTool({
  id: 'cms.syncPageContents',
  category: 'cms',
  riskLevel: 'moderate',
  requiresApproval: false,
  allowedModes: ['cms-crud'],
  tags: ['write', 'page', 'content'],
  description:
    'Sync localized content for a page section. Content must match section definition schema. Creates or updates content.',
  inputSchema: z.object({
    pageSectionId: z.string().describe('Page section ID (UUID)'),
    locale: z.string().default('en').describe('Locale code (e.g., "en")'),
    content: z.record(z.any()).describe('Content object with keys matching section schema')
  }),
  execute: async (input, context) => {
    const { services, logger, traceId } = context

    logger.info({ traceId, tool: 'cms.syncPageContents', input })

    // Sync content
    const result = await services.sectionService.syncPageSectionContent({
      pageSectionId: input.pageSectionId,
      localeCode: input.locale,
      content: input.content
    })

    logger.info({
      traceId,
      tool: 'cms.syncPageContents',
      result: 'success',
      contentId: result.id
    })

    return {
      id: result.id,
      pageSectionId: input.pageSectionId,
      locale: input.locale,
      message: 'Page content synced successfully'
    }
  }
})
