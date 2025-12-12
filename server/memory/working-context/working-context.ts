/**
 * Working Context - Sliding window of recently accessed entities and discovered tools
 *
 * IMPROVEMENT: O(1) entity lookups via Map-based index
 * - entitiesById: Map for O(1) lookup by ID
 * - entityOrder: Array maintains recency order
 * - Version-based memoization for toContextString()
 */

import type { Entity, WorkingContextState, ToolUsageRecord } from './types';

const MAX_ENTITIES = 10;
const MAX_DISCOVERED_TOOLS = 20;

export class WorkingContext {
  // O(1) lookup by entity ID
  private entitiesById: Map<string, Entity> = new Map();
  // Maintains recency order (most recent first)
  private entityOrder: string[] = [];
  // Discovered tools from searchTools
  private discoveredTools: Set<string> = new Set();
  // Tool usage tracking
  private usedTools: Map<string, ToolUsageRecord> = new Map();

  // Version-based memoization
  private _version = 0;
  private _cachedContextString: { version: number; value: string } | null = null;

  /**
   * Add entity (dedupes and maintains sliding window)
   * O(1) for lookup, O(n) for order array update (but n is small, max 10)
   */
  add(entity: Entity): void {
    // O(1) check if exists
    if (this.entitiesById.has(entity.id)) {
      // Remove from order array (O(n) but n is small)
      this.entityOrder = this.entityOrder.filter(id => id !== entity.id);
    }

    // Add/update in map and order
    this.entitiesById.set(entity.id, entity);
    this.entityOrder.unshift(entity.id);

    // Trim excess
    while (this.entityOrder.length > MAX_ENTITIES) {
      const removed = this.entityOrder.pop()!;
      this.entitiesById.delete(removed);
    }

    this._version++;
  }

  /** Add multiple entities */
  addMany(entities: Entity[]): void {
    for (const e of entities) this.add(e);
  }

  /** Get entity by ID - O(1) lookup */
  getById(id: string): Entity | undefined {
    return this.entitiesById.get(id);
  }

  /** Get all entities in recency order */
  getAll(): Entity[] {
    return this.entityOrder.map(id => this.entitiesById.get(id)!);
  }

  /** Add discovered tools (from searchTools results) */
  addDiscoveredTools(tools: string[]): void {
    const sizeBefore = this.discoveredTools.size;
    for (const tool of tools) {
      this.discoveredTools.add(tool);
    }

    // Trim if too many (keep most recent by converting to array, trimming, and back)
    if (this.discoveredTools.size > MAX_DISCOVERED_TOOLS) {
      const arr = Array.from(this.discoveredTools);
      this.discoveredTools = new Set(arr.slice(-MAX_DISCOVERED_TOOLS));
    }

    // Only invalidate cache if tools actually changed
    if (this.discoveredTools.size !== sizeBefore) {
      this._version++;
    }
  }

  /** Get all discovered tools */
  getDiscoveredTools(): string[] {
    return Array.from(this.discoveredTools);
  }

  /** Remove tools from discovered set (for context cleanup) */
  removeTools(toolNames: string[]): void {
    let removed = false;
    for (const name of toolNames) {
      if (this.discoveredTools.delete(name)) {
        removed = true;
      }
    }
    if (removed) {
      this._version++;
    }
  }

  /** Record tool usage */
  recordToolUsage(toolName: string, result: 'success' | 'error'): void {
    const existing = this.usedTools.get(toolName);
    this.usedTools.set(toolName, {
      name: toolName,
      count: (existing?.count || 0) + 1,
      lastUsed: new Date().toISOString(),
      lastResult: result,
    });
    this._version++;
  }

  /** Get tool usage records */
  getUsedTools(): ToolUsageRecord[] {
    return Array.from(this.usedTools.values());
  }

  /**
   * Format for system prompt injection
   * Memoized with version tracking - only recomputes when data changes
   */
  toContextString(): string {
    // Return cached if still valid
    if (this._cachedContextString?.version === this._version) {
      return this._cachedContextString.value;
    }

    // Recompute
    const value = this.computeContextString();
    this._cachedContextString = { version: this._version, value };
    return value;
  }

  private computeContextString(): string {
    const lines: string[] = [];
    const entities = this.getAll();

    // Entities section
    if (entities.length > 0) {
      const grouped: Record<string, Entity[]> = {};
      for (const entity of entities) {
        (grouped[entity.type] ??= []).push(entity);
      }

      lines.push('[WORKING MEMORY]');
      for (const [type, items] of Object.entries(grouped)) {
        lines.push(`${type}s:`);
        for (const item of items.slice(0, 3)) {
          lines.push(`  - "${item.name}" (${item.id})`);
        }
      }
    }

    // Discovered tools section (for cross-turn persistence)
    if (this.discoveredTools.size > 0) {
      lines.push('');
      lines.push('[DISCOVERED TOOLS]');
      lines.push(Array.from(this.discoveredTools).join(', '));
    }

    return lines.join('\n');
  }

  /** Serialize for DB storage */
  toJSON(): WorkingContextState {
    return {
      entities: this.getAll(),
      discoveredTools: Array.from(this.discoveredTools),
      usedTools: Array.from(this.usedTools.values()),
    };
  }

  /** Deserialize from DB */
  static fromJSON(state: WorkingContextState): WorkingContext {
    const ctx = new WorkingContext();

    // Restore entities with Map-based storage
    for (const e of state.entities) {
      const entity = {
        ...e,
        timestamp: new Date(e.timestamp),
      };
      ctx.entitiesById.set(entity.id, entity);
      ctx.entityOrder.push(entity.id);
    }

    if (state.discoveredTools) {
      ctx.discoveredTools = new Set(state.discoveredTools);
    }

    if (state.usedTools) {
      for (const record of state.usedTools) {
        ctx.usedTools.set(record.name, record);
      }
    }

    return ctx;
  }

  size(): number {
    return this.entitiesById.size;
  }

  /** Get count of discovered tools */
  discoveredToolsCount(): number {
    return this.discoveredTools.size;
  }
}
