/**
 * All Tools - Native AI SDK v6 Pattern
 * 
 * Tools created ONCE with execute functions that receive experimental_context.
 * No factories, no wrappers, no recreation - pure AI SDK v6 pattern.
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { AgentContext } from './types'

// ============================================================================
// CMS - Page Tools
// ============================================================================

export const cmsGetPage = tool({
  description: 'Get a page by slug or ID with all sections and localized content. Returns page structure with sorted sections.',
  inputSchema: z.object({
    slug: z.string().optional().describe('Page slug (e.g., "home")'),
    id: z.string().optional().describe('Page ID (UUID)')
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
      page = await ctx.services.pageService.getPageBySlug(input.slug)
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
        order: ps.order,
        content: ps.content
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
  description: 'Delete a page (CASCADE: deletes all sections). DANGEROUS - requires confirmation.',
  inputSchema: z.object({
    id: z.string().describe('Page ID to delete'),
    confirmed: z.boolean().optional().describe('Set to true to confirm deletion')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    // Require explicit confirmation
    if (!input.confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: 'STOP: This is a destructive operation. Call again with confirmed: true if user has approved.'
      }
    }
    
    await ctx.services.pageService.deletePage(input.id)
    return { success: true, message: `Page ${input.id} deleted` }
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

// ============================================================================
// CMS - Section Tools
// ============================================================================

export const cmsListSectionDefs = tool({
  description: 'List all available section definitions (templates)',
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

export const cmsGetSectionDef = tool({
  description: 'Get section definition with schema (elements_structure). Use this to see what fields a section needs before adding content.',
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
  description: 'Add a section to a page. Returns pageSectionId - use with cms_getSectionDef to see schema, then cms_syncPageContent to add content.',
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
      message: 'Section added. Use cms_getSectionDef to see schema, then cms_syncPageContent to add content.'
    }
  }
})

export const cmsSyncPageContent = tool({
  description: 'Update content for a page section',
  inputSchema: z.object({
    pageSectionId: z.string().describe('Page section ID'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
    content: z.record(z.string(), z.any()).describe('Content data matching section schema')
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
  description: 'Delete a section from a page. Removes the section instance (not the template). DANGEROUS - requires confirmation.',
  inputSchema: z.object({
    pageSectionId: z.string().describe('Page section ID (from cms_getPage sections array)'),
    confirmed: z.boolean().optional().describe('Set to true to confirm deletion')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    // Require explicit confirmation
    if (!input.confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: 'STOP: This is a destructive operation. Call again with confirmed: true if user has approved.'
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
  description: 'Delete multiple sections from a page in one operation (more efficient than one-by-one). DANGEROUS - requires confirmation.',
  inputSchema: z.object({
    pageSectionIds: z.array(z.string()).describe('Array of page section IDs to delete'),
    pageId: z.string().optional().describe('Optional: page ID for validation'),
    confirmed: z.boolean().optional().describe('Set to true to confirm deletion')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    // Require explicit confirmation
    if (!input.confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: `STOP: About to delete ${input.pageSectionIds.length} sections. Call again with confirmed: true if user has approved.`
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
  description: 'Find CMS resource by name/query using fuzzy matching (typo-tolerant). Use this to find pages by partial name or slug.',
  inputSchema: z.object({
    query: z.string().describe('Search query - partial name or slug to search for (e.g., "about" to find "About Us")'),
    resourceType: z.enum(['page', 'section', 'collection']).optional().describe('Type of resource to search for (defaults to page)')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
    // Simple fuzzy match implementation
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
  description: 'Make HTTP POST request to external API',
  inputSchema: z.object({
    url: z.string().describe('URL to post to'),
    body: z.record(z.string(), z.any()).describe('Request body'),
    headers: z.record(z.string(), z.string()).optional().describe('Optional headers')
  }),
  needsApproval: true,  // Native AI SDK v6 approval pattern!
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    
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
  // Pages
  'cms_getPage': cmsGetPage,
  'cms_createPage': cmsCreatePage,
  'cms_updatePage': cmsUpdatePage,
  'cms_deletePage': cmsDeletePage,
  'cms_listPages': cmsListPages,
  
  // Sections
  'cms_listSectionDefs': cmsListSectionDefs,
  'cms_getSectionDef': cmsGetSectionDef,
  'cms_addSectionToPage': cmsAddSectionToPage,
  'cms_syncPageContent': cmsSyncPageContent,
  'cms_deletePageSection': cmsDeletePageSection,
  'cms_deletePageSections': cmsDeletePageSections,
  
  // Search
  'search_vector': searchVector,
  'cms_findResource': cmsFindResource,
  
  // HTTP
  'http_get': httpGet,
  'http_post': httpPost,
  
  // Planning
  'plan_analyzeTask': planAnalyzeTask
}

// ============================================================================
// Tool Metadata (separate from tools)
// ============================================================================

export const TOOL_METADATA = {
  'cms_getPage': {
    category: 'cms',
    riskLevel: 'safe',
    requiresApproval: false,
    tags: ['read', 'page']
  },
  'cms_createPage': {
    category: 'cms',
    riskLevel: 'moderate',
    requiresApproval: false,
    tags: ['write', 'page']
  },
  'cms_updatePage': {
    category: 'cms',
    riskLevel: 'moderate',
    requiresApproval: false,
    tags: ['write', 'page']
  },
  'cms_deletePage': {
    category: 'cms',
    riskLevel: 'high',
    requiresApproval: false,  // Uses confirmed flag instead
    tags: ['delete', 'dangerous']
  },
  'cms_listPages': {
    category: 'cms',
    riskLevel: 'safe',
    requiresApproval: false,
    tags: ['read', 'list']
  },
  'cms_listSectionDefs': {
    category: 'cms',
    riskLevel: 'safe',
    requiresApproval: false,
    tags: ['read', 'section', 'list']
  },
  'cms_getSectionDef': {
    category: 'cms',
    riskLevel: 'safe',
    requiresApproval: false,
    tags: ['read', 'section']
  },
  'cms_addSectionToPage': {
    category: 'cms',
    riskLevel: 'moderate',
    requiresApproval: false,
    tags: ['write', 'section', 'page']
  },
  'cms_syncPageContent': {
    category: 'cms',
    riskLevel: 'moderate',
    requiresApproval: false,
    tags: ['write', 'section', 'content']
  },
  'cms_deletePageSection': {
    category: 'cms',
    riskLevel: 'high',
    requiresApproval: false,  // Uses confirmed flag instead
    tags: ['delete', 'section', 'dangerous']
  },
  'cms_deletePageSections': {
    category: 'cms',
    riskLevel: 'high',
    requiresApproval: false,  // Uses confirmed flag instead
    tags: ['delete', 'section', 'batch', 'dangerous']
  },
  'search_vector': {
    category: 'search',
    riskLevel: 'safe',
    requiresApproval: false,
    tags: ['read', 'search']
  },
  'cms_findResource': {
    category: 'cms',
    riskLevel: 'safe',
    requiresApproval: false,
    tags: ['read', 'search', 'fuzzy']
  },
  'http_get': {
    category: 'http',
    riskLevel: 'moderate',
    requiresApproval: false,
    tags: ['http', 'external']
  },
  'http_post': {
    category: 'http',
    riskLevel: 'high',
    requiresApproval: true,
    tags: ['http', 'external', 'write']
  },
  'plan_analyzeTask': {
    category: 'planning',
    riskLevel: 'safe',
    requiresApproval: false,
    tags: ['planning', 'analysis']
  }
} as const
