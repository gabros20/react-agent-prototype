/**
 * All Tools - Native AI SDK v6 Pattern
 *
 * Tools created ONCE with execute functions that receive experimental_context.
 * No factories, no wrappers, no recreation - pure AI SDK v6 pattern.
 *
 * Phase 1 Migration: Both old (cms_*) and new (atomic) tools are exported.
 * Old tools are aliased to new tools where merged.
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { AgentContext } from './types'

// Core tool imports (must be at top to avoid circular init issues)
import { toolSearchTool } from './discovery/tool-search'
import { finalAnswerTool } from './core/final-answer'
import { acknowledgeTool } from './core/acknowledge'

// NEW: Atomic tools (Phase 1 implementation)
import {
  getPage,
  createPage,
  updatePage,
  deletePage,
} from './atomic/page-tools'
import {
  getPost,
  createPost,
  updatePost,
  deletePost,
} from './atomic/post-tools'
import {
  getSectionTemplate,
  getSection,
  createSection,
  updateSection,
  deleteSection,
} from './atomic/section-tools'
import {
  getNavItem,
  createNavItem,
  updateNavItem,
  deleteNavItem,
} from './atomic/navigation-tools'
import {
  getImage,
  updateImage,
  deleteImage as deleteImageTool,
} from './atomic/image-tools'
import {
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
} from './atomic/entry-tools'

// Legacy image tools (for addImageToSection, replaceImage until Phase 2)
import {
  addImageToSectionTool,
  replaceImageTool,
} from './image-tools'

// Web research tools
import {
  webQuickSearchTool,
  webDeepResearchTool,
  webFetchContentTool
} from './web-research-tools'

// Stock photo tools
import {
  pexelsSearchPhotosTool,
  pexelsDownloadPhotoTool
} from './pexels-tools'
import {
  unsplashSearchPhotosTool,
  unsplashDownloadPhotoTool
} from './unsplash-tools'

// Utilities
import {
  generateHeroContent,
  generateMetadata,
  generateSlug
} from '../utils/page-content-generator'
import { classifyPageForNavigation } from '../utils/navigation-classifier'
import { SiteSettingsService } from '../services/cms/site-settings-service'

// ============================================================================
// Legacy Tools - To be removed after Phase 2
// These are kept for backward compatibility during migration
// ============================================================================

export const cmsCreatePageWithContent = tool({
  description: 'Create page with sections. Images added separately via updateSection.',
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

      // Get section template by key
      const sectionTemplate = await ctx.services.sectionService.getSectionTemplateByKey(sectionSpec.sectionKey)
      if (!sectionTemplate) {
        throw new Error(`Section template "${sectionSpec.sectionKey}" not found. Use getSectionTemplate to see available sections.`)
      }

      // Add section to page
      const pageSection = await ctx.services.sectionService.addSectionToPage({
        pageId: page.id,
        sectionTemplateId: sectionTemplate.id,
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
      nextSteps: 'Page created with placeholder images. Use getImage to find relevant images, then updateSection to attach them.'
    }
  }
})

// ============================================================================
// Search Tools (to be refactored in Phase 4)
// ============================================================================

export const searchVector = tool({
  description: 'Search for content using vector similarity (semantic search)',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    type: z.enum(['page', 'section_template', 'collection', 'entry']).optional().describe('Filter by resource type'),
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

    // For sections, use vector search on section_template type
    if (resourceType === 'section') {
      const results = await ctx.vectorIndex.search(input.query, 'section_template', 5)

      return {
        count: results.length,
        matches: results.map((r: any) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          type: 'section_template',
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
  'acknowledge': acknowledgeTool,

  // ============================================================================
  // NEW ATOMIC TOOLS (Phase 1)
  // ============================================================================

  // Pages (4)
  'getPage': getPage,
  'createPage': createPage,
  'updatePage': updatePage,
  'deletePage': deletePage,

  // Posts (4)
  'getPost': getPost,
  'createPost': createPost,
  'updatePost': updatePost,
  'deletePost': deletePost,

  // Sections (5)
  'getSectionTemplate': getSectionTemplate,
  'getSection': getSection,
  'createSection': createSection,
  'updateSection': updateSection,
  'deleteSection': deleteSection,

  // Navigation (4)
  'getNavItem': getNavItem,
  'createNavItem': createNavItem,
  'updateNavItem': updateNavItem,
  'deleteNavItem': deleteNavItem,

  // Images (3)
  'getImage': getImage,
  'updateImage': updateImage,
  'deleteImage': deleteImageTool,

  // Entries (4)
  'getEntry': getEntry,
  'createEntry': createEntry,
  'updateEntry': updateEntry,
  'deleteEntry': deleteEntry,

  // ============================================================================
  // LEGACY TOOLS (Aliases for backward compatibility - to be removed)
  // ============================================================================

  // Page aliases
  'cms_getPage': getPage,
  'cms_listPages': getPage,  // Use with { all: true }
  'cms_createPage': createPage,
  'cms_createPageWithContent': cmsCreatePageWithContent,  // Composite - keep for now
  'cms_updatePage': updatePage,
  'cms_deletePage': deletePage,

  // Section aliases
  'cms_listSectionTemplates': getSectionTemplate,  // Use with { all: true }
  'cms_getSectionFields': getSectionTemplate,
  'cms_getPageSections': getSection,  // Use with { pageId }
  'cms_getSectionContent': getSection,  // Use with { pageSectionId }
  'cms_addSectionToPage': createSection,
  'cms_updateSectionContent': updateSection,
  'cms_updateSectionImage': updateSection,  // Use with imageId + imageField
  'cms_deletePageSection': deleteSection,
  'cms_deletePageSections': deleteSection,

  // Image aliases
  'cms_findImage': getImage,  // Use with { query }
  'cms_searchImages': getImage,  // Use with { query }
  'cms_listAllImages': getImage,  // Use with { all: true }
  'cms_addImageToSection': addImageToSectionTool,  // Legacy - use updateSection
  'cms_replaceImage': replaceImageTool,  // Legacy - manual workflow
  'cms_deleteImage': deleteImageTool,

  // Navigation aliases
  'cms_getNavigation': getNavItem,  // Use with { all: true }
  'cms_addNavigationItem': createNavItem,
  'cms_updateNavigationItem': updateNavItem,
  'cms_removeNavigationItem': deleteNavItem,
  'cms_toggleNavigationItem': updateNavItem,  // Use with { visible }

  // Post aliases
  'cms_createPost': createPost,
  'cms_updatePost': updatePost,
  'cms_publishPost': updatePost,  // Use with { status: 'published', confirmed: true }
  'cms_archivePost': updatePost,  // Use with { status: 'archived', confirmed: true }
  'cms_deletePost': deletePost,
  'cms_listPosts': getPost,  // Use with { all: true }
  'cms_getPost': getPost,

  // Entry aliases
  'cms_getCollectionEntries': getEntry,  // Use with { collectionId }
  'cms_getEntryContent': getEntry,  // Use with { id }

  // ============================================================================
  // UTILITY TOOLS (unchanged)
  // ============================================================================

  // Search
  'search_vector': searchVector,
  'cms_findResource': cmsFindResource,

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
