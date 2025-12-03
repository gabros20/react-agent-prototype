/** Entity tracked in working memory */
export interface Entity {
  type: string;     // page, section, collection, media, entry, post
  id: string;       // UUID
  name: string;     // Display name
  slug?: string;    // URL slug
  timestamp: Date;  // Last accessed
}

/** Serialized state for DB storage */
export interface WorkingContextState {
  entities: Entity[];
}
