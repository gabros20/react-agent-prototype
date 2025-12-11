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

    this.env.addFilter("date", (dateValue: any, format: string) => {
      if (!dateValue) return "";

      let date: Date;

      // Handle different date formats
      if (dateValue instanceof Date) {
        date = dateValue;
      } else if (typeof dateValue === "string") {
        date = new Date(dateValue);
      } else if (typeof dateValue === "number") {
        date = new Date(dateValue);
      } else {
        return "";
      }

      // Simple date formatting (could use a library like date-fns for more formats)
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      // Support common formats
      if (format === "MMMM D, YYYY") {
        return `${months[month]} ${day}, ${year}`;
      } else if (format === "MMM D, YYYY") {
        return `${shortMonths[month]} ${day}, ${year}`;
      } else if (format === "YYYY-MM-DD") {
        return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }

      // Default format
      return date.toLocaleDateString();
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

    if (!(page as any).pageSections || (page as any).pageSections.length === 0) {
      console.warn(`No sections found for page: ${pageSlug}`);
    } else {
      for (const pageSection of (page as any).pageSections) {
        const sectionTemplate = pageSection.sectionTemplate;
        const templateKey = sectionTemplate.templateFile; // RENAMED: templateKey → templateFile
        const variant = sectionTemplate.defaultVariant || "default";

        // After hybrid content fetching, content is directly on pageSection
        const contentData = pageSection.content || {};

        const templatePath = this.resolveTemplate(templateKey, variant);

        const sectionHtml = this.env.render(templatePath, {
          ...contentData,
          sectionKey: sectionTemplate.key,
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

  /**
   * Render a single blog post
   * @param entry - Post entry with content
   * @param locale - Locale code
   * @param collectionSlug - Collection slug (e.g., 'blog')
   */
  async renderPost(entry: any, locale: string, collectionSlug: string): Promise<string> {
    // Fetch global navigation items
    const globalNavItems = await this.siteSettingsService.getNavigationItems();
    const currentYear = new Date().getFullYear();

    // Render header if exists
    let headerHtml = "";
    try {
      const headerPath = "sections/header/default.njk";
      headerHtml = this.env.render(headerPath, {
        globalNavItems,
        currentYear,
        locale,
      });
    } catch (error) {
      console.warn("Header template not found, skipping");
    }

    // Render footer if exists
    let footerHtml = "";
    try {
      const footerPath = "sections/footer/default.njk";
      footerHtml = this.env.render(footerPath, {
        globalNavItems,
        currentYear,
        locale,
      });
    } catch (error) {
      console.warn("Footer template not found, skipping");
    }

    // Render post content
    const postTemplatePath = `posts/${collectionSlug}/single.njk`;
    const postHtml = this.env.render(postTemplatePath, {
      ...entry,
      ...entry.content,
      locale,
      globalNavItems,
      currentYear,
    });

    // Wrap in layout
    const html = this.env.render("posts/layout/post.njk", {
      post: entry,
      locale,
      content: postHtml,
      header: headerHtml,
      footer: footerHtml,
      globalNavItems,
      currentYear,
    });

    return html;
  }

  /**
   * Render a list of blog posts
   * @param entries - Array of post entries
   * @param collectionSlug - Collection slug (e.g., 'blog')
   * @param collectionName - Display name for the collection
   * @param locale - Locale code
   */
  async renderPostList(
    entries: any[],
    collectionSlug: string,
    collectionName: string,
    locale: string,
    collectionDescription?: string
  ): Promise<string> {
    // Fetch global navigation items
    const globalNavItems = await this.siteSettingsService.getNavigationItems();
    const currentYear = new Date().getFullYear();

    // Render header if exists
    let headerHtml = "";
    try {
      const headerPath = "sections/header/default.njk";
      headerHtml = this.env.render(headerPath, {
        globalNavItems,
        currentYear,
        locale,
      });
    } catch (error) {
      console.warn("Header template not found, skipping");
    }

    // Render footer if exists
    let footerHtml = "";
    try {
      const footerPath = "sections/footer/default.njk";
      footerHtml = this.env.render(footerPath, {
        globalNavItems,
        currentYear,
        locale,
      });
    } catch (error) {
      console.warn("Footer template not found, skipping");
    }

    // Render list content
    const listTemplatePath = `posts/${collectionSlug}/list.njk`;
    const listHtml = this.env.render(listTemplatePath, {
      posts: entries,
      collectionName,
      collectionDescription,
      locale,
      globalNavItems,
      currentYear,
    });

    // Wrap in layout
    const html = this.env.render("posts/layout/post.njk", {
      post: { title: collectionName },
      locale,
      content: listHtml,
      header: headerHtml,
      footer: footerHtml,
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
