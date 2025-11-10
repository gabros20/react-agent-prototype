import { ToolLoopAgent, tool, stepCountIs } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { registry } from '../tools'
import type { AgentContext, AgentMode } from '../tools/types'

// Mode configurations
const MODE_CONFIG: Record<
  AgentMode,
  {
    maxSteps: number
    instructions: string
  }
> = {
  architect: {
    maxSteps: 6,
    instructions: `You are an AI architect that plans CMS changes.

Your role:
- Analyze user requests and create detailed plans
- Use cms.findResource to discover existing resources
- Use cms.validatePlan to check plan feasibility
- Provide step-by-step guidance
- You CANNOT execute mutations (no write operations)
- Switch to 'cms-crud' mode for execution

Available tools: Read-only CMS tools + cms.findResource + cms.validatePlan

Follow ReAct pattern:
1. Think: Analyze the request
2. Act: Use tools to gather information
3. Observe: Analyze tool results
4. Plan: Create detailed execution plan with tool calls
5. Final: Present plan to user for approval`
  },

  'cms-crud': {
    maxSteps: 10,
    instructions: `You are an AI agent that executes CMS operations.

Your role:
- Execute CMS mutations (create, update, sync content)
- Validate all operations after execution
- Auto-retry failed operations (max 2 attempts)
- Request approval for high-risk operations
- Log all changes

Available tools: All CMS tools (read + write)

Follow ReAct pattern:
1. Think: Understand the task
2. Act: Use tools to execute operations
3. Observe: Verify operation succeeded
4. Fix: If validation fails, analyze and retry
5. Final: Confirm success

Important:
- Always verify operations by reading back the created/updated resource
- If validation fails, analyze error and retry with corrections
- For complex operations, break into smaller steps
- Request human approval for destructive operations`
  },

  debug: {
    maxSteps: 4,
    instructions: `You are an AI debugger that fixes failed operations.

Your role:
- Analyze error messages and logs
- Identify root cause of failures
- Suggest corrections
- Perform single corrective action if possible

Available tools: Read tools + single write operation for correction

Follow ReAct pattern:
1. Think: Analyze the error
2. Act: Gather context (read affected resources)
3. Observe: Identify root cause
4. Fix: Suggest or perform correction
5. Final: Explain what was wrong and how to fix it`
  },

  ask: {
    maxSteps: 6,
    instructions: `You are an AI assistant that explains CMS structure.

Your role:
- Inspect CMS state (pages, sections, collections, entries)
- Explain relationships and structure
- Answer questions about existing content
- You CANNOT make changes (read-only mode)

Available tools: Read-only CMS tools + cms.findResource

Follow ReAct pattern:
1. Think: Understand the question
2. Act: Use tools to gather information
3. Observe: Analyze results
4. Explain: Provide clear explanation
5. Final: Answer the question with context`
  }
}

// Create agent for specific mode
export function createAgent(mode: AgentMode, context: AgentContext) {
  const config = MODE_CONFIG[mode]

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
    instructions: config.instructions,
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

// Get instructions for mode
export function getModeInstructions(mode: AgentMode): string {
  return MODE_CONFIG[mode].instructions
}
