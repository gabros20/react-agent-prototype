/**
 * Agent Routes - Pure ReAct Pattern
 * 
 * Simplified routes:
 * - Single agent handles all tasks
 * - Retry logic with exponential backoff
 * - Error recovery at multiple levels
 */

import express from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { executeAgentWithRetry, streamAgentWithApproval } from '../agent/orchestrator'
import type { ServiceContainer } from '../services/service-container'
import type { AgentContext } from '../tools/types'
import type { CoreMessage } from 'ai'
import { approvalQueue } from '../services/approval-queue'
import { ApiResponse, ErrorCodes, HttpStatus } from '../types/api-response'

// Request schema
const agentRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  prompt: z.string().min(1),
  toolsEnabled: z.array(z.string()).optional(), // Optional: for future use
  cmsTarget: z
    .object({
      siteId: z.string().optional(),
      environmentId: z.string().optional()
    })
    .optional()
})

export function createAgentRoutes(services: ServiceContainer) {
  const router = express.Router()

  // POST /v1/agent/stream - Streaming agent
  router.post('/stream', async (req, res) => {
    try {
      const input = agentRequestSchema.parse(req.body)

      // Generate trace ID
      const traceId = randomUUID()
      const sessionId = input.sessionId || randomUUID()

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
      const context: AgentContext = {
        db: services.db,
        vectorIndex: services.vectorIndex,
        logger,
        stream: {
          write: (event: any) => {
            // Send different SSE event types based on event type
            const eventType = event.type || 'step'
            writeSSE(eventType, event)
          }
        },
        traceId,
        sessionId,
        services,
        sessionService: services.sessionService,
        cmsTarget: input.cmsTarget ? {
          siteId: input.cmsTarget.siteId || 'default-site',
          environmentId: input.cmsTarget.environmentId || 'main'
        } : {
          siteId: 'default-site',
          environmentId: 'main'
        }
      }

      logger.info('Starting agent execution', {
        traceId,
        sessionId,
        prompt: input.prompt.slice(0, 100)
      })

      try {
        // Load previous messages from session
        let previousMessages: CoreMessage[] = []
        if (input.sessionId) {
          try {
            previousMessages = await services.sessionService.loadMessages(input.sessionId)
            
            logger.info('Loaded session history', {
              sessionId: input.sessionId,
              messageCount: previousMessages.length
            })
          } catch (error) {
            logger.warn('Could not load session history', {
              sessionId: input.sessionId,
              error: (error as Error).message
            })
          }
        }

        // Execute agent with streaming + approval + retry
        const result = await streamAgentWithApproval(
          input.prompt,
          context,
          previousMessages,
          // Approval handler callback
          async (request) => {
            logger.info('Approval request received', {
              approvalId: request.approvalId,
              toolName: request.toolName
            })
            
            // Wait for user response via approval queue
            const response = await approvalQueue.requestApproval({
              approvalId: request.approvalId,
              toolName: request.toolName,
              input: request.input,
              description: `Approve execution of ${request.toolName}?`,
              timestamp: new Date()
            })
            
            logger.info('Approval response received', {
              approvalId: request.approvalId,
              approved: response.approved,
              reason: response.reason
            })
            
            return response
          }
        )

        logger.info('Agent execution completed', {
          traceId,
          stepsCount: result.steps?.length || 0,
          finishReason: result.finishReason,
          retries: result.retries
        })

        // Save conversation to session
        if (sessionId) {
          try {
            // Combine previous messages + new result messages
            const updatedMessages: CoreMessage[] = [
              ...previousMessages,
              { role: 'user', content: input.prompt },
              ...result.response.messages
            ]

            await services.sessionService.saveMessages(sessionId, updatedMessages)

            logger.info('Saved messages to session', {
              sessionId,
              totalMessages: updatedMessages.length
            })
          } catch (error) {
            logger.error('Failed to save messages to session', {
              sessionId,
              error: (error as Error).message
            })
          }
        }

        // Send final result
        writeSSE('result', {
          traceId,
          sessionId,
          text: result.text,
          toolCalls: result.toolCalls,
          toolResults: result.toolResults,
          steps: result.steps,
          finishReason: result.finishReason,
          usage: result.usage,
          retries: result.retries
        })

        // Close connection
        writeSSE('done', { traceId, sessionId })
        res.end()

      } catch (error) {
        logger.error('Agent execution error', {
          traceId,
          error: (error as Error).message,
          stack: (error as Error).stack
        })

        writeSSE('error', {
          traceId,
          error: (error as Error).message
        })

        res.end()
      }
    } catch (error) {
      console.error('Route error:', error)
      res.status(HttpStatus.BAD_REQUEST).json(
        ApiResponse.error(
          ErrorCodes.VALIDATION_ERROR,
          error instanceof Error ? error.message : 'Unknown error'
        )
      )
    }
  })

  // POST /v1/agent/generate - Non-streaming agent
  router.post('/generate', async (req, res) => {
    try {
      const input = agentRequestSchema.parse(req.body)

      const traceId = randomUUID()
      const sessionId = input.sessionId || randomUUID()

      // Simple console logger for non-streaming
      const logger = {
        info: (msg: string | object, meta?: any) => {
          console.log('[INFO]', typeof msg === 'string' ? msg : JSON.stringify(msg), meta)
        },
        warn: (msg: string | object, meta?: any) => {
          console.warn('[WARN]', typeof msg === 'string' ? msg : JSON.stringify(msg), meta)
        },
        error: (msg: string | object, meta?: any) => {
          console.error('[ERROR]', typeof msg === 'string' ? msg : JSON.stringify(msg), meta)
        }
      }

      // Create agent context
      const context: AgentContext = {
        db: services.db,
        vectorIndex: services.vectorIndex,
        logger,
        traceId,
        sessionId,
        services,
        sessionService: services.sessionService,
        cmsTarget: input.cmsTarget ? {
          siteId: input.cmsTarget.siteId || 'default-site',
          environmentId: input.cmsTarget.environmentId || 'main'
        } : {
          siteId: 'default-site',
          environmentId: 'main'
        }
      }

      logger.info('Starting agent execution (non-streaming)', {
        traceId,
        sessionId,
        prompt: input.prompt.slice(0, 100)
      })

      // Load previous messages
      let previousMessages: CoreMessage[] = []
      if (input.sessionId) {
        try {
          previousMessages = await services.sessionService.loadMessages(input.sessionId)
        } catch (error) {
          logger.warn('Could not load session history', {
            sessionId: input.sessionId,
            error: (error as Error).message
          })
        }
      }

      // Execute with retry logic
      const result = await executeAgentWithRetry(
        input.prompt,
        context,
        previousMessages
      )

      logger.info('Agent execution completed', {
        traceId,
        stepsCount: result.steps?.length || 0,
        retries: result.retries
      })

      // Save to session
      if (sessionId) {
        try {
          const updatedMessages: CoreMessage[] = [
            ...previousMessages,
            { role: 'user', content: input.prompt },
            ...result.response.messages
          ]

          await services.sessionService.saveMessages(sessionId, updatedMessages)
        } catch (error) {
          logger.error('Failed to save messages', {
            error: (error as Error).message
          })
        }
      }

      // Return result
      res.json(
        ApiResponse.success({
          traceId,
          sessionId,
          text: result.text,
          steps: result.steps,
          usage: result.usage,
          retries: result.retries
        })
      )

    } catch (error) {
      console.error('Route error:', error)
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
        ApiResponse.error(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Unknown error'
        )
      )
    }
  })

  // POST /v1/agent/approval/:approvalId - Submit approval response
  router.post('/approval/:approvalId', async (req, res) => {
    try {
      const { approvalId } = req.params
      const { approved, reason } = z.object({
        approved: z.boolean(),
        reason: z.string().optional()
      }).parse(req.body)

      console.log(`[Approval Route] Received approval response:`, {
        approvalId,
        approved,
        reason,
        queueStats: approvalQueue.getStats()
      })

      // Submit response to approval queue
      const response = await approvalQueue.respondToApproval(approvalId, approved, reason)

      console.log(`[Approval Route] Successfully processed approval:`, {
        approvalId,
        approved: response.approved
      })

      res.json(
        ApiResponse.success({
          approvalId,
          response
        })
      )
    } catch (error) {
      console.error('[Approval Route] Error processing approval:', {
        approvalId: req.params.approvalId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      res.status(HttpStatus.BAD_REQUEST).json(
        ApiResponse.error(
          ErrorCodes.VALIDATION_ERROR,
          error instanceof Error ? error.message : 'Unknown error',
          { approvalId: req.params.approvalId }
        )
      )
    }
  })

  return router
}
