import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../../db/client";
import * as schema from "../../db/schema";

export interface NavigationItem {
  label: string;
  href: string;
  location: "header" | "footer" | "both";
  visible: boolean;
}

export class SiteSettingsService {
  constructor(public db: DrizzleDB) {}

  /**
   * Get a setting by key
   */
  async getSetting(key: string): Promise<any | null> {
    const setting = await this.db.query.siteSettings.findFirst({
      where: eq(schema.siteSettings.key, key),
    });

    if (!setting) {
      return null;
    }

    return setting.value;
  }

  /**
   * Set/update a setting
   */
  async setSetting(key: string, value: any): Promise<void> {
    const existing = await this.db.query.siteSettings.findFirst({
      where: eq(schema.siteSettings.key, key),
    });

    if (existing) {
      await this.db
        .update(schema.siteSettings)
        .set({
          value: value,
          updatedAt: new Date(),
        })
        .where(eq(schema.siteSettings.id, existing.id));
    } else {
      await this.db.insert(schema.siteSettings).values({
        id: randomUUID(),
        key,
        value: value,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Get global navigation items
   */
  async getNavigationItems(): Promise<NavigationItem[]> {
    const navItems = await this.getSetting("navigation");

    if (!navItems || !Array.isArray(navItems)) {
      return this.getDefaultNavigation();
    }

    return navItems as NavigationItem[];
  }

  /**
   * Update global navigation items
   */
  async updateNavigationItems(items: NavigationItem[]): Promise<void> {
    // Validate navigation items
    for (const item of items) {
      if (!item.label || !item.href) {
        throw new Error("Navigation items must have label and href");
      }
      if (!["header", "footer", "both"].includes(item.location)) {
        throw new Error("Invalid location value");
      }
    }

    // Limit to 5 items
    if (items.length > 5) {
      throw new Error("Maximum 5 navigation items allowed");
    }

    await this.setSetting("navigation", items);
  }

  /**
   * Add a navigation item
   */
  async addNavigationItem(item: Omit<NavigationItem, "visible">): Promise<NavigationItem[]> {
    const currentItems = await this.getNavigationItems();

    if (currentItems.length >= 5) {
      throw new Error("Maximum 5 navigation items allowed");
    }

    const newItem: NavigationItem = {
      ...item,
      visible: true, // Default to visible
    };

    const updatedItems = [...currentItems, newItem];
    await this.updateNavigationItems(updatedItems);

    return updatedItems;
  }

  /**
   * Update a specific navigation item by label
   */
  async updateNavigationItem(
    label: string,
    updates: Partial<NavigationItem>,
  ): Promise<NavigationItem[]> {
    const currentItems = await this.getNavigationItems();
    const itemIndex = currentItems.findIndex((item) => item.label === label);

    if (itemIndex === -1) {
      throw new Error(`Navigation item "${label}" not found`);
    }

    currentItems[itemIndex] = {
      ...currentItems[itemIndex],
      ...updates,
    };

    await this.updateNavigationItems(currentItems);
    return currentItems;
  }

  /**
   * Remove a navigation item by label
   */
  async removeNavigationItem(label: string): Promise<NavigationItem[]> {
    const currentItems = await this.getNavigationItems();
    const updatedItems = currentItems.filter((item) => item.label !== label);

    if (updatedItems.length === currentItems.length) {
      throw new Error(`Navigation item "${label}" not found`);
    }

    await this.updateNavigationItems(updatedItems);
    return updatedItems;
  }

  /**
   * Toggle navigation item visibility
   */
  async toggleNavigationItemVisibility(label: string): Promise<NavigationItem[]> {
    const currentItems = await this.getNavigationItems();
    const item = currentItems.find((item) => item.label === label);

    if (!item) {
      throw new Error(`Navigation item "${label}" not found`);
    }

    return this.updateNavigationItem(label, { visible: !item.visible });
  }

  /**
   * Default navigation structure
   */
  private getDefaultNavigation(): NavigationItem[] {
    return [
      {
        label: "Home",
        href: "/",
        location: "both",
        visible: true,
      },
      {
        label: "About",
        href: "/about",
        location: "both",
        visible: true,
      },
      {
        label: "Contact",
        href: "/contact",
        location: "header",
        visible: true,
      },
    ];
  }
}
