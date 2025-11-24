/**
 * Post Management Tools - Blog Posts, Products, etc.
 * Uses existing collections system with post-specific enhancements
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { AgentContext } from './types'

// ============================================================================
// Post Creation & Management
// ============================================================================

export const cmsCreatePost = tool({
  description: 'Create a new blog post or collection entry (status: draft by default). Use cms_publishPost to publish it.',
  inputSchema: z.object({
    collectionSlug: z.string().describe('Collection slug (e.g., "blog", "products")'),
    slug: z.string().describe('URL-friendly post slug (e.g., "my-first-post")'),
    title: z.string().describe('Post title'),
    content: z.object({
      body: z.string().describe('Post body content (supports markdown)'),
      cover: z.object({
        url: z.string(),
        alt: z.string()
      }).optional().describe('Cover image'),
      tags: z.array(z.string()).optional().describe('Post tags')
    }).describe('Post content object'),
    author: z.string().optional().describe('Author name'),
    excerpt: z.string().optional().describe('Short summary/excerpt for listings'),
    featuredImage: z.string().optional().describe('Featured image URL'),
    category: z.string().optional().describe('Post category'),
    localeCode: z.string().optional().default('en').describe('Locale code (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get collection
    const collection = await ctx.services.entryService.getCollectionDefBySlug(input.collectionSlug)
    if (!collection) {
      throw new Error(`Collection "${input.collectionSlug}" not found`)
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
      category: input.category
    })

    return {
      success: true,
      post: {
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        status: 'draft',
        message: 'Post created as draft. Use cms_publishPost to publish it.'
      }
    }
  }
})

export const cmsUpdatePost = tool({
  description: 'Update post metadata (title, author, excerpt, category, etc.) or content',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug to update'),
    updates: z.object({
      title: z.string().optional().describe('New title'),
      author: z.string().optional().describe('New author'),
      excerpt: z.string().optional().describe('New excerpt'),
      featuredImage: z.string().optional().describe('New featured image URL'),
      category: z.string().optional().describe('New category'),
      content: z.object({
        body: z.string().optional(),
        cover: z.object({
          url: z.string(),
          alt: z.string()
        }).optional(),
        tags: z.array(z.string()).optional()
      }).optional().describe('New content (if updating body/cover/tags)')
    }).describe('Fields to update'),
    localeCode: z.string().optional().default('en').describe('Locale code (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get existing post
    const entry = await ctx.services.entryService.getEntryBySlug(input.postSlug, input.localeCode || 'en')
    if (!entry) {
      throw new Error(`Post "${input.postSlug}" not found`)
    }

    // Update metadata if provided
    if (input.updates.title || input.updates.author || input.updates.excerpt ||
        input.updates.featuredImage || input.updates.category) {
      await ctx.services.entryService.updateEntryMetadata(entry.id, {
        title: input.updates.title,
        author: input.updates.author,
        excerpt: input.updates.excerpt,
        featuredImage: input.updates.featuredImage,
        category: input.updates.category
      })
    }

    // Update content if provided
    if (input.updates.content) {
      const collection = await ctx.services.entryService.getCollectionDefById(entry.collection.id)
      await ctx.services.entryService.upsertEntry({
        collectionId: collection!.id,
        slug: entry.slug,
        title: input.updates.title || entry.title,
        localeCode: input.localeCode || 'en',
        content: {
          ...entry.content,
          ...input.updates.content
        }
      })
    }

    return {
      success: true,
      post: {
        id: entry.id,
        slug: entry.slug,
        title: input.updates.title || entry.title,
        message: 'Post updated successfully'
      }
    }
  }
})

export const cmsPublishPost = tool({
  description: 'Publish a draft post (makes it publicly visible). DESTRUCTIVE: Requires confirmed: true.',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug to publish'),
    confirmed: z.boolean().optional().default(false).describe('Must be true to publish')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    if (!input.confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: `Are you sure you want to publish the post "${input.postSlug}"? This will make it publicly visible. Set confirmed: true to proceed.`,
        action: 'publish',
        postSlug: input.postSlug
      }
    }

    // Get post
    const entry = await ctx.services.entryService.getEntryBySlug(input.postSlug)
    if (!entry) {
      throw new Error(`Post "${input.postSlug}" not found`)
    }

    // Publish
    const published = await ctx.services.entryService.publishEntry(entry.id)

    return {
      success: true,
      post: {
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        status: 'published',
        publishedAt: published.publishedAt,
        message: 'Post published successfully and is now publicly visible'
      }
    }
  }
})

export const cmsArchivePost = tool({
  description: 'Archive a post (hides from public listings). DESTRUCTIVE: Requires confirmed: true.',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug to archive'),
    confirmed: z.boolean().optional().default(false).describe('Must be true to archive')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    if (!input.confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: `Are you sure you want to archive the post "${input.postSlug}"? It will be hidden from public view. Set confirmed: true to proceed.`,
        action: 'archive',
        postSlug: input.postSlug
      }
    }

    // Get post
    const entry = await ctx.services.entryService.getEntryBySlug(input.postSlug)
    if (!entry) {
      throw new Error(`Post "${input.postSlug}" not found`)
    }

    // Archive
    await ctx.services.entryService.archiveEntry(entry.id)

    return {
      success: true,
      post: {
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        status: 'archived',
        message: 'Post archived successfully and is now hidden from public view'
      }
    }
  }
})

export const cmsListPosts = tool({
  description: 'List posts from a collection. By default returns only published posts. Includes metadata but not full content.',
  inputSchema: z.object({
    collectionSlug: z.string().describe('Collection slug (e.g., "blog")'),
    status: z.enum(['draft', 'published', 'archived', 'all']).optional().default('published').describe('Filter by status (default: published)'),
    category: z.string().optional().describe('Filter by category'),
    localeCode: z.string().optional().default('en').describe('Locale code (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get collection
    const collection = await ctx.services.entryService.getCollectionDefBySlug(input.collectionSlug)
    if (!collection) {
      throw new Error(`Collection "${input.collectionSlug}" not found`)
    }

    let entries

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
        false,
        input.localeCode || 'en'
      )
    } else {
      // Specific status filter
      const allEntries = await ctx.services.entryService.getCollectionEntries(
        collection.id,
        false,
        input.localeCode || 'en'
      )
      entries = allEntries.filter((e: any) => e.status === input.status)
    }

    return {
      collection: {
        slug: collection.slug,
        name: collection.name
      },
      posts: entries.map((entry: any) => ({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        status: entry.status,
        author: entry.author,
        excerpt: entry.excerpt,
        featuredImage: entry.featuredImage,
        category: entry.category,
        publishedAt: entry.publishedAt,
        createdAt: entry.createdAt
      })),
      count: entries.length,
      filters: {
        status: input.status || 'published',
        category: input.category || null
      }
    }
  }
})

export const cmsGetPost = tool({
  description: 'Get a single post with full content by slug',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug'),
    localeCode: z.string().optional().default('en').describe('Locale code (default: "en")')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    const entry = await ctx.services.entryService.getEntryBySlug(
      input.postSlug,
      input.localeCode || 'en'
    )

    if (!entry) {
      throw new Error(`Post "${input.postSlug}" not found`)
    }

    return {
      post: {
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
          name: entry.collection.name
        }
      }
    }
  }
})

export const cmsDeletePost = tool({
  description: 'Permanently delete a blog post. DESTRUCTIVE: Requires confirmed: true. Use archive instead for soft delete.',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug to delete'),
    confirmed: z.boolean().optional().default(false).describe('Must be true to delete')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    if (!input.confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: `Are you sure you want to PERMANENTLY DELETE the post "${input.postSlug}"? This cannot be undone. Consider using cms_archivePost instead for soft delete. Set confirmed: true to proceed.`,
        action: 'delete',
        postSlug: input.postSlug
      }
    }

    // Get post
    const entry = await ctx.services.entryService.getEntryBySlug(input.postSlug)
    if (!entry) {
      throw new Error(`Post "${input.postSlug}" not found`)
    }

    // Delete the post
    await ctx.services.entryService.deleteEntry(entry.id)

    return {
      success: true,
      post: {
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        message: 'Post permanently deleted'
      }
    }
  }
})
