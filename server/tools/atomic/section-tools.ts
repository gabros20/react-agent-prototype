/**
 * Atomic Section Tools - Unified CRUD operations
 * Phase 1: Merged section templates + section content tools
 * - cms_listSectionTemplates + cms_getSectionFields → getSectionTemplate
 * - cms_getPageSections + cms_getSectionContent → getSection
 * - cms_addSectionToPage → createSection
 * - cms_updateSectionContent + cms_updateSectionImage → updateSection
 * - cms_deletePageSection + cms_deletePageSections → deleteSection
 *
 * Following ATOMIC_CRUD_TOOL_ARCHITECTURE.md patterns
 * Updated for Phase 2: DATABASE_ENDPOINT_REFACTOR.md
 */

import { tool } from 'ai'
import { z } from 'zod'
import { eq, inArray } from 'drizzle-orm'
import type { AgentContext } from '../types'

// ============================================================================
// getSectionTemplate - Get section template(s) / schema
// ============================================================================

export const getSectionTemplate = tool({
  description: 'Get section template(s). Shows fields and structure.',
  inputSchema: z.object({
    // Scope selection
    id: z.string().uuid().optional().describe('Get by section template UUID'),
    key: z.string().optional().describe('Get by section key (e.g., "hero", "feature")'),
    all: z.boolean().optional().describe('Get all section templates'),
  }).refine(
    data => data.id || data.key || data.all,
    { message: 'Provide id, key, or set all: true' }
  ),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Case 1: Get by ID
    if (input.id) {
      const sectionTemplate = await ctx.services.sectionService.getSectionTemplateById(input.id)
      if (!sectionTemplate) {
        return { success: false, count: 0, items: [], error: `Section template not found: ${input.id}` }
      }
      return {
        success: true,
        count: 1,
        items: [formatSectionTemplate(sectionTemplate)]
      }
    }

    // Case 2: Get by key
    if (input.key) {
      const sectionTemplate = await ctx.services.sectionService.getSectionTemplateByKey(input.key)
      if (!sectionTemplate) {
        return { success: false, count: 0, items: [], error: `Section template not found: ${input.key}` }
      }
      return {
        success: true,
        count: 1,
        items: [formatSectionTemplate(sectionTemplate)]
      }
    }

    // Case 3: Get all
    if (input.all) {
      const sectionTemplates = await ctx.services.sectionService.listSectionTemplates()
      return {
        success: true,
        count: sectionTemplates.length,
        items: sectionTemplates.map((st: any) => ({
          id: st.id,
          key: st.key,
          name: st.name,
          description: st.description,
          templateFile: st.templateFile
        }))
      }
    }

    return { success: false, count: 0, items: [], error: 'Provide id, key, or set all: true' }
  }
})

// ============================================================================
// getSection - Get section(s) on a page
// ============================================================================

export const getSection = tool({
  description: 'Get section(s) on page. By pageSectionId or pageId.',
  inputSchema: z.object({
    // Scope selection
    pageSectionId: z.string().uuid().optional().describe('Get single section by page-section ID'),
    pageId: z.string().uuid().optional().describe('Get all sections on a page'),

    // Modifiers
    includeContent: z.boolean().optional().default(false).describe('Include full section content'),
    localeCode: z.string().optional().default('en').describe('Locale code for content'),
  }).refine(
    data => data.pageSectionId || data.pageId,
    { message: 'Provide pageSectionId or pageId' }
  ),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Case 1: Get single section by ID
    if (input.pageSectionId) {
      const result = await ctx.services.sectionService.getSectionContent(
        input.pageSectionId,
        input.localeCode || 'en'
      )
      return {
        success: true,
        count: 1,
        items: [result]
      }
    }

    // Case 2: Get all sections on a page
    if (input.pageId) {
      const sections = await ctx.services.sectionService.getPageSections(
        input.pageId,
        input.includeContent || false,
        input.localeCode || 'en'
      )
      return {
        success: true,
        count: sections.length,
        pageId: input.pageId,
        items: sections
      }
    }

    return { success: false, count: 0, items: [], error: 'Provide pageSectionId or pageId' }
  }
})

// ============================================================================
// createSection - Add section to page
// ============================================================================

export const createSection = tool({
  description: 'Add section to page. Returns pageSectionId for updates.',
  inputSchema: z.object({
    pageId: z.string().uuid().describe('Page ID to add section to'),
    templateKey: z.string().describe('Section template key (e.g., "hero", "feature")'),
    content: z.record(z.string(), z.any()).optional().describe('Initial content'),
    sortOrder: z.number().optional().describe('Sort order'),
    status: z.enum(['published', 'unpublished', 'draft']).optional().default('published').describe('Section status'),
    hidden: z.boolean().optional().describe('Hide section from rendering'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext

    // Get section template by key
    const sectionTemplate = await ctx.services.sectionService.getSectionTemplateByKey(input.templateKey)
    if (!sectionTemplate) {
      return {
        success: false,
        error: `Section template "${input.templateKey}" not found. Use getSectionTemplate({ all: true }) to see available templates.`
      }
    }

    // Add section to page
    const pageSection = await ctx.services.sectionService.addSectionToPage({
      pageId: input.pageId,
      sectionTemplateId: sectionTemplate.id,
      sortOrder: input.sortOrder,
      status: input.status || 'published',
      hidden: input.hidden
    })

    // Sync initial content if provided
    if (input.content && Object.keys(input.content).length > 0) {
      await ctx.services.sectionService.syncPageContents({
        pageSectionId: pageSection.id,
        localeCode: 'en',
        content: input.content
      })
    }

    return {
      success: true,
      count: 1,
      items: [{
        pageSectionId: pageSection.id,
        sectionKey: input.templateKey,
        sectionTemplateId: sectionTemplate.id,
        sortOrder: input.sortOrder || 0,
        message: 'Section added. Use getSectionTemplate to see fields, then updateSection to add content.'
      }]
    }
  }
})

// ============================================================================
// updateSection - Update section content or attach image
// ============================================================================

export const updateSection = tool({
  description: 'Update section content or attach image. Merges with existing.',
  inputSchema: z.object({
    pageSectionId: z.string().uuid().describe('Page section ID to update'),
    content: z.record(z.string(), z.any()).optional().describe('Content to merge (only send fields to change)'),
    imageId: z.string().uuid().optional().describe('Image ID to attach'),
    imageField: z.string().optional().describe('Field name for image (e.g., "backgroundImage", "image")'),
    status: z.enum(['published', 'unpublished', 'draft']).optional().describe('Change section status'),
    hidden: z.boolean().optional().describe('Change visibility'),
    sortOrder: z.number().optional().describe('Change sort order'),
    localeCode: z.string().optional().default('en').describe('Locale code'),
  }).refine(
    data => data.content || (data.imageId && data.imageField) || data.status !== undefined || data.hidden !== undefined || data.sortOrder !== undefined,
    { message: 'Provide content, imageId+imageField, status, hidden, or sortOrder' }
  ),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const { pageSections, pageSectionContents, images, sectionTemplates } = await import('../../db/schema')
    const { and } = await import('drizzle-orm')

    // Get section to validate
    const section = await ctx.db.query.pageSections.findFirst({
      where: eq(pageSections.id, input.pageSectionId),
    })

    if (!section) {
      return { success: false, error: 'Section not found' }
    }

    // Handle status/hidden/sortOrder updates
    if (input.status !== undefined || input.hidden !== undefined || input.sortOrder !== undefined) {
      const updates: any = {}
      if (input.status !== undefined) updates.status = input.status
      if (input.hidden !== undefined) updates.hidden = input.hidden
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder

      await ctx.db
        .update(pageSections)
        .set(updates)
        .where(eq(pageSections.id, input.pageSectionId))
    }

    // Handle image attachment
    if (input.imageId && input.imageField) {
      // Validate imageField exists in section template
      const sectionTemplate = await ctx.db.query.sectionTemplates.findFirst({
        where: eq(sectionTemplates.id, section.sectionTemplateId),
      })

      if (sectionTemplate) {
        const fields = typeof sectionTemplate.fields === 'string'
          ? JSON.parse(sectionTemplate.fields)
          : sectionTemplate.fields

        const imageFields: string[] = []
        if (fields?.rows) {
          for (const row of fields.rows) {
            if (row.slots) {
              for (const slot of row.slots) {
                if (slot.type === 'image') {
                  imageFields.push(slot.key)
                }
              }
            }
          }
        }

        if (imageFields.length > 0 && !imageFields.includes(input.imageField)) {
          return {
            success: false,
            error: `Field "${input.imageField}" not found. Available image fields: ${imageFields.join(', ')}`,
            availableImageFields: imageFields
          }
        }
      }

      // Get image details
      const image = await ctx.db.query.images.findFirst({
        where: eq(images.id, input.imageId),
        with: { metadata: true }
      })

      if (!image || !image.filePath) {
        return { success: false, error: 'Image not found or has no file path' }
      }

      // Merge image into content
      const imageUrl = `/uploads/${image.filePath}`
      const altText = image.metadata?.description || image.originalFilename

      const contentUpdate = {
        ...(input.content || {}),
        [input.imageField]: { url: imageUrl, alt: altText }
      }

      await ctx.services.sectionService.syncPageContents({
        pageSectionId: input.pageSectionId,
        localeCode: input.localeCode || 'en',
        content: contentUpdate
      })

      return {
        success: true,
        message: `Updated section with image: ${image.originalFilename}`,
        imageUrl,
        altText
      }
    }

    // Handle content-only update
    if (input.content) {
      await ctx.services.sectionService.syncPageContents({
        pageSectionId: input.pageSectionId,
        localeCode: input.localeCode || 'en',
        content: input.content
      })
    }

    return {
      success: true,
      message: 'Section updated'
    }
  }
})

// ============================================================================
// deleteSection - Delete section(s) from page
// ============================================================================

export const deleteSection = tool({
  description: 'Delete section(s). Array param. Requires confirmed.',
  inputSchema: z.object({
    ids: z.array(z.string().uuid()).describe('Page section IDs to delete (always array, even for single)'),
    confirmed: z.boolean().optional().describe('Must be true to actually delete'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const { pageSections } = await import('../../db/schema')

    // Validate all sections exist
    const sections = await ctx.db.query.pageSections.findMany({
      where: inArray(pageSections.id, input.ids)
    })

    if (sections.length === 0) {
      return { success: false, error: 'No sections found with provided IDs' }
    }

    if (sections.length !== input.ids.length) {
      return { success: false, error: `Found ${sections.length} of ${input.ids.length} sections` }
    }

    // Require confirmation
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete ${sections.length} section(s)? This cannot be undone. Set confirmed: true to proceed.`,
        count: sections.length
      }
    }

    // Delete all sections
    for (const sectionId of input.ids) {
      await ctx.db.delete(pageSections).where(eq(pageSections.id, sectionId))
    }

    return {
      success: true,
      message: `Deleted ${input.ids.length} section(s)`,
      deletedCount: input.ids.length
    }
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

function formatSectionTemplate(sectionTemplate: any) {
  // Parse fields to extract field info
  const fieldsData = typeof sectionTemplate.fields === 'string'
    ? JSON.parse(sectionTemplate.fields)
    : sectionTemplate.fields

  const fields: { key: string; type: string; label?: string }[] = []
  if (fieldsData?.rows) {
    for (const row of fieldsData.rows) {
      if (row.slots) {
        for (const slot of row.slots) {
          fields.push({
            key: slot.key,
            type: slot.type,
            label: slot.label
          })
        }
      }
    }
  }

  return {
    id: sectionTemplate.id,
    key: sectionTemplate.key,
    name: sectionTemplate.name,
    description: sectionTemplate.description,
    templateFile: sectionTemplate.templateFile,
    fields
  }
}
