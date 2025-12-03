/**
 * Working Context - Sliding window of recently accessed entities
 */

import type { Entity, WorkingContextState } from './types';

const MAX_ENTITIES = 10;

export class WorkingContext {
  private entities: Entity[] = [];

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

  /** Format for system prompt injection */
  toContextString(): string {
    if (this.entities.length === 0) return '';

    const grouped: Record<string, Entity[]> = {};
    for (const entity of this.entities) {
      (grouped[entity.type] ??= []).push(entity);
    }

    const lines = ['[WORKING MEMORY]'];
    for (const [type, items] of Object.entries(grouped)) {
      lines.push(`${type}s:`);
      for (const item of items.slice(0, 3)) {
        lines.push(`  - "${item.name}" (${item.id})`);
      }
    }
    return lines.join('\n');
  }

  /** Serialize for DB storage */
  toJSON(): WorkingContextState {
    return { entities: this.entities };
  }

  /** Deserialize from DB */
  static fromJSON(state: WorkingContextState): WorkingContext {
    const ctx = new WorkingContext();
    ctx.entities = state.entities.map(e => ({
      ...e,
      timestamp: new Date(e.timestamp)
    }));
    return ctx;
  }

  size(): number {
    return this.entities.length;
  }
}
