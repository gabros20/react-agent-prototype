/**
 * Atomic Post Tools - Unified CRUD operations
 * Phase 1: Merged cms_getPost + cms_listPosts → getPost
 * Phase 2: Merged cms_publishPost + cms_archivePost → updatePost with status
 *
 * Following ATOMIC_CRUD_TOOL_ARCHITECTURE.md patterns:
 * - Scope selection via mutually exclusive params (slug/all)
 * - Status changes via updatePost (publish/archive)
 * - Unified response format with items array
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { AgentContext } from '../types'

// ============================================================================
// getPost - Unified read tool for posts
// ============================================================================

export const getPost = tool({
  description: 'Get post(s). By slug, or all with filters (status, category).',
  inputSchema: z.object({
    // Scope selection
    slug: z.string().optional().describe('Get single post by slug'),
    all: z.boolean().optional().describe('Get all posts'),

    // Filters (when all: true)
    collectionSlug: z.string().optional().default('blog').describe('Collection slug (default: "blog")'),
    status: z.enum(['draft', 'published', 'archived', 'all']).optional().default('published').describe('Filter by status (default: published)'),
    category: z.string().optional().describe('Filter by category'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
  }).refine(
    data => data.slug || data.all,
    { message: 'Provide slug or set all: true' }
  ),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Case 1: Get single by slug
    if (input.slug) {
      const entry = await ctx.services.entryService.getEntryBySlug(
        input.slug,
        input.localeCode || 'en'
      )

      if (!entry) {
        return { success: false, count: 0, items: [], error: `Post not found: ${input.slug}` }
      }

      return {
        success: true,
        count: 1,
        items: [formatPostFull(entry)]
      }
    }

    // Case 2: Get all posts with filters
    if (input.all) {
      const collectionSlug = input.collectionSlug || 'blog'

      // Get collection
      const collection = await ctx.services.entryService.getCollectionTemplateBySlug(collectionSlug)
      if (!collection) {
        return { success: false, count: 0, items: [], error: `Collection "${collectionSlug}" not found` }
      }

      let entries: any[]

      if (input.category) {
        // Filter by category (published only)
        entries = await ctx.services.entryService.getEntriesByCategory(
          collection.id,
          input.category,
          input.localeCode || 'en'
        )
      } else if (input.status === 'published' || input.status === undefined) {
        // Published posts only (default)
        entries = await ctx.services.entryService.listPublishedEntries(
          collection.id,
          input.localeCode || 'en'
        )
      } else if (input.status === 'all') {
        // All posts (draft, published, archived)
        entries = await ctx.services.entryService.getCollectionEntries(
          collection.id,
          true,
          input.localeCode || 'en'
        )
      } else {
        // Specific status filter
        const allEntries = await ctx.services.entryService.getCollectionEntries(
          collection.id,
          true,
          input.localeCode || 'en'
        )
        entries = allEntries.filter((e: any) => e.status === input.status)
      }

      return {
        success: true,
        count: entries.length,
        items: entries.map((e: any) => formatPostLight(e)),
        collection: {
          slug: collection.slug,
          name: collection.name
        },
        filters: {
          status: input.status || 'published',
          category: input.category || null
        }
      }
    }

    return { success: false, count: 0, items: [], error: 'Provide slug or set all: true' }
  }
})

// ============================================================================
// createPost - Create draft post
// ============================================================================

export const createPost = tool({
  description: 'Create draft post. Use updatePost to publish.',
  inputSchema: z.object({
    collectionSlug: z.string().default('blog').describe('Collection slug (default: "blog")'),
    slug: z.string().describe('URL-friendly post slug'),
    title: z.string().describe('Post title'),
    content: z.object({
      body: z.string().describe('Post body (supports markdown)'),
      cover: z.object({
        url: z.string(),
        alt: z.string()
      }).optional().describe('Cover image'),
      tags: z.array(z.string()).optional().describe('Post tags')
    }).describe('Post content'),
    author: z.string().optional().describe('Author name'),
    excerpt: z.string().optional().describe('Short summary/excerpt'),
    featuredImage: z.string().optional().describe('Featured image URL'),
    category: z.string().optional().describe('Post category'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get collection
    const collection = await ctx.services.entryService.getCollectionTemplateBySlug(input.collectionSlug || 'blog')
    if (!collection) {
      return { success: false, error: `Collection "${input.collectionSlug}" not found` }
    }

    // Create post (status: draft by default)
    const entry = await ctx.services.entryService.upsertEntry({
      collectionId: collection.id,
      slug: input.slug,
      title: input.title,
      localeCode: input.localeCode || 'en',
      content: input.content,
      author: input.author,
      excerpt: input.excerpt,
      featuredImage: input.featuredImage,
      category: input.category,
    })

    return {
      success: true,
      count: 1,
      items: [{
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        status: 'draft',
        message: 'Post created as draft. Use updatePost with status: "published" to publish.'
      }]
    }
  }
})

// ============================================================================
// updatePost - Update post (including publish/archive via status)
// ============================================================================

export const updatePost = tool({
  description: 'Update post. Set status: published/archived to change state.',
  inputSchema: z.object({
    slug: z.string().describe('Post slug to update'),
    title: z.string().optional().describe('New title'),
    content: z.object({
      body: z.string().optional(),
      cover: z.object({
        url: z.string(),
        alt: z.string()
      }).optional(),
      tags: z.array(z.string()).optional()
    }).optional().describe('New content (merges with existing)'),
    status: z.enum(['draft', 'published', 'archived']).optional().describe('New status (requires confirmed for publish/archive)'),
    author: z.string().optional().describe('New author'),
    excerpt: z.string().optional().describe('New excerpt'),
    featuredImage: z.string().optional().describe('New featured image URL'),
    category: z.string().optional().describe('New category'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
    confirmed: z.boolean().optional().describe('Required for status changes to published/archived'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get existing post
    const entry = await ctx.services.entryService.getEntryBySlug(input.slug, input.localeCode || 'en')
    if (!entry) {
      return { success: false, error: `Post "${input.slug}" not found` }
    }

    // Status changes require confirmation
    if (input.status && input.status !== entry.status) {
      if (!input.confirmed) {
        const action = input.status === 'published' ? 'publish' : input.status === 'archived' ? 'archive' : 'change status of'
        return {
          requiresConfirmation: true,
          message: `Are you sure you want to ${action} "${entry.title}"? Set confirmed: true to proceed.`,
          items: [{ slug: entry.slug, title: entry.title, currentStatus: entry.status, newStatus: input.status }]
        }
      }

      // Handle publish action
      if (input.status === 'published') {
        const published = await ctx.services.entryService.publishEntry(entry.id)
        if (!published) {
          return { success: false, error: `Failed to publish post: ${entry.slug}` }
        }
      }

      // Handle archive action
      if (input.status === 'archived') {
        await ctx.services.entryService.archiveEntry(entry.id)
      }
    }

    // Auto-sync: If content.cover is set but featuredImage isn't, copy the URL
    let featuredImageToUpdate = input.featuredImage
    if (input.content?.cover?.url && !featuredImageToUpdate) {
      featuredImageToUpdate = input.content.cover.url
    }

    // Update metadata if provided
    if (input.title || input.author || input.excerpt || featuredImageToUpdate || input.category || input.status) {
      await ctx.services.entryService.updateEntryMetadata(entry.id, {
        title: input.title,
        author: input.author,
        excerpt: input.excerpt,
        featuredImage: featuredImageToUpdate,
        category: input.category,
        status: input.status,
      })
    }

    // Update content if provided
    if (input.content) {
      const collection = await ctx.services.entryService.getCollectionTemplateById(entry.collection.id)
      await ctx.services.entryService.upsertEntry({
        collectionId: collection!.id,
        slug: entry.slug,
        title: input.title || entry.title,
        localeCode: input.localeCode || 'en',
        content: {
          ...entry.content,
          ...input.content,
        },
      })
    }

    // Get updated post
    const updated = await ctx.services.entryService.getEntryBySlug(input.slug, input.localeCode || 'en')

    return {
      success: true,
      count: 1,
      items: [{
        id: entry.id,
        slug: entry.slug,
        title: input.title || entry.title,
        status: updated?.status || entry.status,
        message: 'Post updated successfully'
      }]
    }
  }
})

// ============================================================================
// deletePost - Delete post(s) permanently
// ============================================================================

export const deletePost = tool({
  description: 'Delete post(s). Array param. Requires confirmed.',
  inputSchema: z.object({
    slugs: z.array(z.string()).describe('Post slugs to delete (always array, even for single)'),
    confirmed: z.boolean().optional().describe('Must be true to actually delete'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get all posts to show what will be deleted
    const postsToDelete: any[] = []
    for (const slug of input.slugs) {
      const entry = await ctx.services.entryService.getEntryBySlug(slug)
      if (entry) {
        postsToDelete.push(entry)
      }
    }

    if (postsToDelete.length === 0) {
      return { success: false, error: 'No posts found with provided slugs' }
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to PERMANENTLY DELETE ${postsToDelete.length} post(s)? This cannot be undone. Consider using status: 'archived' instead. Set confirmed: true to proceed.`,
        items: postsToDelete.map(p => ({ slug: p.slug, title: p.title, status: p.status }))
      }
    }

    // Delete each post
    const deleted: any[] = []
    for (const post of postsToDelete) {
      await ctx.services.entryService.deleteEntry(post.id)
      deleted.push({ slug: post.slug, title: post.title })
    }

    return {
      success: true,
      message: `Deleted ${deleted.length} post(s) permanently`,
      deleted
    }
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

function formatPostLight(entry: any) {
  const cover = entry.content?.cover
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    status: entry.status,
    author: entry.author,
    excerpt: entry.excerpt,
    featuredImage: entry.featuredImage,
    coverImage: cover || null,
    category: entry.category,
    publishedAt: entry.publishedAt,
    createdAt: entry.createdAt,
  }
}

function formatPostFull(entry: any) {
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    status: entry.status,
    author: entry.author,
    excerpt: entry.excerpt,
    featuredImage: entry.featuredImage,
    category: entry.category,
    publishedAt: entry.publishedAt,
    createdAt: entry.createdAt,
    content: entry.content,
    collection: {
      slug: entry.collection.slug,
      name: entry.collection.name,
    }
  }
}
