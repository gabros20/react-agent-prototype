/**
 * Working Context
 * 
 * Sliding window memory manager for recently accessed entities
 * Maintains only the last N entities to prevent unbounded growth
 */

import type { Entity, WorkingContextState } from './types';

export class WorkingContext {
  private entities: Entity[] = [];
  private readonly MAX_ENTITIES = 10; // Sliding window size
  
  /**
   * Add entity to front of list (most recent first)
   */
  add(entity: Entity): void {
    // Avoid duplicates - if entity already exists, move it to front
    this.entities = this.entities.filter(e => e.id !== entity.id);
    
    // Add to front
    this.entities.unshift(entity);
    
    // Prune old entities (sliding window)
    this.entities = this.entities.slice(0, this.MAX_ENTITIES);
  }
  
  /**
   * Add multiple entities
   */
  addMany(entities: Entity[]): void {
    entities.forEach(e => this.add(e));
  }
  
  /**
   * Get recent N entities
   */
  getRecent(count: number = 5): Entity[] {
    return this.entities.slice(0, count);
  }
  
  /**
   * Format working memory as context string for system prompt injection
   */
  toContextString(): string {
    if (this.entities.length === 0) return '';
    
    // Group by type for readability
    const grouped: Record<string, Entity[]> = {};
    for (const entity of this.entities) {
      if (!grouped[entity.type]) grouped[entity.type] = [];
      grouped[entity.type].push(entity);
    }
    
    const lines: string[] = ['[WORKING MEMORY]'];
    for (const [type, items] of Object.entries(grouped)) {
      const plural = type.endsWith('s') ? type : `${type}s`;
      lines.push(`${plural}:`);
      for (const item of items.slice(0, 3)) { // Max 3 per type
        lines.push(`  - "${item.name}" (${item.id})`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Serialize to JSON for database storage
   */
  toJSON(): WorkingContextState {
    return { entities: this.entities };
  }
  
  /**
   * Deserialize from JSON
   */
  static fromJSON(state: WorkingContextState): WorkingContext {
    const context = new WorkingContext();
    context.entities = state.entities.map(e => ({
      ...e,
      timestamp: new Date(e.timestamp)
    }));
    return context;
  }
  
  /**
   * Clear all entities
   */
  clear(): void {
    this.entities = [];
  }
  
  /**
   * Get total entity count
   */
  size(): number {
    return this.entities.length;
  }
}
