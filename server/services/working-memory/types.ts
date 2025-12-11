/** Entity tracked in working memory */
export interface Entity {
  type: string;     // page, section, collection, media, entry, post
  id: string;       // UUID
  name: string;     // Display name
  slug?: string;    // URL slug
  timestamp: Date;  // Last accessed
}

/** Tool usage record for tracking which tools were called */
export interface ToolUsageRecord {
  name: string;           // Tool name
  count: number;          // Times called
  lastUsed: string;       // ISO timestamp
  lastResult: 'success' | 'error';
}

/** Serialized state for DB storage (Phase 7 - includes tool tracking) */
export interface WorkingContextState {
  entities: Entity[];
  discoveredTools?: string[];      // Tools returned by searchTools
  usedTools?: ToolUsageRecord[];   // Tools actually called
}
