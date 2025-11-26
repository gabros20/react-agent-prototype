/**
 * Navigation Classifier
 * Determines suggested navigation placement based on page type
 */

export type NavigationLocation = 'header' | 'footer' | 'both'

export interface NavigationSuggestion {
  suggestedLocation: NavigationLocation
  reason: string
  message: string
}

// Footer-only pages (legal, policy)
const FOOTER_ONLY_PATTERNS = [
  'privacy',
  'policy',
  'terms',
  'conditions',
  'legal',
  'disclaimer',
  'cookie',
  'gdpr',
  'compliance',
  'license',
  'copyright',
  'imprint',
  'accessibility',
  'sitemap'
]

// Pages that should appear in both header and footer
const BOTH_PATTERNS = ['about', 'contact', 'services']

// Primary header pages
const HEADER_PATTERNS = [
  'home',
  'products',
  'pricing',
  'team',
  'blog',
  'portfolio',
  'work',
  'features',
  'solutions',
  'resources',
  'faq',
  'careers'
]

/**
 * Classify a page for navigation placement
 * Returns suggestion with location, reason, and user-facing message
 */
export function classifyPageForNavigation(
  pageName: string,
  pageSlug: string
): NavigationSuggestion {
  const normalized = `${pageName} ${pageSlug}`.toLowerCase()

  // Check footer-only patterns first (legal/policy pages)
  for (const pattern of FOOTER_ONLY_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        suggestedLocation: 'footer',
        reason: `"${pageName}" appears to be a legal/policy page`,
        message: `I suggest adding "${pageName}" to the footer only, as policy/legal pages typically belong there. Would you like me to add it to the navigation?`
      }
    }
  }

  // Check both patterns (important pages that benefit from prominent placement)
  for (const pattern of BOTH_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        suggestedLocation: 'both',
        reason: `"${pageName}" is a key page that benefits from prominent placement`,
        message: `I suggest adding "${pageName}" to both header and footer navigation since it's an important page. Would you like me to add it?`
      }
    }
  }

  // Check header patterns
  for (const pattern of HEADER_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        suggestedLocation: 'header',
        reason: `"${pageName}" is a primary navigation page`,
        message: `I suggest adding "${pageName}" to the header navigation. Would you like me to add it?`
      }
    }
  }

  // Default: header only for any other page
  return {
    suggestedLocation: 'header',
    reason: 'Default placement for new pages',
    message: `Would you like me to add "${pageName}" to the navigation? I suggest the header.`
  }
}
