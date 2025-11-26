/**
 * Page Content Generator
 * Generates contextual content based on page name for default sections
 */

export interface HeroContent {
  title: string
  subtitle: string
  image?: { url: string; alt: string } | null
  ctaText: string | null
  ctaLink: { type: string; href: string } | null
}

export interface PageMeta {
  title: string
  description: string
}

export interface ImageInfo {
  id: string
  url: string
  alt?: string
  description?: string
  tags?: string[]
}

// Content patterns based on page name keywords
const PAGE_CONTENT_PATTERNS: Record<string, { hero: Partial<HeroContent> }> = {
  about: {
    hero: {
      title: 'About Our Company',
      subtitle: 'Learn about our journey, mission, and the team behind our success',
      ctaText: 'Meet the Team',
      ctaLink: { type: 'url', href: '#team' }
    }
  },
  contact: {
    hero: {
      title: 'Get In Touch',
      subtitle: "We'd love to hear from you. Reach out and let's start a conversation",
      ctaText: 'Send Message',
      ctaLink: { type: 'url', href: '#contact-form' }
    }
  },
  services: {
    hero: {
      title: 'Our Services',
      subtitle: 'Discover how we can help you achieve your goals',
      ctaText: 'View Services',
      ctaLink: { type: 'url', href: '#services' }
    }
  },
  products: {
    hero: {
      title: 'Our Products',
      subtitle: 'Explore our range of innovative solutions',
      ctaText: 'Browse Products',
      ctaLink: { type: 'url', href: '#products' }
    }
  },
  team: {
    hero: {
      title: 'Meet Our Team',
      subtitle: 'The talented people driving our mission forward',
      ctaText: 'Learn More',
      ctaLink: { type: 'url', href: '#team-members' }
    }
  },
  pricing: {
    hero: {
      title: 'Simple, Transparent Pricing',
      subtitle: 'Choose the plan that works best for you',
      ctaText: 'View Plans',
      ctaLink: { type: 'url', href: '#pricing-plans' }
    }
  },
  privacy: {
    hero: {
      title: 'Privacy Policy',
      subtitle: 'How we collect, use, and protect your information',
      ctaText: null,
      ctaLink: null
    }
  },
  terms: {
    hero: {
      title: 'Terms of Service',
      subtitle: 'Please read these terms carefully before using our services',
      ctaText: null,
      ctaLink: null
    }
  },
  faq: {
    hero: {
      title: 'Frequently Asked Questions',
      subtitle: 'Find answers to common questions about our products and services',
      ctaText: 'Contact Support',
      ctaLink: { type: 'url', href: '/pages/contact?locale=en' }
    }
  },
  careers: {
    hero: {
      title: 'Join Our Team',
      subtitle: "We're always looking for talented individuals to help us grow",
      ctaText: 'View Openings',
      ctaLink: { type: 'url', href: '#openings' }
    }
  },
  portfolio: {
    hero: {
      title: 'Our Work',
      subtitle: 'See examples of what we can do for you',
      ctaText: 'View Projects',
      ctaLink: { type: 'url', href: '#projects' }
    }
  },
  features: {
    hero: {
      title: 'Features',
      subtitle: 'Powerful tools designed to help you succeed',
      ctaText: 'Get Started',
      ctaLink: { type: 'url', href: '#features' }
    }
  }
}

// Keywords for image matching by page type
const PAGE_IMAGE_KEYWORDS: Record<string, string[]> = {
  about: ['team', 'office', 'company', 'people', 'meeting', 'corporate'],
  contact: ['contact', 'phone', 'email', 'office', 'support'],
  services: ['service', 'work', 'professional', 'business'],
  products: ['product', 'showcase', 'item', 'display'],
  team: ['team', 'people', 'employee', 'staff', 'group'],
  careers: ['office', 'work', 'career', 'job', 'team'],
  portfolio: ['work', 'project', 'design', 'creative']
}

/**
 * Generate hero section content based on page name
 */
export function generateHeroContent(
  pageName: string,
  pageSlug: string,
  image?: ImageInfo | null
): HeroContent {
  const normalizedName = pageName.toLowerCase()

  // Match against known patterns
  for (const [pattern, content] of Object.entries(PAGE_CONTENT_PATTERNS)) {
    if (normalizedName.includes(pattern)) {
      return {
        title: content.hero.title || pageName,
        subtitle: content.hero.subtitle || `Welcome to ${pageName}`,
        image: image ? { url: image.url, alt: image.alt || image.description || pageName } : null,
        ctaText: content.hero.ctaText ?? 'Learn More',
        ctaLink: content.hero.ctaLink ?? { type: 'url', href: '#content' }
      }
    }
  }

  // Default content when no pattern matches
  return {
    title: pageName,
    subtitle: `Welcome to ${pageName}. Explore what we have to offer.`,
    image: image ? { url: image.url, alt: image.alt || image.description || pageName } : null,
    ctaText: 'Learn More',
    ctaLink: { type: 'url', href: '#content' }
  }
}

/**
 * Generate page metadata based on page name
 */
export function generateMetadata(pageName: string): PageMeta {
  return {
    title: pageName,
    description: `Learn more about ${pageName.toLowerCase()}`
  }
}

/**
 * Generate URL-friendly slug from page name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/-+/g, '-') // Multiple hyphens to single
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
    .substring(0, 64) // Max length per validation
}

/**
 * Select the most appropriate image for a page based on its name/type
 * Returns the best matching image or a random one if no match found
 */
export function selectImageForPage(
  pageName: string,
  images: ImageInfo[]
): ImageInfo | null {
  if (!images || images.length === 0) {
    return null
  }

  const normalizedName = pageName.toLowerCase()

  // Find keywords for this page type
  let searchKeywords: string[] = []
  for (const [pattern, keywords] of Object.entries(PAGE_IMAGE_KEYWORDS)) {
    if (normalizedName.includes(pattern)) {
      searchKeywords = keywords
      break
    }
  }

  // If we have keywords, try to find a matching image
  if (searchKeywords.length > 0) {
    for (const image of images) {
      const imageText = [
        image.description || '',
        ...(image.tags || []),
        image.alt || ''
      ]
        .join(' ')
        .toLowerCase()

      // Check if any keyword matches
      for (const keyword of searchKeywords) {
        if (imageText.includes(keyword)) {
          return image
        }
      }
    }
  }

  // No contextual match - pick random image
  const randomIndex = Math.floor(Math.random() * images.length)
  return images[randomIndex]
}
