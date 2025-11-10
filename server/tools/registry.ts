import { tool } from 'ai'
import type { z } from 'zod'
import type { AgentContext, AgentMode, ToolMetadata } from './types'

// Extended tool with metadata
export interface ExtendedTool {
  description: string
  parameters: z.ZodSchema
  execute?: (input: any) => Promise<any>
  _metadata: ToolMetadata
}

// Factory function to create tools with metadata
export function createCMSTool<T extends z.ZodSchema>(config: {
  id: string
  category: ToolMetadata['category']
  riskLevel: ToolMetadata['riskLevel']
  requiresApproval: boolean
  allowedModes: AgentMode[]
  tags: string[]
  description: string
  inputSchema: T
  execute?: (input: z.infer<T>, context: AgentContext) => Promise<any>
}): ExtendedTool {
  // Store the original execute function that needs context
  const originalExecute = config.execute

  // Create tool object (compatible with AI SDK)
  const extendedTool: ExtendedTool = {
    description: config.description,
    parameters: config.inputSchema,
    // Note: execute will be wrapped with context when registered in agent
    execute: originalExecute as any,
    _metadata: {
      id: config.id,
      category: config.category,
      riskLevel: config.riskLevel,
      requiresApproval: config.requiresApproval,
      allowedModes: config.allowedModes,
      tags: config.tags
    }
  }

  return extendedTool
}

// Tool Registry Class
export class ToolRegistry {
  private tools = new Map<string, ExtendedTool>()

  // Register tool
  register(tool: ExtendedTool) {
    this.tools.set(tool._metadata.id, tool)
  }

  // Get tools filtered by agent mode
  getToolsForMode(mode: AgentMode): Record<string, any> {
    const filtered: Record<string, any> = {}

    for (const [id, tool] of this.tools) {
      if (tool._metadata.allowedModes.includes(mode)) {
        // Return AI SDK tool without metadata
        const { _metadata, ...aiTool } = tool
        filtered[id] = aiTool
      }
    }

    return filtered
  }

  // Get tools by risk level
  getToolsByRisk(risk: 'safe' | 'moderate' | 'high'): string[] {
    return Array.from(this.tools.values())
      .filter((t) => t._metadata.riskLevel === risk)
      .map((t) => t._metadata.id)
  }

  // Get tools requiring approval
  getApprovalTools(): string[] {
    return Array.from(this.tools.values())
      .filter((t) => t._metadata.requiresApproval)
      .map((t) => t._metadata.id)
  }

  // Get single tool
  get(id: string): ExtendedTool | undefined {
    return this.tools.get(id)
  }

  // Get all tools (for prepareStep filtering)
  getAllTools(): Record<string, any> {
    const all: Record<string, any> = {}
    for (const [id, tool] of this.tools) {
      const { _metadata, ...aiTool } = tool
      all[id] = aiTool
    }
    return all
  }

  // Get all tool IDs
  getAllToolIds(): string[] {
    return Array.from(this.tools.keys())
  }

  // Check if tool requires approval
  requiresApproval(toolId: string): boolean {
    const tool = this.tools.get(toolId)
    return tool?._metadata.requiresApproval ?? false
  }
}
