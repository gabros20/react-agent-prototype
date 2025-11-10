import { ToolLoopAgent, tool, stepCountIs, type CoreMessage } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { registry } from '../tools'
import type { AgentContext, AgentMode } from '../tools/types'
import { getSystemPrompt, type CompositionContext } from '../prompts/utils/composer'
import { HierarchicalMemoryManager } from '../services/agent/memory-manager'
import { CheckpointManager } from '../services/agent/checkpoint-manager'
import { ErrorRecoveryManager } from '../services/agent/error-recovery'

// Mode configurations (max steps only, instructions from prompt files)
const MODE_CONFIG: Record<AgentMode, { maxSteps: number }> = {
  architect: { maxSteps: 6 },
  'cms-crud': { maxSteps: 10 },
  debug: { maxSteps: 4 },
  ask: { maxSteps: 6 }
}

/**
 * Compose system prompt for agent mode using modular prompt system
 */
function composeAgentPrompt(mode: AgentMode, context: AgentContext): string {
  // Get tools available in this mode
  const toolsMap = registry.getToolsForMode(mode)
  const toolNames = Object.keys(toolsMap)

  // Build composition context
  const compositionContext: CompositionContext = {
    mode,
    maxSteps: MODE_CONFIG[mode].maxSteps,
    toolsList: toolNames,
    toolCount: toolNames.length,
    currentDate: new Date().toISOString().split('T')[0],
    sessionId: context.sessionId,
    traceId: context.traceId
  }

  // Compose and return
  const systemPrompt = getSystemPrompt(compositionContext)

  // Log prompt size for monitoring
  const promptTokens = estimateTokens(systemPrompt)
  context.logger.info('System prompt composed', {
    mode,
    promptTokens,
    promptLength: systemPrompt.length,
    toolCount: toolNames.length,
    traceId: context.traceId
  })

  return systemPrompt
}

/**
 * Estimate token count (rough heuristic: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Create agent for specific mode with intelligence layer
export function createAgent(mode: AgentMode, context: AgentContext) {
  const config = MODE_CONFIG[mode]

  // Initialize intelligence layer services
  const memoryManager = new HierarchicalMemoryManager({
    logger: context.logger,
    traceId: context.traceId
  })

  const checkpointManager = new CheckpointManager(context.db, {
    logger: context.logger
  })

  const errorRecovery = new ErrorRecoveryManager({
    logger: context.logger,
    traceId: context.traceId
  })

  // Compose system prompt from modular prompt files
  const systemPrompt = composeAgentPrompt(mode, context)

  // Get tools allowed for this mode
  const toolsMap = registry.getToolsForMode(mode)

  // Tool execution state
  let stepNumber = 0
  let currentPhase: 'planning' | 'executing' | 'verifying' | 'reflecting' = 'planning'
  let completedSubgoals: string[] = []
  let currentSubgoal: string | null = null

  // Convert tools to AI SDK v6 format with enhanced error handling
  const tools: Record<string, any> = {}
  for (const [name, toolDef] of Object.entries(toolsMap)) {
    if (!toolDef.execute) {
      // Tool without execute (for HITL approval tools in future)
      tools[name] = tool({
        description: toolDef.description,
        inputSchema: toolDef.parameters // v6 uses inputSchema not parameters
      })
    } else {
      tools[name] = tool({
        description: toolDef.description,
        inputSchema: toolDef.parameters, // v6 uses inputSchema not parameters
        execute: async (input: any) => {
          // Check circuit breaker
          if (errorRecovery.isCircuitOpen(name)) {
            throw new Error(
              `Circuit breaker open for ${name} - tool temporarily unavailable. Wait 30s before retry.`
            )
          }

          try {
            // Execute with context
            const result = await toolDef.execute!(input, context)

            // Record success (reset circuit breaker)
            errorRecovery.recordSuccess(name)

            return result
          } catch (error: any) {
            // Record failure (update circuit breaker)
            errorRecovery.recordFailure(name, error)

            // Generate agent-friendly error observation
            const errorObs = errorRecovery.generateErrorObservation({
              toolName: name,
              error,
              attemptNumber: 0 // Will be tracked in future
            })

            // Log error with recovery info
            context.logger.error('Tool execution failed', {
              toolName: name,
              error: error.message,
              traceId: context.traceId,
              circuitStatus: errorRecovery.getCircuitStatus().find(c => c.toolName === name)
            })

            // Re-throw with enhanced error message
            throw new Error(errorObs)
          }
        }
      })
    }
  }

  // Get OpenRouter provider
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!,
    headers: process.env.OPENROUTER_HEADERS ? JSON.parse(process.env.OPENROUTER_HEADERS) : {}
  })

  const modelId = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free'

  // Create ToolLoopAgent with v6 API and intelligence layer integration
  const agent = new ToolLoopAgent({
    model: openrouter.languageModel(modelId),
    instructions: systemPrompt, // Use composed prompt
    tools,
    stopWhen: stepCountIs(config.maxSteps),
    prepareStep: async ({ stepNumber: step, steps }) => {
      stepNumber = step

      // Add previous step to memory
      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1]
        
        // Create message from last step
        const message: CoreMessage = {
          role: 'assistant',
          content: lastStep.text || ''
        }

        await memoryManager.addMessage(message)

        // Add tool results to memory
        if (lastStep.toolResults) {
          await memoryManager.addMessage({
            role: 'assistant',
            content: `Tool results: ${JSON.stringify(lastStep.toolResults)}`
          })
        }
      }

      // Log memory stats
      const memoryTokens = memoryManager.estimateTokens()
      context.logger.info(`Step ${stepNumber}: Context size = ${memoryTokens} tokens`, {
        traceId: context.traceId,
        stepNumber,
        phase: currentPhase
      })

      return {
        activeTools: Object.keys(toolsMap)
      }
    },
    onStepFinish: async ({ text, toolCalls, toolResults, finishReason, usage }) => {
      stepNumber++

      // Log step
      context.logger.info({
        traceId: context.traceId,
        stepNumber,
        phase: currentPhase,
        toolCalls: toolCalls?.map((tc: any) => ({ name: tc.toolName, input: tc.args })),
        toolResults: toolResults?.map((tr: any) => ({
          success: !tr.error,
          output: tr.result || tr.error
        })),
        finishReason,
        usage
      })

      // Emit to frontend debug log if stream available
      if (context.stream) {
        context.stream.write({
          type: 'step-complete',
          traceId: context.traceId,
          stepNumber,
          phase: currentPhase,
          toolCalls: toolCalls?.map((tc: any) => ({
            toolName: tc.toolName,
            input: tc.args
          })),
          toolResults: toolResults?.map((tr: any) => ({
            success: !tr.error,
            output: tr.result || tr.error
          })),
          memoryTokens: memoryManager.estimateTokens()
        })
      }

      // Detect phase transitions from assistant text
      const previousPhase = currentPhase
      if (text) {
        if (text.includes('Planning:') || text.includes('Architect Mode')) {
          currentPhase = 'planning'
        } else if (text.includes('Executing:') || text.includes('CMS CRUD')) {
          currentPhase = 'executing'
        } else if (text.includes('Verifying:') || text.includes('Validation')) {
          currentPhase = 'verifying'
        } else if (text.includes('Reflecting:') || text.includes('Review')) {
          currentPhase = 'reflecting'
        }

        // Extract current subgoal
        const subgoalMatch = text.match(/(?:Subgoal|Task):\s*(.+?)(?:\n|$)/i)
        if (subgoalMatch) {
          currentSubgoal = subgoalMatch[1].trim()
        }

        // Detect completed subgoals
        if (text.includes('✅ Done:') || text.includes('Completed:')) {
          const doneMatch = text.match(/(?:✅\s*Done|Completed):\s*(.+?)(?:\n|$)/i)
          if (doneMatch) {
            completedSubgoals.push(doneMatch[1].trim())
          }
        }
      }

      // Determine if checkpoint should be created
      const shouldCheckpoint = checkpointManager.shouldCheckpoint({
        stepNumber,
        phase: currentPhase,
        previousPhase,
        isBeforeApproval: false, // TODO: Detect from tool calls
        isAfterError: toolResults?.some((tr: any) => tr.error) || false
      })

      if (shouldCheckpoint) {
        // Create and save checkpoint
        const checkpoint = checkpointManager.createCheckpoint({
          sessionId: context.sessionId,
          traceId: context.traceId,
          phase: currentPhase,
          mode,
          stepNumber,
          maxSteps: config.maxSteps,
          messages: memoryManager.getContext(),
          memoryState: memoryManager.getState(),
          currentSubgoal,
          completedSubgoals,
          lastToolResult: toolResults?.[toolResults.length - 1]
        })

        await checkpointManager.save(checkpoint)
      }
    }
  })

  return { agent, memoryManager, checkpointManager, errorRecovery }
}

// Resume agent from checkpoint
export async function resumeAgent(
  sessionId: string,
  context: AgentContext
): Promise<{ agent: ReturnType<typeof createAgent>; checkpoint: any }> {
  // Get checkpoint manager
  const checkpointManager = new CheckpointManager(context.db, {
    logger: context.logger
  })

  // Restore checkpoint
  const checkpoint = await checkpointManager.restore(sessionId)
  if (!checkpoint) {
    throw new Error(`No checkpoint found for session ${sessionId}`)
  }

  // Create agent with restored state
  const agentSetup = createAgent(checkpoint.mode, {
    ...context,
    sessionId,
    traceId: crypto.randomUUID() // New trace for resumed session
  })

  // Restore memory state
  agentSetup.memoryManager.restoreState({
    workingMemory: checkpoint.workingMemory,
    subgoalMemory: checkpoint.subgoalMemory,
    longTermFacts: []
  })

  context.logger.info('Agent resumed from checkpoint', {
    sessionId,
    checkpointId: checkpoint.id,
    stepNumber: checkpoint.stepNumber,
    phase: checkpoint.phase,
    subgoalsCompleted: checkpoint.completedSubgoals.length
  })

  return { agent: agentSetup, checkpoint }
}

// Get max steps for mode
export function getMaxSteps(mode: AgentMode): number {
  return MODE_CONFIG[mode].maxSteps
}
