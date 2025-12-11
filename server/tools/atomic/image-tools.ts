/**
 * Atomic Image Tools - Unified CRUD operations
 * Phase 1: Merged image tools
 * - cms_findImage + cms_searchImages + cms_listAllImages → getImage
 * - createImage (upload - already exists in system)
 * - updateImage (metadata updates)
 * - deleteImage (permanently delete)
 *
 * Following ATOMIC_CRUD_TOOL_ARCHITECTURE.md patterns
 */

import { tool } from 'ai'
import { z } from 'zod'
import { images } from '../../db/schema'
import { eq } from 'drizzle-orm'
import imageProcessingService from '../../services/storage/image-processing.service'
import type { AgentContext } from '../types'

// ============================================================================
// getImage - Unified read tool for images
// ============================================================================

export const getImage = tool({
  description: 'Get local image(s). By id, query (semantic), or all.',
  inputSchema: z.object({
    // Scope selection
    id: z.string().uuid().optional().describe('Get single image by UUID'),
    query: z.string().optional().describe('Semantic search query (expand short queries: "AI" → "artificial intelligence technology")'),
    all: z.boolean().optional().describe('Get all images'),

    // Modifiers
    limit: z.number().optional().describe('Max results (default: 5 for query, 50 for all)'),
    status: z.enum(['completed', 'processing', 'failed']).optional().describe('Filter by processing status'),
    minScore: z.number().optional().describe('Minimum similarity score for query (default: -0.7)'),
  }).refine(
    data => data.id || data.query || data.all,
    { message: 'Provide id, query, or set all: true' }
  ),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Case 1: Get single by ID
    if (input.id) {
      const image = await ctx.db.query.images.findFirst({
        where: eq(images.id, input.id),
        with: { metadata: true }
      })

      if (!image) {
        return { success: false, count: 0, items: [], error: `Image not found: ${input.id}` }
      }

      return {
        success: true,
        count: 1,
        items: [formatImage(image)]
      }
    }

    // Case 2: Semantic search by query
    if (input.query) {
      const limit = input.limit || 5
      const minScore = input.minScore ?? -0.7

      try {
        // Fetch more results initially to allow filtering
        const { results } = await ctx.vectorIndex.searchImages(input.query, { limit: limit * 3 })

        // Filter by minimum score threshold
        const filteredResults = results.filter((r: { score: number }) => r.score >= minScore)

        // Get full image data from database
        const imageIds = filteredResults.map((r: { id: string }) => r.id)
        const fullImages = imageIds.length > 0
          ? await ctx.db.query.images.findMany({
              where: (images, { inArray }) => inArray(images.id, imageIds),
              with: { metadata: true }
            })
          : []

        // Create lookup map
        const imageMap = new Map(fullImages.map(img => [img.id, img]))

        const finalResults = filteredResults.slice(0, limit).map((r: { id: string; filename: string; description: string; score: number }) => {
          const img = imageMap.get(r.id)
          return {
            id: r.id,
            filename: r.filename,
            url: img?.cdnUrl ?? (img?.filePath ? `/uploads/${img.filePath}` : undefined),
            description: r.description,
            score: r.score,
            relevance: r.score >= -0.3 ? 'strong' : r.score >= -0.6 ? 'moderate' : 'weak'
          }
        })

        return {
          success: true,
          count: finalResults.length,
          query: input.query,
          items: finalResults,
          hint: finalResults.length === 0
            ? 'No images matched. Try different keywords or lower minScore.'
            : finalResults[0].relevance === 'strong'
              ? 'Strong matches found.'
              : 'Matches are moderate/weak - verify they fit user intent.'
        }
      } catch (error) {
        return {
          success: false,
          count: 0,
          items: [],
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }
    }

    // Case 3: Get all images
    if (input.all) {
      const limit = input.limit || 50

      const allImages = await ctx.db.query.images.findMany({
        where: input.status ? eq(images.status, input.status) : undefined,
        with: { metadata: true },
        limit,
        orderBy: (images, { desc }) => [desc(images.uploadedAt)]
      })

      return {
        success: true,
        count: allImages.length,
        items: allImages.map(formatImage)
      }
    }

    return { success: false, count: 0, items: [], error: 'Provide id, query, or set all: true' }
  }
})

// ============================================================================
// updateImage - Update image metadata
// ============================================================================

export const updateImage = tool({
  description: 'Update image metadata (description, tags).',
  inputSchema: z.object({
    id: z.string().uuid().describe('Image ID to update'),
    description: z.string().optional().describe('New description'),
    tags: z.array(z.string()).optional().describe('New tags'),
    categories: z.array(z.string()).optional().describe('New categories'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const { imageMetadata } = await import('../../db/schema')

    // Check image exists
    const image = await ctx.db.query.images.findFirst({
      where: eq(images.id, input.id),
      with: { metadata: true }
    })

    if (!image) {
      return { success: false, error: `Image not found: ${input.id}` }
    }

    // Update metadata
    const updates: any = {}
    if (input.description !== undefined) updates.description = input.description
    if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags)
    if (input.categories !== undefined) updates.categories = JSON.stringify(input.categories)

    if (image.metadata) {
      await ctx.db
        .update(imageMetadata)
        .set(updates)
        .where(eq(imageMetadata.imageId, input.id))
    }

    return {
      success: true,
      message: 'Image metadata updated',
      id: input.id
    }
  }
})

// ============================================================================
// deleteImage - Delete image(s) permanently
// ============================================================================

export const deleteImage = tool({
  description: 'Delete image(s). Array param. Requires confirmed.',
  inputSchema: z.object({
    ids: z.array(z.string().uuid()).describe('Image IDs to delete (always array, even for single)'),
    confirmed: z.boolean().optional().describe('Must be true to actually delete'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get images to show what will be deleted
    const imagesToDelete: any[] = []
    for (const id of input.ids) {
      const image = await ctx.db.query.images.findFirst({
        where: eq(images.id, id),
        with: { metadata: true }
      })
      if (image) {
        imagesToDelete.push(image)
      }
    }

    if (imagesToDelete.length === 0) {
      return { success: false, error: 'No images found with provided IDs' }
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete ${imagesToDelete.length} image(s)? This cannot be undone. Set confirmed: true to proceed.`,
        items: imagesToDelete.map(img => ({
          id: img.id,
          filename: img.filename,
          url: img.cdnUrl ?? (img.filePath ? `/uploads/${img.filePath}` : undefined)
        }))
      }
    }

    // Delete each image
    const deleted: any[] = []
    for (const image of imagesToDelete) {
      try {
        await imageProcessingService.deleteImage(image.id)
        deleted.push({ id: image.id, filename: image.filename })
      } catch (error) {
        // Continue with remaining images
      }
    }

    return {
      success: true,
      message: `Deleted ${deleted.length} image(s)`,
      deleted
    }
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

function formatImage(image: any) {
  return {
    id: image.id,
    filename: image.filename,
    originalFilename: image.originalFilename,
    url: image.cdnUrl ?? (image.filePath ? `/uploads/${image.filePath}` : undefined),
    status: image.status,
    uploadedAt: image.uploadedAt,
    description: image.metadata?.description,
    tags: image.metadata?.tags ? JSON.parse(image.metadata.tags as string) : [],
    categories: image.metadata?.categories ? JSON.parse(image.metadata.categories as string) : []
  }
}
