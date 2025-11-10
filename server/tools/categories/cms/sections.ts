// @ts-nocheck - Drizzle ORM query method type inference issues
import { z } from 'zod'
import { createCMSTool } from '../../registry'

// List section definitions
export const listSectionsTool = createCMSTool({
  id: 'cms.listSections',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'section', 'list'],
  description: 'List all section definitions. Returns available section types with their schemas.',
  inputSchema: z.object({}),
  execute: async (input, context) => {
    const { services } = context

    const sections = await services.sectionService.listSectionDefs()

    return {
      count: sections.length,
      sections: sections.map((s: any) => ({
        id: s.id,
        key: s.key,
        name: s.name,
        description: s.description,
        status: s.status,
        templateKey: s.templateKey,
        defaultVariant: s.defaultVariant,
        elementsStructure: s.elementsStructure
      }))
    }
  }
})

// Get section definition
export const getSectionTool = createCMSTool({
  id: 'cms.getSection',
  category: 'cms',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect', 'cms-crud', 'debug', 'ask'],
  tags: ['read', 'section'],
  description: 'Get section definition by ID or key. Returns full schema and template info.',
  inputSchema: z.object({
    id: z.string().optional().describe('Section definition ID (UUID)'),
    key: z.string().optional().describe('Section key (e.g., "hero")')
  }),
  execute: async (input, context) => {
    const { services } = context

    if (!input.id && !input.key) {
      throw new Error('Either id or key must be provided')
    }

    let section
    if (input.id) {
      section = await services.sectionService.getSectionDefById(input.id)
    } else {
      section = await services.sectionService.getSectionDefByKey(input.key!)
    }

    if (!section) {
      throw new Error(`Section definition not found: ${input.id || input.key}`)
    }

    return {
      id: section.id,
      key: section.key,
      name: section.name,
      description: section.description,
      status: section.status,
      templateKey: section.templateKey,
      defaultVariant: section.defaultVariant,
      elementsStructure: section.elementsStructure,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt
    }
  }
})

// Create section definition
export const createSectionTool = createCMSTool({
  id: 'cms.createSection',
  category: 'cms',
  riskLevel: 'moderate',
  requiresApproval: false,
  allowedModes: ['cms-crud'],
  tags: ['write', 'section', 'create'],
  description:
    'Create a new section definition. Key must be unique. Elements structure defines content schema.',
  inputSchema: z.object({
    key: z
      .string()
      .regex(/^[a-z0-9-]{2,64}$/)
      .describe('Unique section key (e.g., "hero")'),
    name: z.string().min(1).max(100).describe('Section name (e.g., "Hero Section")'),
    description: z.string().optional().describe('Section description'),
    elementsStructure: z.record(z.any()).describe('Elements structure JSON'),
    templateKey: z.string().default('default').describe('Template key (e.g., "hero")'),
    defaultVariant: z.string().default('default').describe('Default variant (e.g., "centered")')
  }),
  execute: async (input, context) => {
    const { services, logger, traceId } = context

    logger.info({ traceId, tool: 'cms.createSection', input })

    const section = await services.sectionService.createSectionDef({
      key: input.key,
      name: input.name,
      description: input.description,
      elementsStructure: input.elementsStructure,
      templateKey: input.templateKey,
      defaultVariant: input.defaultVariant
    })

    // Validation
    // @ts-ignore - Drizzle ORM type inference issue
    const exists = await services.sectionService.getSectionDefById(section.id)
    if (!exists) {
      throw new Error('Validation failed: Section definition not found after creation')
    }

    logger.info({ traceId, tool: 'cms.createSection', result: 'success', sectionId: section.id })

    return {
      id: section.id,
      key: section.key,
      name: section.name,
      message: `Section definition "${section.name}" created successfully`
    }
  }
})
