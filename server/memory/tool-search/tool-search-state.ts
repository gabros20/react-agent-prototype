/**
 * Tool Search State - Immutable state for tool search within a single execution.
 *
 * REPLACES: Module-level mutable variables in main-agent.ts:
 * - lastInjectedInstructions
 * - currentBaseSystemPrompt
 * - persistedDiscoveredTools
 *
 * Design decisions:
 * - Immutable: All mutations return new instances (structural sharing)
 * - Serializable: Can be persisted to session storage
 * - Testable: No hidden dependencies
 */

import type { WorkingContext } from '../working-context';

// ============================================================================
// Types
// ============================================================================

export interface InjectionRecord {
  instructions: string;
  tools: readonly string[];
  updatedSystemPrompt: string;
  stepNumber: number;
  timestamp: Date;
}

export interface ToolSearchStateData {
  /** Tools found in previous turns (loaded from WorkingContext) */
  persistedTools: readonly string[];
  /** Tools found in current execution (from searchTools calls) */
  currentTools: readonly string[];
  /** Last injected instructions (for debug panel emission) */
  lastInjection: InjectionRecord | null;
  /** Base system prompt before tool injection */
  baseSystemPrompt: string;
}

// ============================================================================
// Immutable State Class
// ============================================================================

export class ToolSearchState {
  private readonly data: Readonly<ToolSearchStateData>;

  private constructor(data: ToolSearchStateData) {
    // Freeze deeply for true immutability
    this.data = Object.freeze({
      ...data,
      persistedTools: Object.freeze([...data.persistedTools]),
      currentTools: Object.freeze([...data.currentTools]),
    });
  }

  /**
   * Create initial state from WorkingContext
   */
  static fromWorkingContext(
    workingContext: WorkingContext,
    baseSystemPrompt: string
  ): ToolSearchState {
    return new ToolSearchState({
      persistedTools: workingContext.getDiscoveredTools(),
      currentTools: [],
      lastInjection: null,
      baseSystemPrompt,
    });
  }

  /**
   * Create fresh state (no prior context)
   */
  static create(baseSystemPrompt: string): ToolSearchState {
    return new ToolSearchState({
      persistedTools: [],
      currentTools: [],
      lastInjection: null,
      baseSystemPrompt,
    });
  }

  /**
   * Add tools found from searchTools call.
   * Returns same instance if no new tools (structural sharing).
   */
  withFoundTools(newTools: string[]): ToolSearchState {
    // Structural sharing: only create new array if tools actually changed
    const existingSet = new Set(this.data.currentTools);
    const actuallyNew = newTools.filter(t => !existingSet.has(t));

    if (actuallyNew.length === 0) {
      return this; // No change, return same instance (referential equality)
    }

    return new ToolSearchState({
      ...this.data,
      currentTools: [...this.data.currentTools, ...actuallyNew],
    });
  }

  /**
   * Record injection for debug emission
   */
  withInjection(record: Omit<InjectionRecord, 'timestamp'>): ToolSearchState {
    return new ToolSearchState({
      ...this.data,
      lastInjection: { ...record, timestamp: new Date() },
    });
  }

  /**
   * Get all active tools (persisted + current)
   */
  getAllActiveTools(): string[] {
    return [...new Set([...this.data.persistedTools, ...this.data.currentTools])];
  }

  /**
   * Get last injection and clear it (for SSE emission).
   * Returns new state with cleared injection.
   */
  consumeLastInjection(): { state: ToolSearchState; injection: InjectionRecord | null } {
    const injection = this.data.lastInjection;
    if (!injection) {
      return { state: this, injection: null };
    }

    return {
      state: new ToolSearchState({ ...this.data, lastInjection: null }),
      injection,
    };
  }

  // ============================================================================
  // Accessors (read-only)
  // ============================================================================

  get baseSystemPrompt(): string {
    return this.data.baseSystemPrompt;
  }

  get persistedTools(): readonly string[] {
    return this.data.persistedTools;
  }

  get currentTools(): readonly string[] {
    return this.data.currentTools;
  }

  get lastInjection(): InjectionRecord | null {
    return this.data.lastInjection;
  }

  /**
   * Check if any tools have been discovered
   */
  hasDiscoveredTools(): boolean {
    return this.data.persistedTools.length > 0 || this.data.currentTools.length > 0;
  }

  /**
   * Get count of all discovered tools
   */
  toolCount(): number {
    return this.getAllActiveTools().length;
  }
}
