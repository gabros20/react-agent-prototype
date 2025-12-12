/**
 * Tool Search Manager - Manages tool search lifecycle within an execution.
 *
 * REPLACES: Logic scattered across main-agent.ts and tools/_utils/step-extraction.ts
 *
 * Responsibilities:
 * - Extract found tools from step results
 * - Merge persisted and current tools
 * - Determine active tools for each step
 * - NO knowledge of prompts (that's PromptBuilder's job)
 */

import { ToolSearchState } from './tool-search-state';

// ============================================================================
// Types
// ============================================================================

/** Tool search result structure - matches searchTools output */
interface SearchToolsResult {
  tools?: string[];
  message?: string;
}

/** AI SDK 6 StepResult structure (simplified for our needs) */
export interface StepResult {
  toolResults?: Array<{
    toolName: string;
    output: unknown; // AI SDK 6 uses 'output' not 'result'
  }>;
}

/** Result of computing active tools for a step */
export interface ActiveToolsResult {
  /** Tools to make available for this step */
  activeTools: string[];
  /** Updated state (may be same instance if no changes) */
  updatedState: ToolSearchState;
  /** Tools newly discovered in this computation */
  newlyDiscovered: string[];
}

// ============================================================================
// Tool Search Manager
// ============================================================================

export class ToolSearchManager {
  /** Core tools that are always available */
  private readonly coreTools: readonly string[];

  constructor(coreTools: string[] = ['searchTools', 'finalAnswer', 'acknowledgeRequest']) {
    this.coreTools = Object.freeze([...coreTools]);
  }

  /**
   * Extract tools found in current execution steps.
   * Steps contain searchTools results from CURRENT multi-step execution.
   *
   * MOVED FROM: tools/_utils/step-extraction.ts
   */
  extractFromSteps(steps: StepResult[]): string[] {
    const tools = new Set<string>();

    for (const step of steps) {
      // Check tool results for searchTools calls
      const searchResults = step.toolResults?.filter(
        (tr) => tr.toolName === 'searchTools'
      );

      searchResults?.forEach((sr) => {
        // AI SDK 6 uses 'output' instead of 'result'
        const output = sr.output as SearchToolsResult | undefined;
        // searchTools returns string[] directly
        output?.tools?.forEach((toolName) => {
          if (toolName && typeof toolName === 'string') {
            tools.add(toolName);
          }
        });
      });
    }

    return Array.from(tools);
  }

  /**
   * Extract used tools from current execution steps.
   * Tracks which tools were actually called (not just discovered).
   *
   * MOVED FROM: tools/_utils/step-extraction.ts
   */
  extractUsedToolsFromSteps(steps: StepResult[]): string[] {
    const tools = new Set<string>();

    for (const step of steps) {
      step.toolResults?.forEach((tr) => {
        // Exclude meta-tools from "used" tracking
        if (!this.coreTools.includes(tr.toolName)) {
          tools.add(tr.toolName);
        }
      });
    }

    return Array.from(tools);
  }

  /**
   * Compute active tools for a given step.
   *
   * REPLACES: Logic in prepareStep that merges persisted + current
   *
   * @param state - Current tool search state
   * @param steps - Steps from current execution
   * @returns Updated state and list of active tools
   */
  computeActiveTools(
    state: ToolSearchState,
    steps: StepResult[]
  ): ActiveToolsResult {
    // Extract from current steps
    const fromCurrentSteps = this.extractFromSteps(steps);

    // Update state with new findings (returns same instance if no changes)
    const updatedState = fromCurrentSteps.length > 0
      ? state.withFoundTools(fromCurrentSteps)
      : state;

    // Determine what's actually new
    const existingTools = new Set(state.getAllActiveTools());
    const newlyDiscovered = fromCurrentSteps.filter(t => !existingTools.has(t));

    // Combine: core + persisted + current
    const activeTools = [
      ...new Set([
        ...this.coreTools,
        ...updatedState.getAllActiveTools(),
      ])
    ];

    return { activeTools, updatedState, newlyDiscovered };
  }

  /**
   * Get core tools list
   */
  getCoreTools(): readonly string[] {
    return this.coreTools;
  }
}
