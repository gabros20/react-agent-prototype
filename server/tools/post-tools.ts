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

    // Auto-sync: If content.cover is set but featuredImage isn't, copy the URL
    // This ensures templates that use featuredImage will display the correct image
    let featuredImageToUpdate = input.updates.featuredImage
    if (input.updates.content?.cover?.url && !featuredImageToUpdate) {
      featuredImageToUpdate = input.updates.content.cover.url
    }

    // Update metadata if provided
    if (input.updates.title || input.updates.author || input.updates.excerpt ||
        featuredImageToUpdate || input.updates.category) {
      await ctx.services.entryService.updateEntryMetadata(entry.id, {
        title: input.updates.title,
        author: input.updates.author,
        excerpt: input.updates.excerpt,
        featuredImage: featuredImageToUpdate,
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
  description: 'Publish a draft post (makes it publicly visible). Requires confirmed: true.',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug to publish'),
    confirmed: z.boolean().optional().describe('Must be true to publish')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get post
    const entry = await ctx.services.entryService.getEntryBySlug(input.postSlug)
    if (!entry) {
      throw new Error(`Post "${input.postSlug}" not found`)
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to publish "${entry.title}"? This will make it publicly visible. Set confirmed: true to proceed.`,
        post: { slug: entry.slug, title: entry.title, status: entry.status }
      }
    }

    // Publish
    const published = await ctx.services.entryService.publishEntry(entry.id)

    if (!published) {
      throw new Error(`Failed to publish post: ${entry.slug}`)
    }

    return {
      success: true,
      post: {
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        status: 'published',
        publishedAt: published.publishedAt ?? new Date(),
        message: 'Post published successfully and is now publicly visible'
      }
    }
  }
})

export const cmsArchivePost = tool({
  description: 'Archive a post (hides from public listings). Requires confirmed: true.',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug to archive'),
    confirmed: z.boolean().optional().describe('Must be true to archive')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get post
    const entry = await ctx.services.entryService.getEntryBySlug(input.postSlug)
    if (!entry) {
      throw new Error(`Post "${input.postSlug}" not found`)
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to archive "${entry.title}"? It will be hidden from public view. Set confirmed: true to proceed.`,
        post: { slug: entry.slug, title: entry.title, status: entry.status }
      }
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
  description: 'Permanently delete a blog post. This cannot be undone. Consider using cms_archivePost for soft delete. Requires confirmed: true.',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug to delete'),
    confirmed: z.boolean().optional().describe('Must be true to delete')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get post
    const entry = await ctx.services.entryService.getEntryBySlug(input.postSlug)
    if (!entry) {
      throw new Error(`Post "${input.postSlug}" not found`)
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to PERMANENTLY DELETE "${entry.title}"? This cannot be undone. Consider using cms_archivePost instead. Set confirmed: true to proceed.`,
        post: { slug: entry.slug, title: entry.title, status: entry.status }
      }
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
