import { ToolLoopAgent, tool, stepCountIs } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { registry } from '../tools'
import type { AgentContext, AgentMode } from '../tools/types'
import { getSystemPrompt, type CompositionContext } from '../prompts/utils/composer'

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

// Create agent for specific mode
export function createAgent(mode: AgentMode, context: AgentContext) {
  const config = MODE_CONFIG[mode]

  // Compose system prompt from modular prompt files
  const systemPrompt = composeAgentPrompt(mode, context)

  // Get tools allowed for this mode
  const toolsMap = registry.getToolsForMode(mode)

  // Convert tools to AI SDK v6 format with context binding
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
          // Execute with context
          return await toolDef.execute!(input, context)
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

  // Create ToolLoopAgent with v6 API
  const agent = new ToolLoopAgent({
    model: openrouter.languageModel(modelId),
    instructions: systemPrompt, // Use composed prompt
    tools,
    stopWhen: stepCountIs(config.maxSteps),
    onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
      // Log step
      context.logger.info({
        traceId: context.traceId,
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
          toolCalls: toolCalls?.map((tc: any) => ({
            toolName: tc.toolName,
            input: tc.args
          })),
          toolResults: toolResults?.map((tr: any) => ({
            success: !tr.error,
            output: tr.result || tr.error
          }))
        })
      }
    }
  })

  return agent
}

// Get max steps for mode
export function getMaxSteps(mode: AgentMode): number {
  return MODE_CONFIG[mode].maxSteps
}
