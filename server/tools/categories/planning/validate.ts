// @ts-nocheck - Drizzle ORM query method type inference issues
import { z } from 'zod'
import { createCMSTool } from '../../registry'

// Validate plan (preflight checks)
export const validatePlanTool = createCMSTool({
  id: 'cms.validatePlan',
  category: 'planning',
  riskLevel: 'safe',
  requiresApproval: false,
  allowedModes: ['architect'],
  tags: ['planning', 'validation'],
  description:
    'Validate a plan of operations before execution. Checks resource existence, constraints, schema compatibility. Returns issues and suggestions.',
  inputSchema: z.object({
    operations: z
      .array(
        z.object({
          toolName: z.string().describe('Tool name (e.g., "cms.createPage")'),
          input: z.record(z.any()).describe('Tool input parameters')
        })
      )
      .describe('Array of planned tool calls')
  }),
  execute: async (input, context) => {
    const { services, logger, traceId } = context

    logger.info({ traceId, tool: 'cms.validatePlan', operationCount: input.operations.length })

    const issues: string[] = []
    const suggestions: string[] = []

    // Validate each operation
    for (const op of input.operations) {
      try {
        // Check tool exists
        if (!op.toolName.startsWith('cms.') && !op.toolName.startsWith('http.')) {
          issues.push(`Unknown tool: ${op.toolName}`)
          continue
        }

        // Validate based on tool type
        switch (op.toolName) {
          case 'cms.createPage':
            // Check slug uniqueness
            // @ts-ignore - Drizzle ORM type inference issue
            const existingPage = await services.pageService.getPageBySlug(op.input.slug)
            if (existingPage) {
              issues.push(`Page slug already exists: ${op.input.slug}`)
              suggestions.push(`Use a different slug or update existing page with ID: ${existingPage.id}`)
            }
            break

          case 'cms.addSectionToPage':
            // Check page exists
            const page = await services.pageService.getPageById(op.input.pageId)
            if (!page) {
              issues.push(`Page not found: ${op.input.pageId}`)
              suggestions.push('Create the page first before adding sections')
            }

            // Check section definition exists
            const sectionDef = await services.sectionService.getSectionDefById(
              op.input.sectionDefId
            )
            if (!sectionDef) {
              issues.push(`Section definition not found: ${op.input.sectionDefId}`)
              suggestions.push('Create the section definition first or use existing one')
            }
            break

          case 'cms.syncPageContents':
            // Validate content matches schema (basic check)
            if (!op.input.content || typeof op.input.content !== 'object') {
              issues.push('Content must be a valid object')
            }
            break

          case 'cms.upsertEntry':
            // Check collection exists
            if (op.input.collectionId) {
              const collection = await services.entryService.getCollectionDefById(
                op.input.collectionId
              )
              if (!collection) {
                issues.push(`Collection not found: ${op.input.collectionId}`)
              }
            } else if (op.input.collectionSlug) {
              const collection = await services.entryService.getCollectionDefBySlug(
                op.input.collectionSlug
              )
              if (!collection) {
                issues.push(`Collection not found: ${op.input.collectionSlug}`)
                suggestions.push('Create the collection first')
              }
            }
            break
        }
      } catch (error) {
        issues.push(`Validation error for ${op.toolName}: ${(error as Error).message}`)
      }
    }

    const valid = issues.length === 0

    logger.info({
      traceId,
      tool: 'cms.validatePlan',
      result: valid ? 'valid' : 'invalid',
      issueCount: issues.length
    })

    return {
      valid,
      issues,
      suggestions,
      message: valid
        ? 'Plan is valid and can be executed'
        : `Found ${issues.length} issue(s) that need to be addressed`
    }
  }
})
