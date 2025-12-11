/**
 * Atomic Navigation Tools - Unified CRUD operations
 * Phase 1: Merged navigation tools
 * - cms_getNavigation → getNavItem
 * - cms_addNavigationItem → createNavItem
 * - cms_updateNavigationItem + cms_toggleNavigationItem → updateNavItem
 * - cms_removeNavigationItem → deleteNavItem
 *
 * Following ATOMIC_CRUD_TOOL_ARCHITECTURE.md patterns
 */

import { tool } from 'ai'
import { z } from 'zod'
import { SiteSettingsService } from '../../services/cms/site-settings-service'
import type { AgentContext } from '../types'

// ============================================================================
// getNavItem - Get navigation item(s)
// ============================================================================

export const getNavItem = tool({
  description: 'Get navigation item(s). By label or all.',
  inputSchema: z.object({
    // Scope selection
    label: z.string().optional().describe('Get single item by label'),
    all: z.boolean().optional().default(true).describe('Get all navigation items (default)'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const siteSettingsService = new SiteSettingsService(ctx.db)

    try {
      const navItems = await siteSettingsService.getNavigationItems()

      // Case 1: Get by label
      if (input.label) {
        const item = navItems.find((n: any) => n.label === input.label)
        if (!item) {
          return { success: false, count: 0, items: [], error: `Navigation item not found: ${input.label}` }
        }
        return {
          success: true,
          count: 1,
          items: [item]
        }
      }

      // Case 2: Get all (default)
      return {
        success: true,
        count: navItems.length,
        items: navItems
      }
    } catch (error) {
      return {
        success: false,
        count: 0,
        items: [],
        error: error instanceof Error ? error.message : 'Failed to get navigation'
      }
    }
  }
})

// ============================================================================
// createNavItem - Add navigation item
// ============================================================================

export const createNavItem = tool({
  description: 'Add navigation item. Location: header/footer/both.',
  inputSchema: z.object({
    label: z.string().describe('Navigation link text (e.g., "Home", "About")'),
    href: z.string().describe('Link URL (for pages: "/pages/slug?locale=en")'),
    location: z.enum(['header', 'footer', 'both']).describe('Where to show'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const siteSettingsService = new SiteSettingsService(ctx.db)

    try {
      const updatedItems = await siteSettingsService.addNavigationItem({
        label: input.label,
        href: input.href,
        location: input.location,
      })

      return {
        success: true,
        message: `Added navigation item "${input.label}"`,
        count: updatedItems.length,
        items: updatedItems
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add navigation item'
      }
    }
  }
})

// ============================================================================
// updateNavItem - Update navigation item (including visibility toggle)
// ============================================================================

export const updateNavItem = tool({
  description: 'Update nav item. Set visible: false to hide.',
  inputSchema: z.object({
    label: z.string().describe('Current label of item to update'),
    newLabel: z.string().optional().describe('New label text'),
    href: z.string().optional().describe('New link URL'),
    location: z.enum(['header', 'footer', 'both']).optional().describe('New location'),
    visible: z.boolean().optional().describe('Show or hide the item'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const siteSettingsService = new SiteSettingsService(ctx.db)

    try {
      // Build updates object
      const updates: { label?: string; href?: string; location?: 'header' | 'footer' | 'both'; visible?: boolean } = {}
      if (input.newLabel) updates.label = input.newLabel
      if (input.href) updates.href = input.href
      if (input.location) updates.location = input.location
      if (input.visible !== undefined) updates.visible = input.visible

      const updatedItems = await siteSettingsService.updateNavigationItem(input.label, updates)
      const item = updatedItems.find((navItem: any) => navItem.label === (input.newLabel || input.label))

      return {
        success: true,
        message: `Updated navigation item "${input.label}"${input.visible !== undefined ? ` (now ${item?.visible ? 'visible' : 'hidden'})` : ''}`,
        items: updatedItems
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update navigation item'
      }
    }
  }
})

// ============================================================================
// deleteNavItem - Remove navigation item(s)
// ============================================================================

export const deleteNavItem = tool({
  description: 'Remove navigation item(s). Array param.',
  inputSchema: z.object({
    labels: z.array(z.string()).describe('Labels of items to remove (always array, even for single)'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    const siteSettingsService = new SiteSettingsService(ctx.db)

    try {
      const deleted: string[] = []
      let updatedItems: any[] = []

      for (const label of input.labels) {
        try {
          updatedItems = await siteSettingsService.removeNavigationItem(label)
          deleted.push(label)
        } catch (error) {
          // Continue with remaining items
        }
      }

      if (deleted.length === 0) {
        return { success: false, error: 'No navigation items found with provided labels' }
      }

      return {
        success: true,
        message: `Removed ${deleted.length} navigation item(s)`,
        deleted,
        count: updatedItems.length,
        items: updatedItems
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove navigation item(s)'
      }
    }
  }
})
