/**
 * Site Settings Tools - Navigation and global site configuration
 *
 * Uses experimental_context for database access (AI SDK v6 pattern).
 * The SiteSettingsService is instantiated per-request from context.db.
 */

import { tool } from "ai";
import { z } from "zod";
import { SiteSettingsService } from "../services/cms/site-settings-service";
import type { AgentContext } from "./types";

/**
 * Get global navigation items
 */
export const getNavigationTool = tool({
  description:
    "Get the global navigation items that appear in header and footer. Returns all navigation items with their label, link, location (header/footer/both), and visibility status.",
  inputSchema: z.object({}),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    const siteSettingsService = new SiteSettingsService(ctx.db);
    try {
      const navItems = await siteSettingsService.getNavigationItems();

      return {
        success: true,
        navigationItems: navItems,
        count: navItems.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get navigation",
      };
    }
  },
});

/**
 * Add a new navigation item
 */
export const addNavigationItemTool = tool({
  description:
    "Add a new navigation item to the global navigation. Maximum 5 items allowed. The item will be visible by default. IMPORTANT: Use the page preview URL format '/pages/slug?locale=en' for page links.",
  inputSchema: z.object({
    label: z.string().describe("Navigation link text (e.g., 'Home', 'About')"),
    href: z.string().describe("Link URL. For pages use format: '/pages/slug?locale=en' (e.g., '/pages/home?locale=en', '/pages/about?locale=en')"),
    location: z
      .enum(["header", "footer", "both"])
      .describe("Where to show: 'header', 'footer', or 'both'"),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    const siteSettingsService = new SiteSettingsService(ctx.db);
    try {
      const updatedItems = await siteSettingsService.addNavigationItem({
        label: input.label,
        href: input.href,
        location: input.location,
      });

      return {
        success: true,
        message: `Added navigation item "${input.label}"`,
        navigationItems: updatedItems,
        count: updatedItems.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add navigation item",
      };
    }
  },
});

/**
 * Update an existing navigation item
 */
export const updateNavigationItemTool = tool({
  description:
    "Update an existing navigation item. Can change the label, href, location, or visibility. Find the item by its current label.",
  inputSchema: z.object({
    label: z.string().describe("Current label of the nav item to update"),
    newLabel: z.string().optional().describe("New label text (optional)"),
    newHref: z.string().optional().describe("New link URL (optional)"),
    newLocation: z
      .enum(["header", "footer", "both"])
      .optional()
      .describe("New location (optional)"),
    visible: z.boolean().optional().describe("Show or hide the item (optional)"),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    const siteSettingsService = new SiteSettingsService(ctx.db);
    try {
      const updates: { label?: string; href?: string; location?: "header" | "footer" | "both"; visible?: boolean } = {};
      if (input.newLabel) updates.label = input.newLabel;
      if (input.newHref) updates.href = input.newHref;
      if (input.newLocation) updates.location = input.newLocation;
      if (input.visible !== undefined) updates.visible = input.visible;

      const updatedItems = await siteSettingsService.updateNavigationItem(input.label, updates);

      return {
        success: true,
        message: `Updated navigation item "${input.label}"`,
        navigationItems: updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update navigation item",
      };
    }
  },
});

/**
 * Remove a navigation item
 */
export const removeNavigationItemTool = tool({
  description:
    "Remove a navigation item from the global navigation by its label.",
  inputSchema: z.object({
    label: z.string().describe("Label of the nav item to remove"),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    const siteSettingsService = new SiteSettingsService(ctx.db);
    try {
      const updatedItems = await siteSettingsService.removeNavigationItem(input.label);

      return {
        success: true,
        message: `Removed navigation item "${input.label}"`,
        navigationItems: updatedItems,
        count: updatedItems.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove navigation item",
      };
    }
  },
});

/**
 * Toggle navigation item visibility
 */
export const toggleNavigationItemTool = tool({
  description:
    "Toggle the visibility of a navigation item (show/hide). Finds the item by label and flips its visibility state.",
  inputSchema: z.object({
    label: z.string().describe("Label of the nav item to toggle"),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    const siteSettingsService = new SiteSettingsService(ctx.db);
    try {
      const updatedItems = await siteSettingsService.toggleNavigationItemVisibility(input.label);
      const item = updatedItems.find((navItem) => navItem.label === input.label);

      return {
        success: true,
        message: `Navigation item "${input.label}" is now ${item?.visible ? "visible" : "hidden"}`,
        navigationItems: updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to toggle navigation item",
      };
    }
  },
});
