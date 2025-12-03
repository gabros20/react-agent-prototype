/**
 * Entity Extractor - Extract entities from tool results for working memory
 */

import type { Entity } from './types';

// ============================================================================
// Type Guards for Safe Property Access
// ============================================================================

/** Check if value is a non-null object */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Check if object has an id property that's a string */
function hasId(obj: Record<string, unknown>): obj is Record<string, unknown> & { id: string } {
  return typeof obj.id === 'string';
}

/** Check if object has a name, slug, or title property */
function hasIdentifier(obj: Record<string, unknown>): boolean {
  return typeof obj.name === 'string' ||
         typeof obj.slug === 'string' ||
         typeof obj.title === 'string' ||
         typeof obj.sectionKey === 'string';
}

/** Get string property safely */
function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key];
  return typeof val === 'string' ? val : undefined;
}

/** Get array property safely */
function getArray(obj: Record<string, unknown>, key: string): unknown[] | undefined {
  const val = obj[key];
  return Array.isArray(val) ? val : undefined;
}

// ============================================================================
// Entity Extractor
// ============================================================================

/** Stateless extractor - kept as class for consistent API with WorkingContext */
export class EntityExtractor {
  extract(toolName: string, result: unknown): Entity[] {
    if (!isObject(result)) return [];

    const entities: Entity[] = [];
    const type = inferType(toolName, result);

    // Single resource: {id, name/title/slug}
    if (hasId(result) && hasIdentifier(result)) {
      entities.push(createEntity(type, result));
    }

    // Search results: {matches: [...]}
    const matches = getArray(result, 'matches');
    if (matches) {
      for (const m of matches.slice(0, 3)) {
        if (isObject(m) && hasId(m)) {
          const matchType = getString(m, 'type') || type;
          entities.push(createEntity(matchType, m));
        }
      }
    }

    // Array results (when result itself is array - handled by checking if result has numeric keys)
    // Note: Arrays don't pass isObject check with our implementation, so we check separately
    if (Array.isArray(result)) {
      for (const item of result.slice(0, 5)) {
        if (isObject(item) && hasId(item) && hasIdentifier(item)) {
          entities.push(createEntity(type, item));
        }
      }
    }

    // Paginated: {data: [...]}
    const data = getArray(result, 'data');
    if (data) {
      for (const item of data.slice(0, 5)) {
        if (isObject(item) && hasId(item) && hasIdentifier(item)) {
          entities.push(createEntity(type, item));
        }
      }
    }

    // Nested: {success: true, post/page/entry/section/image: {...}}
    if (result.success === true) {
      const nested = result.post || result.page || result.entry || result.section || result.image;
      if (isObject(nested) && hasId(nested)) {
        const nestedType = result.post ? 'post' : result.page ? 'page' :
                          result.entry ? 'entry' : result.section ? 'section' :
                          result.image ? 'image' : type;
        entities.push(createEntity(nestedType, nested));
      }
    }

    // Posts list: {posts: [...]}
    const posts = getArray(result, 'posts');
    if (posts) {
      for (const p of posts.slice(0, 5)) {
        if (isObject(p) && hasId(p)) {
          entities.push(createEntity('post', p));
        }
      }
    }

    return entities;
  }
}

function inferType(toolName: string, result: Record<string, unknown>): string {
  const resultType = getString(result, 'type');
  if (resultType) return resultType.toLowerCase();

  const match = toolName.match(/cms_(get|find|list|create|update|delete|publish|archive)([A-Z]\w+)/);
  if (match) {
    const name = match[2].toLowerCase();
    if (name.includes('section')) return 'section';
    if (name.includes('page')) return 'page';
    if (name.includes('collection')) return 'collection';
    if (name.includes('entry') || name.includes('entries')) return 'entry';
    if (name.includes('media')) return 'media';
    if (name.includes('post')) return 'post';
    if (name.includes('image')) return 'image';
    return name;
  }
  return 'resource';
}

function createEntity(type: string, data: Record<string, unknown> & { id: string }): Entity {
  let name = getString(data, 'name') || getString(data, 'title') || getString(data, 'slug');
  let entityType = type;

  if (type === 'section' || type === 'pagesection') {
    name = getString(data, 'sectionName') ||
           getString(data, 'sectionKey') ||
           getString(data, 'name') ||
           getString(data, 'key') ||
           'Unnamed Section';
    entityType = 'section';
  } else if (type === 'post') {
    name = getString(data, 'title') ||
           getString(data, 'name') ||
           getString(data, 'slug') ||
           'Unnamed Post';
  }

  return {
    type: entityType,
    id: data.id,
    name: name || `Unnamed ${entityType}`,
    slug: getString(data, 'slug'),
    timestamp: new Date()
  };
}
