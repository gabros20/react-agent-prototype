/**
 * Working Context - Sliding window of recently accessed entities and discovered tools
 */

import type { Entity, WorkingContextState, ToolUsageRecord } from './types';

const MAX_ENTITIES = 10;
const MAX_DISCOVERED_TOOLS = 20;

export class WorkingContext {
  private entities: Entity[] = [];
  private discoveredTools: Set<string> = new Set();
  private usedTools: Map<string, ToolUsageRecord> = new Map();

  /** Add entity (dedupes and maintains sliding window) */
  add(entity: Entity): void {
    this.entities = this.entities.filter(e => e.id !== entity.id);
    this.entities.unshift(entity);
    if (this.entities.length > MAX_ENTITIES) {
      this.entities = this.entities.slice(0, MAX_ENTITIES);
    }
  }

  /** Add multiple entities */
  addMany(entities: Entity[]): void {
    for (const e of entities) this.add(e);
  }

  /** Add discovered tools (from tool_search results) */
  addDiscoveredTools(tools: string[]): void {
    for (const tool of tools) {
      this.discoveredTools.add(tool);
    }
    // Trim if too many (keep most recent by converting to array, trimming, and back)
    if (this.discoveredTools.size > MAX_DISCOVERED_TOOLS) {
      const arr = Array.from(this.discoveredTools);
      this.discoveredTools = new Set(arr.slice(-MAX_DISCOVERED_TOOLS));
    }
  }

  /** Get all discovered tools */
  getDiscoveredTools(): string[] {
    return Array.from(this.discoveredTools);
  }

  /** Remove tools from discovered set (for context cleanup) */
  removeTools(toolNames: string[]): void {
    for (const name of toolNames) {
      this.discoveredTools.delete(name);
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
  }

  /** Get tool usage records */
  getUsedTools(): ToolUsageRecord[] {
    return Array.from(this.usedTools.values());
  }

  /** Format for system prompt injection */
  toContextString(): string {
    const lines: string[] = [];

    // Entities section
    if (this.entities.length > 0) {
      const grouped: Record<string, Entity[]> = {};
      for (const entity of this.entities) {
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
      entities: this.entities,
      discoveredTools: Array.from(this.discoveredTools),
      usedTools: Array.from(this.usedTools.values()),
    };
  }

  /** Deserialize from DB */
  static fromJSON(state: WorkingContextState): WorkingContext {
    const ctx = new WorkingContext();
    ctx.entities = state.entities.map(e => ({
      ...e,
      timestamp: new Date(e.timestamp)
    }));
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
    return this.entities.length;
  }

  /** Get count of discovered tools */
  discoveredToolsCount(): number {
    return this.discoveredTools.size;
  }
}
