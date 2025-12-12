/**
 * Cache Module - Exports for all caching utilities
 */

export { SimpleCache, type CacheStats } from './simple-cache';

// Re-export CMS cache utilities for convenience
export {
  pageCache,
  sectionCache,
  sectionsByPageCache,
  templateCache,
  invalidatePageCache,
  invalidateSectionCache,
  invalidateTemplateCache,
  clearAllCmsCaches,
  getCmsCacheStats,
} from '../services/cms/cache';
