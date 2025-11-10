import express from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { createAgent } from '../agent/orchestrator'
import type { ServiceContainer } from '../services/service-container'
import type { AgentMode } from '../tools/types'

// Request schema
const agentRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  prompt: z.string().min(1),
  mode: z.enum(['architect', 'cms-crud', 'debug', 'ask']).optional().default('cms-crud'),
  toolsEnabled: z.array(z.string()).optional(),
  cmsTarget: z
    .object({
      siteId: z.string().optional(),
      environmentId: z.string().optional()
    })
    .optional()
})

export function createAgentRoutes(services: ServiceContainer) {
  const router = express.Router()

  // POST /v1/agent/stream - Streaming agent execution
  router.post('/stream', async (req, res) => {
    try {
      const input = agentRequestSchema.parse(req.body)

      // Generate trace ID
      const traceId = randomUUID()

      // Setup SSE headers
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      // SSE helper
      const writeSSE = (event: string, data: any) => {
        res.write(`event: ${event}\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      // Create logger that writes to SSE
      const logger = {
        info: (msg: string | object, meta?: any) => {
          const message = typeof msg === 'string' ? msg : JSON.stringify(msg)
          console.log('[INFO]', message, meta)
          writeSSE('log', {
            type: 'log',
            traceId,
            level: 'info',
            message,
            metadata: meta,
            timestamp: new Date().toISOString()
          })
        },
        warn: (msg: string | object, meta?: any) => {
          const message = typeof msg === 'string' ? msg : JSON.stringify(msg)
          console.warn('[WARN]', message, meta)
          writeSSE('log', {
            type: 'log',
            traceId,
            level: 'warn',
            message,
            metadata: meta,
            timestamp: new Date().toISOString()
          })
        },
        error: (msg: string | object, meta?: any) => {
          const message = typeof msg === 'string' ? msg : JSON.stringify(msg)
          console.error('[ERROR]', message, meta)
          writeSSE('log', {
            type: 'log',
            traceId,
            level: 'error',
            message,
            metadata: meta,
            timestamp: new Date().toISOString()
          })
        }
      }

      // Create agent context
      const context = {
        db: services.db,
        vectorIndex: services.vectorIndex,
        logger,
        stream: {
          write: (event: any) => {
            writeSSE('step', event)
          }
        },
        traceId,
        sessionId: input.sessionId || randomUUID(),
        currentMode: input.mode as AgentMode,
        services
      }

      logger.info('Starting agent execution', {
        traceId,
        mode: input.mode,
        prompt: input.prompt.slice(0, 100)
      })

      try {
        // Create agent
        const agent = createAgent(input.mode as AgentMode, context)

        // Execute agent
        const result = await agent.generate({
          prompt: input.prompt
        })

        logger.info('Agent execution completed', {
          traceId,
          stepsCount: result.steps?.length || 0
        })

        // Send final result
        writeSSE('result', {
          traceId,
          text: result.text,
          toolCalls: result.toolCalls,
          toolResults: result.toolResults,
          steps: result.steps
        })

        // Close connection
        writeSSE('done', { traceId })
        res.end()
      } catch (agentError) {
        logger.error('Agent execution failed', {
          traceId,
          error: (agentError as Error).message
        })

        writeSSE('error', {
          traceId,
          error: (agentError as Error).message
        })

        res.end()
      }
    } catch (error) {
      console.error('Agent stream error:', error)

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.issues
          },
          statusCode: 400
        })
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: (error as Error).message
          },
          statusCode: 500
        })
      }
    }
  })

  // POST /v1/agent/approve - HITL approval
  router.post('/approve', async (req, res) => {
    try {
      const { sessionId, traceId, stepId, decision, message } = req.body

      // TODO: Implement HITL approval logic in Sprint 10
      // For now, just acknowledge

      res.json({
        data: {
          sessionId,
          traceId,
          stepId,
          decision,
          message: 'Approval processed (placeholder)'
        },
        statusCode: 200
      })
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: (error as Error).message
        },
        statusCode: 500
      })
    }
  })

  return router
}
