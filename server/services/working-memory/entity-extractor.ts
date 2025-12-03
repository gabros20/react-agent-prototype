/**
 * Entity Extractor - Extract entities from tool results for working memory
 */

import type { Entity } from './types';

/** Stateless extractor - kept as class for consistent API with WorkingContext */
export class EntityExtractor {
  extract(toolName: string, result: any): Entity[] {
    if (!result) return [];

    const entities: Entity[] = [];
    const type = inferType(toolName, result);

    // Single resource: {id, name/title/slug}
    if (result.id && (result.name || result.slug || result.title)) {
      entities.push(createEntity(type, result));
    }

    // Search results: {matches: [...]}
    if (Array.isArray(result.matches)) {
      for (const m of result.matches.slice(0, 3)) {
        entities.push(createEntity(m.type || type, m));
      }
    }

    // Array results
    if (Array.isArray(result)) {
      for (const item of result.slice(0, 5)) {
        if (item?.id && (item.name || item.slug || item.title || item.sectionKey)) {
          entities.push(createEntity(type, item));
        }
      }
    }

    // Paginated: {data: [...]}
    if (Array.isArray(result.data)) {
      for (const item of result.data.slice(0, 5)) {
        if (item?.id && (item.name || item.slug || item.title)) {
          entities.push(createEntity(type, item));
        }
      }
    }

    // Nested: {success: true, post/page/entry/section/image: {...}}
    if (result.success) {
      const nested = result.post || result.page || result.entry || result.section || result.image;
      if (nested?.id) {
        const nestedType = result.post ? 'post' : result.page ? 'page' :
                          result.entry ? 'entry' : result.section ? 'section' :
                          result.image ? 'image' : type;
        entities.push(createEntity(nestedType, nested));
      }
    }

    // Posts list: {posts: [...]}
    if (Array.isArray(result.posts)) {
      for (const p of result.posts.slice(0, 5)) {
        if (p?.id) entities.push(createEntity('post', p));
      }
    }

    return entities;
  }
}

function inferType(toolName: string, result: any): string {
  if (result?.type) return result.type.toLowerCase();

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

function createEntity(type: string, data: any): Entity {
  let name = data.name || data.title || data.slug;

  if (type === 'section' || type === 'pagesection') {
    name = data.sectionName || data.sectionKey || data.name || data.key || 'Unnamed Section';
    type = 'section';
  } else if (type === 'post') {
    name = data.title || data.name || data.slug || 'Unnamed Post';
  }

  return {
    type,
    id: data.id,
    name: name || `Unnamed ${type}`,
    slug: data.slug,
    timestamp: new Date()
  };
}
