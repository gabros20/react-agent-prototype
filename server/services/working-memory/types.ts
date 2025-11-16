/**
 * Working Memory Types
 * 
 * Universal entity types for reference resolution across all CMS resources
 */

export interface Entity {
  type: string;        // 'page' | 'section' | 'collection' | 'media' | 'entry' | 'task'
  id: string;          // UUID
  name: string;        // Human-readable name
  slug?: string;       // URL slug (if applicable)
  timestamp: Date;     // When last accessed
}

export interface WorkingContextState {
  entities: Entity[];
}
