/**
 * Entity Extractor
 * 
 * Universal entity extraction from tool results using pattern matching
 * Works for ANY CMS resource type (pages, sections, collections, media, entries, tasks)
 */

import type { Entity } from './types';

export class EntityExtractor {
  /**
   * Extract entities from any tool result
   * Universal patterns: single resource, search results, list results
   */
  extract(toolName: string, toolResult: any): Entity[] {
    if (!toolResult) return [];
    
    const entities: Entity[] = [];
    const type = this.inferType(toolName, toolResult);
    
    // Pattern 1: Single resource (cms_getPage, cms_getSection, etc.)
    if (toolResult.id && (toolResult.name || toolResult.slug || toolResult.title)) {
      entities.push(this.createEntity(type, toolResult));
    }
    
    // Pattern 2: Search results (cms_findResource)
    if (toolResult.matches && Array.isArray(toolResult.matches)) {
      for (const match of toolResult.matches.slice(0, 3)) { // Top 3 only
        entities.push(this.createEntity(match.type || type, match));
      }
    }
    
    // Pattern 3: List results (cms_listPages, cms_getPageSections, etc.)
    if (Array.isArray(toolResult)) {
      for (const item of toolResult.slice(0, 5)) { // Top 5 only
        if (item?.id && (item.name || item.slug || item.title || item.sectionKey)) {
          entities.push(this.createEntity(type, item));
        }
      }
    }
    
    // Pattern 4: Paginated results
    if (toolResult.data && Array.isArray(toolResult.data)) {
      for (const item of toolResult.data.slice(0, 5)) {
        if (item?.id && (item.name || item.slug || item.title)) {
          entities.push(this.createEntity(type, item));
        }
      }
    }
    
    return entities;
  }
  
  /**
   * Infer entity type from tool name and result structure
   */
  private inferType(toolName: string, result: any): string {
    // Check result for explicit type first
    if (result?.type) {
      return result.type.toLowerCase();
    }
    
    // cms_getPage → page
    // cms_getPageSections → section
    // cms_getSectionContent → section
    const match = toolName.match(/cms_(get|find|list|create|update|delete)([A-Z]\w+)/);
    if (match) {
      const extracted = match[2].toLowerCase();
      
      // Handle special cases
      if (extracted.includes('section')) return 'section';
      if (extracted.includes('page')) return 'page';
      if (extracted.includes('collection')) return 'collection';
      if (extracted.includes('entry') || extracted.includes('entries')) return 'entry';
      if (extracted.includes('media')) return 'media';
      
      return extracted;
    }
    
    return 'resource';
  }
  
  /**
   * Create entity from data
   */
  private createEntity(type: string, data: any): Entity {
    // Determine name from available fields
    let name = data.name || data.title || data.slug;
    
    // For sections, use sectionKey or sectionName
    if (type === 'section' || type === 'pagesection') {
      name = data.sectionName || data.sectionKey || data.name || data.key || 'Unnamed Section';
    }
    
    // Fallback
    if (!name) {
      name = `Unnamed ${type}`;
    }
    
    return {
      type: type === 'pagesection' ? 'section' : type,
      id: data.id,
      name,
      slug: data.slug,
      timestamp: new Date()
    };
  }
}
