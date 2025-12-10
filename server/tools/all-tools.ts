/**
 * All Tools - Native AI SDK v6 Pattern
 *
 * Tools created ONCE with execute functions that receive experimental_context.
 * No factories, no wrappers, no recreation - pure AI SDK v6 pattern.
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { AgentContext } from './types'

// Core tool imports (must be at top to avoid circular init issues)
import { toolSearchTool } from './discovery/tool-search'
import { finalAnswerTool } from './core/final-answer'
import {
  findImageTool,
  searchImagesTool,
  addImageToSectionTool,
  replaceImageTool,
  deleteImageTool,
  listAllImagesTool,
  updateSectionImageTool
} from './image-tools'
import {
  getNavigationTool,
  addNavigationItemTool,
  updateNavigationItemTool,
  removeNavigationItemTool,
  toggleNavigationItemTool
} from './site-settings-tools'
import {
  cmsCreatePost,
  cmsUpdatePost,
  cmsPublishPost,
  cmsArchivePost,
  cmsDeletePost,
  cmsListPosts,
  cmsGetPost
} from './post-tools'
import {
  webQuickSearchTool,
  webDeepResearchTool,
  webFetchContentTool
} from './web-research-tools'
import {
  pexelsSearchPhotosTool,
  pexelsDownloadPhotoTool
} from './pexels-tools'
import {
  unsplashSearchPhotosTool,
  unsplashDownloadPhotoTool
} from './unsplash-tools'
import {
  generateHeroContent,
  generateMetadata,
  generateSlug
} from '../utils/page-content-generator'
import { classifyPageForNavigation } from '../utils/navigation-classifier'
import { SiteSettingsService } from '../services/cms/site-settings-service'

// ============================================================================
// CMS - Page Tools
// ============================================================================

export const cmsGetPage = tool({
  description: 'Get page by slug or ID. Default: lightweight (no content). Use includeContent:true for full content.',
  inputSchema: z.object({
    slug: z.string().optional().describe('Page slug (e.g., "home")'),
    id: z.string().optional().describe('Page ID (UUID)'),
    includeContent: z.boolean().optional().default(false).describe('Include full section content (default: false for token efficiency). Use cms_getPageSections and cms_getSectionContent for granular fetching.'),
    localeCode: z.string().optional().default('en').describe('Locale code for content (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    if (!input.slug && !input.id) {
      throw new Error('Either slug or id must be provided')
    }

    let page
    if (input.id) {
      page = await ctx.services.pageService.getPageById(input.id)
    } else if (input.slug) {
      page = await ctx.services.pageService.getPageBySlug(
        input.slug, 
        input.includeContent || false,
        input.localeCode || 'en'
      )
    }

    if (!page) {
      throw new Error(`Page not found: ${input.slug || input.id}`)
    }

    if (!input.includeContent) {
      // Lightweight response (default)
      return {
        id: page.id,
        slug: page.slug,
        name: page.name,
        indexing: page.indexing,
        meta: page.meta,
        sectionIds: (page as any).sectionIds || [],
        sectionCount: (page as any).sectionCount || 0,
        message: 'Use cms_getPageSections or cms_getSectionContent to fetch section data'
      }
    }

    // Full content response (opt-in)
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
        content: ps.content || {}
      })) || []
    }
  }
})

export const cmsCreatePage = tool({
  description: 'Create a new page with optional sections',
  inputSchema: z.object({
    name: z.string().describe('Page name (e.g., "About Us")'),
    slug: z.string().describe('URL-friendly slug (e.g., "about-us")'),
    indexing: z.boolean().optional().default(true).describe('Enable search indexing'),
    meta: z.object({
      title: z.string().optional(),
      description: z.string().optional()
    }).optional()
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    // Get siteId and environmentId from context
    const { siteId, environmentId } = ctx.cmsTarget || { siteId: 'default-site', environmentId: 'main' }
    
    const page = await ctx.services.pageService.createPage({
      name: input.name,
      slug: input.slug,
      siteId,
      environmentId,
      indexing: input.indexing ?? true,
      meta: input.meta
    })

    return { success: true, page }
  }
})

export const cmsUpdatePage = tool({
  description: 'Update an existing page (name, slug, meta, or indexing)',
  inputSchema: z.object({
    id: z.string().describe('Page ID'),
    name: z.string().optional(),
    slug: z.string().optional(),
    locale: z.string().optional(),
    indexing: z.boolean().optional(),
    meta: z.object({
      title: z.string().optional(),
      description: z.string().optional()
    }).optional()
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const { id, ...updates } = input
    
    const page = await ctx.services.pageService.updatePage(id, updates)
    return { success: true, page }
  }
})

export const cmsDeletePage = tool({
  description: 'Delete page permanently. CASCADE deletes all sections. Requires confirmed:true.',
  inputSchema: z.object({
    slug: z.string().optional().describe('Page slug to delete'),
    id: z.string().optional().describe('Page ID to delete'),
    removeFromNavigation: z.boolean().optional().describe('Also remove from navigation if present'),
    confirmed: z.boolean().optional().describe('Must be true to actually delete')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    if (!input.slug && !input.id) {
      throw new Error('Either slug or id must be provided')
    }

    // Get page first to show what will be deleted
    let page: any
    if (input.id) {
      page = await ctx.services.pageService.getPageById(input.id)
    } else {
      page = await ctx.services.pageService.getPageBySlug(input.slug!)
    }

    if (!page) {
      throw new Error(`Page not found: ${input.slug || input.id}`)
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete page "${page.name}"? This will permanently remove the page and all its sections. Set confirmed: true to proceed.`,
        page: { id: page.id, slug: page.slug, name: page.name }
      }
    }

    // Check if page is in navigation and remove if requested
    const siteSettingsService = new SiteSettingsService(ctx.db)
    const navItems = await siteSettingsService.getNavigationItems()

    const pageHref = `/pages/${page.slug}?locale=en`
    const inNavigation = navItems.filter((item: any) =>
      item.href.includes(page.slug) || item.href === pageHref
    )

    // Remove from navigation if requested
    let removedFromNav = false
    if (input.removeFromNavigation && inNavigation.length > 0) {
      for (const navItem of inNavigation) {
        try {
          await siteSettingsService.removeNavigationItem(navItem.label)
          removedFromNav = true
        } catch (e) {
          // Ignore if already removed
        }
      }
    }

    // Delete the page (cascade deletes sections)
    await ctx.services.pageService.deletePage(page.id)

    return {
      success: true,
      message: `Page "${page.name}" deleted`,
      removedFromNavigation: removedFromNav,
      pageInNavigation: inNavigation.length > 0
    }
  }
})

export const cmsListPages = tool({
  description: 'List all pages in the current site/environment',
  inputSchema: z.object({}),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    const pages = await ctx.services.pageService.listPages()
    return {
      count: pages.length,
      pages: pages.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug
      }))
    }
  }
})

export const cmsCreatePageWithContent = tool({
  description: 'Create page with sections. Images added separately via cms_updateSectionImage.',
  inputSchema: z.object({
    name: z.string().describe('Page name (e.g., "About Us", "Services", "Contact")'),
    slug: z.string().optional().describe('URL-friendly slug (auto-generated from name if not provided)'),
    sections: z.array(z.object({
      sectionKey: z.string().describe('Section definition key (e.g., "hero", "image-text", "feature")'),
      content: z.record(z.string(), z.any()).optional().describe('Section content - if omitted, AI generates contextual text content (no images)')
    })).optional().describe('Sections to add - defaults to hero section if not provided'),
    indexing: z.boolean().optional().default(true).describe('Enable search indexing'),
    meta: z.object({
      title: z.string().optional(),
      description: z.string().optional()
    }).optional().describe('Page metadata - auto-generated if not provided')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const { siteId, environmentId } = ctx.cmsTarget || { siteId: 'default-site', environmentId: 'main' }

    // 1. Generate slug if not provided
    const slug = input.slug || generateSlug(input.name)

    // 2. Generate metadata if not provided
    const meta = input.meta || generateMetadata(input.name)

    // 3. Create the page
    const page = await ctx.services.pageService.createPage({
      name: input.name,
      slug,
      siteId,
      environmentId,
      indexing: input.indexing ?? true,
      meta
    })

    // 4. Determine sections to add (default: hero only)
    const sectionsToAdd = input.sections || [{ sectionKey: 'hero' }]
    const createdSections: Array<{ id: string; sectionKey: string; sortOrder: number }> = []

    // 5. Add each section with content (NO automatic image selection - agent should do this)
    for (let i = 0; i < sectionsToAdd.length; i++) {
      const sectionSpec = sectionsToAdd[i]

      // Get section definition by key
      const sectionDef = await ctx.services.sectionService.getSectionDefByKey(sectionSpec.sectionKey)
      if (!sectionDef) {
        throw new Error(`Section definition "${sectionSpec.sectionKey}" not found. Use cms_listSectionTemplates to see available sections.`)
      }

      // Add section to page
      const pageSection = await ctx.services.sectionService.addSectionToPage({
        pageId: page.id,
        sectionDefId: sectionDef.id,
        sortOrder: i,
        status: 'published'
      })

      // Generate or use provided content (text only, no images)
      let content = sectionSpec.content
      if (!content) {
        // AI-generate TEXT content based on section type
        if (sectionSpec.sectionKey === 'hero') {
          // Generate hero content WITHOUT image - agent will add image separately
          content = generateHeroContent(input.name, slug, null)
        }
        // Other section types will use template defaults (empty content)
      }

      // Sync content if we have any
      if (content && Object.keys(content).length > 0) {
        await ctx.services.sectionService.syncPageContents({
          pageSectionId: pageSection.id,
          localeCode: 'en',
          content
        })
      }

      createdSections.push({
        id: pageSection.id,
        sectionKey: sectionSpec.sectionKey,
        sortOrder: i
      })
    }

    // 6. Generate navigation suggestion
    const navigationSuggestion = classifyPageForNavigation(input.name, slug)

    return {
      success: true,
      page: {
        id: page.id,
        name: input.name,
        slug,
        sections: createdSections
      },
      navigationSuggestion,
      previewUrl: `/pages/${slug}?locale=en`,
      nextSteps: 'Page created with placeholder images. Use cms_searchImages to find relevant images based on page content, then cms_updateSectionImage to attach them to the hero and other sections.'
    }
  }
})

// ============================================================================
// CMS - Section Tools
// ============================================================================

export const cmsListSectionTemplates = tool({
  description: 'List all available section templates (hero, feature, cta, etc.)',
  inputSchema: z.object({}),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    const sectionDefs = await ctx.services.sectionService.listSectionDefs()
    return {
      count: sectionDefs.length,
      sectionDefs: sectionDefs.map((sd: any) => ({
        id: sd.id,
        key: sd.key,
        name: sd.name,
        description: sd.description,
        templateKey: sd.templateKey
      }))
    }
  }
})

export const cmsGetSectionFields = tool({
  description: 'Get section template fields/schema. Shows required fields before updating content.',
  inputSchema: z.object({
    id: z.string().optional().describe('Section definition ID'),
    key: z.string().optional().describe('Section definition key')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    if (!input.id && !input.key) {
      throw new Error('Either id or key must be provided')
    }
    
    let sectionDef
    if (input.id) {
      sectionDef = await ctx.services.sectionService.getSectionDefById(input.id)
    } else if (input.key) {
      sectionDef = await ctx.services.sectionService.getSectionDefByKey(input.key)
    }
    
    if (!sectionDef) {
      throw new Error(`Section definition not found: ${input.id || input.key}`)
    }
    
    return sectionDef
  }
})

export const cmsAddSectionToPage = tool({
  description: 'Add section to a page. Returns pageSectionId for content updates.',
  inputSchema: z.object({
    pageId: z.string().describe('Page ID to add section to'),
    sectionDefId: z.string().describe('Section definition ID'),
    sortOrder: z.number().optional().describe('Sort order (optional)'),
    status: z.enum(['published', 'unpublished']).optional().default('published')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    const pageSection = await ctx.services.sectionService.addSectionToPage({
      pageId: input.pageId,
      sectionDefId: input.sectionDefId,
      sortOrder: input.sortOrder,
      status: input.status || 'published'
    })
    
    return { 
      success: true, 
      pageSectionId: pageSection.id,
      sectionDefId: input.sectionDefId,
      message: 'Section added. Use cms_getSectionFields to see required fields, then cms_updateSectionContent to add content.'
    }
  }
})

export const cmsUpdateSectionContent = tool({
  description: 'Update section content. MERGES with existing - only send fields to change.',
  inputSchema: z.object({
    pageSectionId: z.string().describe('Page section ID'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
    content: z.record(z.string(), z.any()).describe('REQUIRED: Content data matching section schema. Only fields you provide are updated; existing fields preserved.')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    const result = await ctx.services.sectionService.syncPageContents({
      pageSectionId: input.pageSectionId,
      localeCode: input.localeCode || 'en',
      content: input.content
    })
    
    return { success: true, result }
  }
})

export const cmsDeletePageSection = tool({
  description: 'Delete section from page. Requires confirmed:true.',
  inputSchema: z.object({
    pageSectionId: z.string().describe('Page section ID (from cms_getPage sections array)'),
    confirmed: z.boolean().optional().describe('Must be true to actually delete')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete section "${input.pageSectionId}"? This cannot be undone. Set confirmed: true to proceed.`
      }
    }

    // Import schema at runtime
    const { pageSections } = await import('../db/schema')
    const { eq } = await import('drizzle-orm')

    // Delete page section (CASCADE deletes content)
    await ctx.db.delete(pageSections).where(eq(pageSections.id, input.pageSectionId))

    return {
      success: true,
      message: `Section deleted from page`
    }
  }
})

export const cmsDeletePageSections = tool({
  description: 'Delete multiple sections in batch. Requires confirmed:true.',
  inputSchema: z.object({
    pageSectionIds: z.array(z.string()).describe('Array of page section IDs to delete'),
    pageId: z.string().optional().describe('Optional: page ID for validation'),
    confirmed: z.boolean().optional().describe('Must be true to actually delete')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete ${input.pageSectionIds.length} sections? This cannot be undone. Set confirmed: true to proceed.`,
        sectionCount: input.pageSectionIds.length
      }
    }

    const { pageSections } = await import('../db/schema')
    const { eq, inArray } = await import('drizzle-orm')

    // Validate all sections exist
    const sections = await ctx.db.query.pageSections.findMany({
      where: inArray(pageSections.id, input.pageSectionIds)
    })

    if (sections.length !== input.pageSectionIds.length) {
      throw new Error(`Some sections not found. Found ${sections.length} of ${input.pageSectionIds.length}`)
    }

    // Validate all belong to same page if pageId provided
    if (input.pageId) {
      const wrongPage = sections.find((s: any) => s.pageId !== input.pageId)
      if (wrongPage) {
        throw new Error('All sections must belong to the specified page')
      }
    }

    // Delete all sections
    for (const sectionId of input.pageSectionIds) {
      await ctx.db.delete(pageSections).where(eq(pageSections.id, sectionId))
    }

    return {
      success: true,
      deletedCount: input.pageSectionIds.length,
      message: `Deleted ${input.pageSectionIds.length} sections`
    }
  }
})

export const cmsGetPageSections = tool({
  description: 'Get all sections for a page. Default: lightweight. Use includeContent:true for full content.',
  inputSchema: z.object({
    pageId: z.string().describe('Page ID'),
    includeContent: z.boolean().optional().default(false).describe('Include full section content (default: false for token efficiency)'),
    localeCode: z.string().optional().default('en').describe('Locale code for content (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    const sections = await ctx.services.sectionService.getPageSections(
      input.pageId,
      input.includeContent || false,
      input.localeCode || 'en'
    )
    
    return {
      pageId: input.pageId,
      count: sections.length,
      sections
    }
  }
})

export const cmsGetSectionContent = tool({
  description: 'Get content for one section. More efficient than fetching entire page.',
  inputSchema: z.object({
    pageSectionId: z.string().describe('Page section ID (from cms_getPage sectionIds or cms_getPageSections)'),
    localeCode: z.string().optional().default('en').describe('Locale code (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    const result = await ctx.services.sectionService.getSectionContent(
      input.pageSectionId,
      input.localeCode || 'en'
    )
    
    return result
  }
})

// ============================================================================
// Collection & Entry Tools (Granular Fetching)
// ============================================================================

export const cmsGetCollectionEntries = tool({
  description: 'Get entries in a collection. Default: lightweight. Use includeContent:true for full content.',
  inputSchema: z.object({
    collectionId: z.string().describe('Collection ID'),
    includeContent: z.boolean().optional().default(false).describe('Include full entry content (default: false for token efficiency)'),
    localeCode: z.string().optional().default('en').describe('Locale code for content (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    const entries = await ctx.services.entryService.getCollectionEntries(
      input.collectionId,
      input.includeContent || false,
      input.localeCode || 'en'
    )
    
    return {
      collectionId: input.collectionId,
      count: entries.length,
      entries
    }
  }
})

export const cmsGetEntryContent = tool({
  description: 'Get content for one entry. More efficient than fetching entire collection.',
  inputSchema: z.object({
    entryId: z.string().describe('Entry ID (from cms_getCollectionEntries)'),
    localeCode: z.string().optional().default('en').describe('Locale code (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    const result = await ctx.services.entryService.getEntryContent(
      input.entryId,
      input.localeCode || 'en'
    )
    
    return result
  }
})

// ============================================================================
// Search Tools
// ============================================================================

export const searchVector = tool({
  description: 'Search for content using vector similarity (semantic search)',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    type: z.enum(['page', 'section_def', 'collection', 'entry']).optional().describe('Filter by resource type'),
    limit: z.number().optional().describe('Max results to return (default: 3)')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    const results = await ctx.vectorIndex.search(
      input.query,
      input.type,
      input.limit || 3
    )
    
    return {
      count: results.length,
      results: results.map((r: any) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        slug: r.slug,
        similarity: r.similarity
      }))
    }
  }
})

export const cmsFindResource = tool({
  description: 'Find CMS resource by name/query using semantic search. Works for pages, sections, collections.',
  inputSchema: z.object({
    query: z.string().describe('Search query - name, slug, or description (e.g., "about" to find "About Us", "hero" to find Hero Section)'),
    resourceType: z.enum(['page', 'section', 'collection']).optional().describe('Type of resource to search for (defaults to page)')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const resourceType = input.resourceType || 'page'

    // For pages, use simple fuzzy match on existing data
    if (resourceType === 'page') {
      const allPages = await ctx.services.pageService.listPages()
      const matches = allPages.filter((p: any) =>
        p.name.toLowerCase().includes(input.query.toLowerCase()) ||
        p.slug.toLowerCase().includes(input.query.toLowerCase())
      )

      return {
        count: matches.length,
        matches: matches.map((m: any) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
          type: 'page'
        }))
      }
    }

    // For sections, use vector search on section_def type
    if (resourceType === 'section') {
      const results = await ctx.vectorIndex.search(input.query, 'section_def', 5)

      return {
        count: results.length,
        matches: results.map((r: any) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          type: 'section_def',
          similarity: r.similarity
        }))
      }
    }

    // For collections, use vector search
    if (resourceType === 'collection') {
      const results = await ctx.vectorIndex.search(input.query, 'collection', 5)

      return {
        count: results.length,
        matches: results.map((r: any) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          type: 'collection',
          similarity: r.similarity
        }))
      }
    }

    return { count: 0, matches: [] }
  }
})

// ============================================================================
// HTTP Tools
// ============================================================================

export const httpGet = tool({
  description: 'Make HTTP GET request to external API',
  inputSchema: z.object({
    url: z.string().describe('URL to fetch'),
    headers: z.record(z.string(), z.string()).optional().describe('Optional headers')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    ctx.logger.info({ message: 'HTTP GET request', url: input.url })
    
    const response = await fetch(input.url, {
      method: 'GET',
      headers: input.headers as Record<string, string>
    })
    
    const data = await response.json()
    return { status: response.status, data }
  }
})

export const httpPost = tool({
  description: 'Make HTTP POST request to external API. Requires confirmed: true.',
  inputSchema: z.object({
    url: z.string().describe('URL to post to'),
    body: z.record(z.string(), z.any()).describe('Request body'),
    headers: z.record(z.string(), z.string()).optional().describe('Optional headers'),
    confirmed: z.boolean().optional().describe('Must be true to execute')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Require confirmation for external POST requests
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to make a POST request to ${input.url}? Set confirmed: true to proceed.`,
        url: input.url
      }
    }

    ctx.logger.info({ message: 'HTTP POST request', url: input.url })

    const response = await fetch(input.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.headers as Record<string, string>)
      },
      body: JSON.stringify(input.body)
    })

    const data = await response.json()
    return { status: response.status, data }
  }
})

// ============================================================================
// Planning Tools
// ============================================================================

export const planAnalyzeTask = tool({
  description: 'Analyze user request and create execution plan',
  inputSchema: z.object({
    userRequest: z.string().describe('The user\'s original request'),
    context: z.record(z.string(), z.any()).optional().describe('Additional context')
  }),
  execute: async (input, options: any) => {
    const ctx = options.experimental_context as AgentContext
    const messages = options.messages || []
    
    // Check if we've already analyzed (look at message history)
    const previousPlans = messages.filter((m: any) => 
      m.role === 'assistant' && JSON.stringify(m.content).includes('plan:')
    )
    
    ctx.logger.info({ 
      message: 'Analyzing task',
      request: input.userRequest,
      hasPreviousPlans: previousPlans.length > 0
    })
    
    // Simple analysis - in real world this would be more sophisticated
    return {
      plan: {
        objective: input.userRequest,
        steps: [
          'Understand requirements',
          'Execute necessary actions',
          'Verify results'
        ],
        estimatedSteps: 3
      }
    }
  }
})

// ============================================================================
// Export All Tools
// ============================================================================

export const ALL_TOOLS = {
  // Core tools (always available)
  'tool_search': toolSearchTool,
  'final_answer': finalAnswerTool,

  // Pages
  'cms_getPage': cmsGetPage,
  'cms_createPage': cmsCreatePage,
  'cms_createPageWithContent': cmsCreatePageWithContent,
  'cms_updatePage': cmsUpdatePage,
  'cms_deletePage': cmsDeletePage,
  'cms_listPages': cmsListPages,
  
  // Sections
  'cms_listSectionTemplates': cmsListSectionTemplates,
  'cms_getSectionFields': cmsGetSectionFields,
  'cms_addSectionToPage': cmsAddSectionToPage,
  'cms_updateSectionContent': cmsUpdateSectionContent,
  'cms_deletePageSection': cmsDeletePageSection,
  'cms_deletePageSections': cmsDeletePageSections,
  'cms_getPageSections': cmsGetPageSections,
  'cms_getSectionContent': cmsGetSectionContent,
  
  // Collections & Entries
  'cms_getCollectionEntries': cmsGetCollectionEntries,
  'cms_getEntryContent': cmsGetEntryContent,
  
  // Search
  'search_vector': searchVector,
  'cms_findResource': cmsFindResource,

  // Images
  'cms_findImage': findImageTool,
  'cms_searchImages': searchImagesTool,
  'cms_listAllImages': listAllImagesTool,
  'cms_addImageToSection': addImageToSectionTool,
  'cms_updateSectionImage': updateSectionImageTool,
  'cms_replaceImage': replaceImageTool,
  'cms_deleteImage': deleteImageTool,

  // Site Settings & Navigation
  'cms_getNavigation': getNavigationTool,
  'cms_addNavigationItem': addNavigationItemTool,
  'cms_updateNavigationItem': updateNavigationItemTool,
  'cms_removeNavigationItem': removeNavigationItemTool,
  'cms_toggleNavigationItem': toggleNavigationItemTool,

  // Posts (Blog, Products, etc.)
  'cms_createPost': cmsCreatePost,
  'cms_updatePost': cmsUpdatePost,
  'cms_publishPost': cmsPublishPost,
  'cms_archivePost': cmsArchivePost,
  'cms_deletePost': cmsDeletePost,
  'cms_listPosts': cmsListPosts,
  'cms_getPost': cmsGetPost,

  // HTTP
  'http_get': httpGet,
  'http_post': httpPost,

  // Planning
  'plan_analyzeTask': planAnalyzeTask,

  // Web Research (Exa AI)
  'web_quickSearch': webQuickSearchTool,
  'web_deepResearch': webDeepResearchTool,
  'web_fetchContent': webFetchContentTool,

  // Stock Photos (Pexels)
  'pexels_searchPhotos': pexelsSearchPhotosTool,
  'pexels_downloadPhoto': pexelsDownloadPhotoTool,

  // Stock Photos (Unsplash)
  'unsplash_searchPhotos': unsplashSearchPhotosTool,
  'unsplash_downloadPhoto': unsplashDownloadPhotoTool
}

// ============================================================================
// Discovery & CMS Tool Exports (for Dynamic Tool Injection)
// ============================================================================
//
// Tool metadata is now in TOOL_INDEX (discovery/tool-index.ts)
// ============================================================================
