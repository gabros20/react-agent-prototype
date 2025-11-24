import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import nunjucks from "nunjucks";
import type { PageService } from "./cms/page-service";
import { db } from "../db/client";
import { SiteSettingsService } from "./cms/site-settings-service";

export interface TemplateRegistry {
  [templateKey: string]: { variants: string[]; path: string };
}

export class RendererService {
  private env: nunjucks.Environment;
  private templateRegistry: TemplateRegistry = {};
  private siteSettingsService: SiteSettingsService;

  constructor(private templateDir: string) {
    this.siteSettingsService = new SiteSettingsService(db);
    this.env = nunjucks.configure(templateDir, {
      autoescape: true,
      watch: process.env.NODE_ENV === "development",
      noCache: process.env.NODE_ENV === "development",
    });

    this.env.addFilter("markdown", (str: string) => {
      if (!str) return "";
      return marked.parse(str);
    });

    this.env.addFilter("truncate", (str: string, length: number) => {
      if (!str || str.length <= length) return str;
      return `${str.slice(0, length)}...`;
    });

    this.env.addFilter("asset", (assetPath: string) => {
      return `/assets/${assetPath}`;
    });

    this.env.addFilter("normalizeLink", (link: any) => {
      // Handle null/undefined
      if (!link) return null;

      // If already an object with href, return as-is
      if (typeof link === "object" && link.href) {
        return link;
      }

      // If string, wrap in object structure
      if (typeof link === "string") {
        return { href: link, type: "url" };
      }

      return null;
    });

    this.buildRegistry();
  }

  private buildRegistry() {
    const sectionsDir = path.join(this.templateDir, "sections");

    if (!fs.existsSync(sectionsDir)) {
      console.warn("Sections directory not found:", sectionsDir);
      return;
    }

    const templateKeys = fs
      .readdirSync(sectionsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const templateKey of templateKeys) {
      const templatePath = path.join(sectionsDir, templateKey);
      const variants = fs
        .readdirSync(templatePath)
        .filter((file) => file.endsWith(".njk"))
        .map((file) => file.replace(".njk", ""));

      this.templateRegistry[templateKey] = {
        variants,
        path: `sections/${templateKey}`,
      };
    }

    console.log("✅ Template registry built:", this.templateRegistry);
  }

  async renderPage(pageSlug: string, locale: string, pageService: PageService): Promise<string> {
    // Preview server always needs full content
    const page = await pageService.getPageBySlug(pageSlug, true, locale);

    if (!page) {
      throw new Error(`Page not found: ${pageSlug}`);
    }

    // Fetch global navigation items
    const globalNavItems = await this.siteSettingsService.getNavigationItems();
    const currentYear = new Date().getFullYear();

    const sectionHtmlList: string[] = [];

    if (!page.pageSections || page.pageSections.length === 0) {
      console.warn(`No sections found for page: ${pageSlug}`);
    } else {
      for (const pageSection of page.pageSections) {
        const sectionDef = pageSection.sectionDefinition;
        const templateKey = sectionDef.templateKey;
        const variant = sectionDef.defaultVariant || "default";

        // After hybrid content fetching, content is directly on pageSection
        const contentData = pageSection.content || {};

        const templatePath = this.resolveTemplate(templateKey, variant);

        const sectionHtml = this.env.render(templatePath, {
          ...contentData,
          sectionKey: sectionDef.key,
          locale,
          globalNavItems,
          currentYear,
        });

        sectionHtmlList.push(sectionHtml);
      }
    }

    const html = this.env.render("layout/page.njk", {
      page,
      locale,
      content: sectionHtmlList.join("\n"),
      globalNavItems,
      currentYear,
    });

    return html;
  }

  private resolveTemplate(templateKey: string, variant: string): string {
    const registry = this.templateRegistry[templateKey];

    if (!registry) {
      console.warn(`Template not found: ${templateKey}, using fallback`);
      return "sections/_default.njk";
    }

    if (!registry.variants.includes(variant)) {
      console.warn(`Variant '${variant}' not found for ${templateKey}, using default`);
      variant = "default";
    }

    return `${registry.path}/${variant}.njk`;
  }

  getTemplateRegistry(): TemplateRegistry {
    return this.templateRegistry;
  }
}
