import { z } from 'zod'
import { createCMSTool } from '../../registry'

// Find resource (vector search)
export const findResourceTool = createCMSTool({
  id: 'cms.findResource',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'search', 'vector'],
  description:
    'Fuzzy semantic search for CMS resources (pages, sections, collections, entries). Returns top matches with similarity scores. Handles typos and natural language queries.',
  inputSchema: z.object({
    query: z.string().min(1).describe('Natural language search query (e.g., "home page")'),
    type: z
      .enum(['page', 'section_def', 'collection', 'entry'])
      .optional()
      .describe('Filter by resource type'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(3)
      .describe('Number of results to return (default: 3)')
  }),
  execute: async (input, context) => {
    const { vectorIndex, logger, traceId } = context

    logger.info({ traceId, tool: 'cms.findResource', input })

    // Vector search
    const results = await vectorIndex.search(input.query, input.type, input.limit)

    logger.info({
      traceId,
      tool: 'cms.findResource',
      result: 'success',
      count: results.length
    })

    return {
      query: input.query,
      count: results.length,
      results: results.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        slug: r.slug,
        similarity: r.similarity
      }))
    }
  }
})

// Preview page (returns preview URL)
export const previewPageTool = createCMSTool({
  id: 'cms.previewPage',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'page', 'preview'],
  description:
    'Get preview URL for a page. Opens in separate browser tab showing rendered website.',
  inputSchema: z.object({
    slug: z.string().describe('Page slug'),
    locale: z.string().optional().default('en').describe('Locale code')
  }),
  execute: async (input, context) => {
    const previewPort = process.env.PREVIEW_PORT || '4000'
    const previewUrl = `http://localhost:${previewPort}/pages/${input.slug}?locale=${input.locale}`

    return {
      slug: input.slug,
      locale: input.locale,
      previewUrl,
      message: `Preview available at: ${previewUrl}`
    }
  }
})
