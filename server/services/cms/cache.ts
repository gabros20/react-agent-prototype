/**
 * CMS Query Cache
 *
 * In-memory cache for frequent CMS queries.
 * Short TTL since CMS data can change via agent actions.
 *
 * Cache invalidation happens automatically on write operations.
 */

import { SimpleCache } from '../../cache/simple-cache';

// TTL values - short because CMS data is mutable
const PAGE_TTL = 30_000;      // 30 seconds
const SECTION_TTL = 30_000;   // 30 seconds
const TEMPLATE_TTL = 60_000;  // 60 seconds (templates change less often)

// Type-safe caches
// Using 'any' for now since we don't want to import full schema types
// The actual type safety comes from how these are used in services

export const pageCache = new SimpleCache<any>(PAGE_TTL);
export const sectionCache = new SimpleCache<any>(SECTION_TTL);
export const sectionsByPageCache = new SimpleCache<any[]>(SECTION_TTL);
export const templateCache = new SimpleCache<any>(TEMPLATE_TTL);

// ============================================================================
// Invalidation Helpers
// ============================================================================

/**
 * Invalidate all cache entries for a specific page
 */
export function invalidatePageCache(pageId: string): void {
  pageCache.delete(`page:id:${pageId}`);
  // Invalidate any slug lookups that might have this page
  pageCache.deleteByPrefix('page:slug:');
  // Also invalidate sections for this page
  sectionsByPageCache.delete(`sections:page:${pageId}`);
}

/**
 * Invalidate section cache entries
 */
export function invalidateSectionCache(sectionId?: string, pageId?: string): void {
  if (sectionId) {
    sectionCache.delete(`section:${sectionId}`);
  }
  if (pageId) {
    sectionsByPageCache.delete(`sections:page:${pageId}`);
  }
}

/**
 * Invalidate template cache entries
 */
export function invalidateTemplateCache(templateId?: string): void {
  if (templateId) {
    templateCache.delete(`template:id:${templateId}`);
    templateCache.deleteByPrefix('template:key:');
  } else {
    // Clear all template cache
    templateCache.clear();
  }
}

/**
 * Clear all CMS caches (useful for testing or after bulk operations)
 */
export function clearAllCmsCaches(): void {
  pageCache.clear();
  sectionCache.clear();
  sectionsByPageCache.clear();
  templateCache.clear();
}

/**
 * Get stats for all CMS caches (for debugging)
 */
export function getCmsCacheStats() {
  return {
    page: pageCache.stats(),
    section: sectionCache.stats(),
    sectionsByPage: sectionsByPageCache.stats(),
    template: templateCache.stats(),
  };
}
