/**
 * Atomic Tools Index
 *
 * Unified CRUD tools following ATOMIC_CRUD_TOOL_ARCHITECTURE.md patterns:
 * - Entity-centric naming: getPage, createPost, updateSection
 * - Parameter-based scope: single/batch/all via params, not separate tools
 * - Unified response format with items array
 * - Array-first delete pattern
 */

// Page Tools (4)
export {
  getPage,
  createPage,
  updatePage,
  deletePage,
} from './page-tools'

// Post Tools (4)
export {
  getPost,
  createPost,
  updatePost,
  deletePost,
} from './post-tools'

// Section Tools (5)
export {
  getSectionTemplate,
  getSection,
  createSection,
  updateSection,
  deleteSection,
} from './section-tools'

// Navigation Tools (4)
export {
  getNavItem,
  createNavItem,
  updateNavItem,
  deleteNavItem,
} from './navigation-tools'

// Image Tools (3)
export {
  getImage,
  updateImage,
  deleteImage,
} from './image-tools'

// Entry Tools (4)
export {
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
} from './entry-tools'

/**
 * Tool Count Summary
 *
 * | Entity     | Tools | Names                                          |
 * |------------|-------|------------------------------------------------|
 * | Pages      | 4     | getPage, createPage, updatePage, deletePage    |
 * | Posts      | 4     | getPost, createPost, updatePost, deletePost    |
 * | Sections   | 5     | getSectionTemplate, getSection, createSection, updateSection, deleteSection |
 * | Navigation | 4     | getNavItem, createNavItem, updateNavItem, deleteNavItem |
 * | Images     | 3     | getImage, updateImage, deleteImage             |
 * | Entries    | 4     | getEntry, createEntry, updateEntry, deleteEntry |
 * | TOTAL      | 24    |                                                |
 */
