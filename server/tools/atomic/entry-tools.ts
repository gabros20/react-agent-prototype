/**
 * Atomic Entry Tools - Collection entries CRUD
 * Following ATOMIC_CRUD_TOOL_ARCHITECTURE.md patterns
 *
 * Note: Posts are a special case of entries (blog collection).
 * These tools are for generic collection entries.
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { AgentContext } from '../types'

// ============================================================================
// getEntry - Get collection entry(s)
// ============================================================================

export const getEntry = tool({
  description: 'Get collection entry(s). By id, slug, or collectionId.',
  inputSchema: z.object({
    // Scope selection
    id: z.string().uuid().optional().describe('Get single entry by UUID'),
    slug: z.string().optional().describe('Get single entry by slug'),
    collectionId: z.string().uuid().optional().describe('Get all entries in collection'),
    all: z.boolean().optional().describe('Get all entries (requires collectionId)'),

    // Modifiers
    includeContent: z.boolean().optional().default(false).describe('Include full entry content'),
    status: z.enum(['draft', 'published', 'archived']).optional().describe('Filter by status'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
  }).refine(
    data => data.id || data.slug || data.collectionId,
    { message: 'Provide id, slug, or collectionId' }
  ),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Case 1: Get by ID
    if (input.id) {
      const entry = await ctx.services.entryService.getEntryContent(
        input.id,
        input.localeCode || 'en'
      )
      if (!entry) {
        return { success: false, count: 0, items: [], error: `Entry not found: ${input.id}` }
      }
      return {
        success: true,
        count: 1,
        items: [entry]
      }
    }

    // Case 2: Get by slug
    if (input.slug) {
      const entry = await ctx.services.entryService.getEntryBySlug(
        input.slug,
        input.localeCode || 'en'
      )
      if (!entry) {
        return { success: false, count: 0, items: [], error: `Entry not found: ${input.slug}` }
      }
      return {
        success: true,
        count: 1,
        items: [formatEntry(entry, input.includeContent)]
      }
    }

    // Case 3: Get all in collection
    if (input.collectionId) {
      let entries = await ctx.services.entryService.getCollectionEntries(
        input.collectionId,
        input.includeContent || false,
        input.localeCode || 'en'
      )

      // Filter by status if provided
      if (input.status) {
        entries = entries.filter((e: any) => e.status === input.status)
      }

      return {
        success: true,
        count: entries.length,
        collectionId: input.collectionId,
        items: entries.map((e: any) => formatEntry(e, input.includeContent))
      }
    }

    return { success: false, count: 0, items: [], error: 'Provide id, slug, or collectionId' }
  }
})

// ============================================================================
// createEntry - Create collection entry
// ============================================================================

export const createEntry = tool({
  description: 'Create collection entry.',
  inputSchema: z.object({
    collectionId: z.string().uuid().describe('Collection ID'),
    slug: z.string().describe('Entry slug'),
    title: z.string().describe('Entry title'),
    content: z.record(z.string(), z.any()).optional().describe('Entry content'),
    status: z.enum(['draft', 'published']).optional().default('draft').describe('Initial status'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    const entry = await ctx.services.entryService.upsertEntry({
      collectionId: input.collectionId,
      slug: input.slug,
      title: input.title,
      localeCode: input.localeCode || 'en',
      content: input.content || {},
    })

    return {
      success: true,
      count: 1,
      items: [{
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        status: entry.status || 'draft'
      }]
    }
  }
})

// ============================================================================
// updateEntry - Update collection entry
// ============================================================================

export const updateEntry = tool({
  description: 'Update entry content or status.',
  inputSchema: z.object({
    id: z.string().uuid().describe('Entry ID to update'),
    slug: z.string().optional().describe('New slug'),
    title: z.string().optional().describe('New title'),
    content: z.record(z.string(), z.any()).optional().describe('New content (merges with existing)'),
    status: z.enum(['draft', 'published', 'archived']).optional().describe('New status'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get existing entry with full details (including collectionId)
    const entry = await ctx.services.entryService.getEntryContent(input.id, input.localeCode || 'en') as any
    if (!entry) {
      return { success: false, error: `Entry not found: ${input.id}` }
    }

    // Update metadata
    if (input.title || input.status) {
      await ctx.services.entryService.updateEntryMetadata(input.id, {
        title: input.title,
        status: input.status,
      })
    }

    // Update content if provided - need to get collection ID from the entry
    if (input.content) {
      // Get the entry's collection ID from the entry record itself
      const entryRecord = await ctx.db.query.collectionEntries.findFirst({
        where: (entries, { eq }) => eq(entries.id, input.id)
      })

      if (entryRecord) {
        await ctx.services.entryService.upsertEntry({
          collectionId: entryRecord.collectionId,
          slug: input.slug || entry.slug,
          title: input.title || entry.title,
          localeCode: input.localeCode || 'en',
          content: {
            ...entry.content,
            ...input.content,
          },
        })
      }
    }

    return {
      success: true,
      message: 'Entry updated',
      id: input.id
    }
  }
})

// ============================================================================
// deleteEntry - Delete entry(s) permanently
// ============================================================================

export const deleteEntry = tool({
  description: 'Delete entry(s). Array param. Requires confirmed.',
  inputSchema: z.object({
    ids: z.array(z.string().uuid()).describe('Entry IDs to delete (always array, even for single)'),
    confirmed: z.boolean().optional().describe('Must be true to actually delete'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get entries to show what will be deleted
    const entriesToDelete: any[] = []
    for (const id of input.ids) {
      const entry = await ctx.services.entryService.getEntryContent(id, 'en')
      if (entry) {
        entriesToDelete.push(entry)
      }
    }

    if (entriesToDelete.length === 0) {
      return { success: false, error: 'No entries found with provided IDs' }
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete ${entriesToDelete.length} entry(s)? This cannot be undone. Set confirmed: true to proceed.`,
        items: entriesToDelete.map(e => ({ id: e.id, slug: e.slug, title: e.title }))
      }
    }

    // Delete each entry
    const deleted: any[] = []
    for (const entry of entriesToDelete) {
      await ctx.services.entryService.deleteEntry(entry.id)
      deleted.push({ id: entry.id, slug: entry.slug, title: entry.title })
    }

    return {
      success: true,
      message: `Deleted ${deleted.length} entry(s)`,
      deleted
    }
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

function formatEntry(entry: any, includeContent?: boolean) {
  const base = {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    status: entry.status,
    createdAt: entry.createdAt,
  }

  if (includeContent) {
    return {
      ...base,
      content: entry.content,
      collection: entry.collection
    }
  }

  return base
}
