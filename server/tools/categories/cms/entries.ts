// @ts-nocheck - Drizzle ORM query method type inference issues
import { z } from 'zod'
import { createCMSTool } from '../../registry'

// List collection entries
export const listEntriesTool = createCMSTool({
  id: 'cms.listEntries',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'entry', 'collection', 'list'],
  description: 'List entries in a collection with optional search query.',
  inputSchema: z.object({
    collectionId: z.string().optional().describe('Collection ID (UUID)'),
    collectionSlug: z.string().optional().describe('Collection slug (e.g., "blog")'),
    query: z.string().optional().describe('Optional search query'),
    locale: z.string().optional().default('en').describe('Locale code')
  }),
  execute: async (input, context) => {
    const { services } = context

    if (!input.collectionId && !input.collectionSlug) {
      throw new Error('Either collectionId or collectionSlug must be provided')
    }

    // Get collection first
    let collection
    if (input.collectionId) {
      collection = await services.entryService.getCollectionDefById(input.collectionId)
    } else {
      collection = await services.entryService.getCollectionDefBySlug(input.collectionSlug!)
    }

    if (!collection) {
      throw new Error(`Collection not found: ${input.collectionId || input.collectionSlug}`)
    }

    const entries = await services.entryService.listEntries(collection.id, input.query)

    return {
      collectionId: collection.id,
      collectionSlug: collection.slug,
      collectionName: collection.name,
      count: entries.length,
      entries: entries.map((e: any) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt
      }))
    }
  }
})

// Get collection entry
export const getEntryTool = createCMSTool({
  id: 'cms.getEntry',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'entry', 'collection'],
  description: 'Get entry by ID with localized content.',
  inputSchema: z.object({
    id: z.string().describe('Entry ID (UUID)'),
    locale: z.string().optional().default('en').describe('Locale code')
  }),
  execute: async (input, context) => {
    const { services } = context

    const entry = await services.entryService.getEntryById(input.id)

    if (!entry) {
      throw new Error(`Entry not found: ${input.id}`)
    }

    // Get localized content
    const content = entry.entryContents?.find((c: any) => c.localeCode === input.locale)

    return {
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      collectionId: entry.collectionId,
      content: content?.content,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }
  }
})

// Upsert entry (create or update)
export const upsertEntryTool = createCMSTool({
  id: 'cms.upsertEntry',
  category: 'cms',
  riskLevel: 'moderate',
  requiresApproval: false,
  allowedModes: ['cms-crud'],
  tags: ['write', 'entry', 'collection'],
  description:
    'Create or update a collection entry. If entry with slug exists, updates it; otherwise creates new.',
  inputSchema: z.object({
    collectionId: z.string().optional().describe('Collection ID (UUID)'),
    collectionSlug: z.string().optional().describe('Collection slug (e.g., "blog")'),
    slug: z
      .string()
      .regex(/^[a-z0-9-]{2,64}$/)
      .describe('Entry slug'),
    title: z.string().min(1).max(200).describe('Entry title'),
    locale: z.string().default('en').describe('Locale code'),
    content: z.record(z.any()).describe('Content object matching collection schema')
  }),
  execute: async (input, context) => {
    const { services, logger, traceId } = context

    logger.info({ traceId, tool: 'cms.upsertEntry', input })

    if (!input.collectionId && !input.collectionSlug) {
      throw new Error('Either collectionId or collectionSlug must be provided')
    }

    // Get collection
    let collection
    if (input.collectionId) {
      collection = await services.entryService.getCollectionDefById(input.collectionId)
    } else {
      collection = await services.entryService.getCollectionDefBySlug(input.collectionSlug!)
    }

    if (!collection) {
      throw new Error(`Collection not found: ${input.collectionId || input.collectionSlug}`)
    }

    // Upsert entry
    const entry = await services.entryService.upsertEntry({
      collectionId: collection.id,
      slug: input.slug,
      title: input.title,
      locale: input.locale,
      content: input.content
    })

    // Validation
    // @ts-ignore - Drizzle ORM type inference issue
    const exists = await services.entryService.getEntryById(entry.id)
    if (!exists) {
      throw new Error('Validation failed: Entry not found after upsert')
    }

    logger.info({ traceId, tool: 'cms.upsertEntry', result: 'success', entryId: entry.id })

    return {
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      collectionId: collection.id,
      message: `Entry "${entry.title}" saved successfully`
    }
  }
})

// List collections
export const listCollectionsTool = createCMSTool({
  id: 'cms.listCollections',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'collection', 'list'],
  description: 'List all collection definitions. Returns available collections with their schemas.',
  inputSchema: z.object({}),
  execute: async (input, context) => {
    const { services } = context

    const collections = await services.entryService.listCollectionDefs()

    return {
      count: collections.length,
      collections: collections.map((c: any) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        status: c.status,
        elementsStructure: c.elementsStructure
      }))
    }
  }
})
