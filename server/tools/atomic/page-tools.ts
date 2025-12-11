/**
 * Atomic Page Tools - Unified CRUD operations
 * Phase 1: Merged cms_getPage + cms_listPages → getPage
 *
 * Following ATOMIC_CRUD_TOOL_ARCHITECTURE.md patterns:
 * - Scope selection via mutually exclusive params (id/slug/all)
 * - Unified response format with items array
 * - Parameter-based modifiers (includeContent, parentId)
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { AgentContext } from '../types'

// ============================================================================
// getPage - Unified read tool for pages
// ============================================================================

export const getPage = tool({
  description: 'Get page(s). By id, slug, or all. Default lightweight; includeContent for full sections.',
  inputSchema: z.object({
    // Scope selection (one of these)
    id: z.string().uuid().optional().describe('Get by UUID'),
    slug: z.string().optional().describe('Get by slug'),
    all: z.boolean().optional().describe('Get all pages'),

    // Modifiers (from production alignment)
    parentId: z.string().uuid().optional().describe('Filter by parent page (for hierarchy)'),
    includeChildren: z.boolean().optional().describe('Include child pages in response'),
    includeContent: z.boolean().optional().default(false).describe('Include full section content (expensive)'),
    localeCode: z.string().optional().default('en').describe('Locale code for content'),
  }).refine(
    data => data.id || data.slug || data.all || data.parentId,
    { message: 'Provide id, slug, parentId, or set all: true' }
  ),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Case 1: Get single by ID
    if (input.id) {
      const page = await ctx.services.pageService.getPageById(input.id)
      if (!page) {
        return { success: false, count: 0, items: [], error: `Page not found: ${input.id}` }
      }

      if (input.includeContent) {
        const fullPage = await ctx.services.pageService.getPageBySlug(
          page.slug,
          true,
          input.localeCode || 'en'
        )
        return {
          success: true,
          count: 1,
          items: [formatPageFull(fullPage)]
        }
      }

      return {
        success: true,
        count: 1,
        items: [formatPageLight(page)]
      }
    }

    // Case 2: Get single by slug
    if (input.slug) {
      const page = await ctx.services.pageService.getPageBySlug(
        input.slug,
        input.includeContent || false,
        input.localeCode || 'en'
      )

      if (!page) {
        return { success: false, count: 0, items: [], error: `Page not found: ${input.slug}` }
      }

      if (input.includeContent) {
        return {
          success: true,
          count: 1,
          items: [formatPageFull(page)]
        }
      }

      return {
        success: true,
        count: 1,
        items: [formatPageLight(page)]
      }
    }

    // Case 3: Get all pages (with optional parentId filter)
    if (input.all || input.parentId !== undefined) {
      const allPages = await ctx.services.pageService.listPages()

      // Filter by parentId if provided
      let filteredPages = allPages
      if (input.parentId !== undefined) {
        // parentId: 'null' or undefined means root pages, otherwise filter by parent
        filteredPages = allPages.filter((p: any) => p.parentId === input.parentId)
      }

      return {
        success: true,
        count: filteredPages.length,
        items: filteredPages.map((p: any) => formatPageLight(p))
      }
    }

    return { success: false, count: 0, items: [], error: 'Provide id, slug, parentId, or set all: true' }
  }
})

// ============================================================================
// createPage - Create new page
// ============================================================================

export const createPage = tool({
  description: 'Create empty page. Add sections with createSection.',
  inputSchema: z.object({
    name: z.string().describe('Page name (e.g., "About Us")'),
    slug: z.string().describe('URL-friendly slug (e.g., "about-us")'),
    parentId: z.string().uuid().optional().describe('Parent page ID for hierarchy'),
    isProtected: z.boolean().optional().describe('Mark as protected/default page'),
    meta: z.object({
      title: z.string().optional(),
      description: z.string().optional()
    }).optional().describe('Page metadata'),
    indexing: z.boolean().optional().default(true).describe('Enable search indexing'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const { siteId, environmentId } = ctx.cmsTarget || { siteId: 'default-site', environmentId: 'main' }

    const page = await ctx.services.pageService.createPage({
      name: input.name,
      slug: input.slug,
      siteId,
      environmentId,
      indexing: input.indexing ?? true,
      meta: input.meta,
      // parentId and isProtected will be added when DB schema supports them
    })

    return {
      success: true,
      count: 1,
      items: [formatPageLight(page)]
    }
  }
})

// ============================================================================
// updatePage - Update page metadata
// ============================================================================

export const updatePage = tool({
  description: 'Update page metadata. Use updateSection for content.',
  inputSchema: z.object({
    id: z.string().uuid().describe('Page ID to update'),
    name: z.string().optional().describe('New name'),
    slug: z.string().optional().describe('New slug'),
    parentId: z.string().uuid().optional().nullable().describe('New parent ID (null for root)'),
    isProtected: z.boolean().optional().describe('Change protection status'),
    meta: z.object({
      title: z.string().optional(),
      description: z.string().optional()
    }).optional().describe('New metadata'),
    indexing: z.boolean().optional().describe('Enable/disable search indexing'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const { id, ...updates } = input

    const page = await ctx.services.pageService.updatePage(id, updates)

    return {
      success: true,
      count: 1,
      items: [formatPageLight(page)]
    }
  }
})

// ============================================================================
// deletePage - Delete page(s) permanently
// ============================================================================

export const deletePage = tool({
  description: 'Delete page(s) and all sections. Array param. Requires confirmed.',
  inputSchema: z.object({
    ids: z.array(z.string().uuid()).describe('Page IDs to delete (always array, even for single)'),
    removeFromNavigation: z.boolean().optional().describe('Also remove from navigation if present'),
    confirmed: z.boolean().optional().describe('Must be true to actually delete'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get all pages to show what will be deleted
    const pagesToDelete: any[] = []
    for (const id of input.ids) {
      const page = await ctx.services.pageService.getPageById(id)
      if (page) {
        pagesToDelete.push(page)
      }
    }

    if (pagesToDelete.length === 0) {
      return { success: false, error: 'No pages found with provided IDs' }
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete ${pagesToDelete.length} page(s)? This will permanently remove the page(s) and all sections. Set confirmed: true to proceed.`,
        items: pagesToDelete.map(p => ({ id: p.id, name: p.name, slug: p.slug }))
      }
    }

    // Delete each page
    const deleted: any[] = []
    for (const page of pagesToDelete) {
      await ctx.services.pageService.deletePage(page.id)
      deleted.push({ id: page.id, name: page.name, slug: page.slug })
    }

    return {
      success: true,
      message: `Deleted ${deleted.length} page(s)`,
      deleted
    }
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

function formatPageLight(page: any) {
  return {
    id: page.id,
    name: page.name,
    slug: page.slug,
    indexing: page.indexing,
    meta: page.meta,
    parentId: page.parentId || null,
    sectionCount: page.sectionCount || 0,
  }
}

function formatPageFull(page: any) {
  return {
    id: page.id,
    name: page.name,
    slug: page.slug,
    indexing: page.indexing,
    meta: page.meta,
    parentId: page.parentId || null,
    sections: page.pageSections?.map((ps: any) => ({
      id: ps.id,
      sectionTemplateId: ps.sectionTemplateId,
      sectionKey: ps.sectionTemplate?.key,
      sectionName: ps.sectionTemplate?.name,
      sortOrder: ps.sortOrder,
      content: ps.content || {}
    })) || []
  }
}
