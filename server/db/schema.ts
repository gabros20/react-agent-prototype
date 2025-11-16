import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================================
// GLOBAL TABLES
// ============================================================================

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain"),
  previewDomain: text("preview_domain"),
  defaultEnvironmentId: text("default_environment_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isProtected: integer("is_protected", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const locales = sqliteTable("locales", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// PAGES & PAGE CONTENT
// ============================================================================

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  indexing: integer("indexing", { mode: "boolean" }).notNull().default(true),
  meta: text("meta", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pageSections = sqliteTable("page_sections", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  sectionDefId: text("section_def_id")
    .notNull()
    .references(() => sectionDefinitions.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull(),
  status: text("status", { enum: ["published", "unpublished"] })
    .notNull()
    .default("published"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pageSectionContents = sqliteTable("page_section_contents", {
  id: text("id").primaryKey(),
  pageSectionId: text("page_section_id")
    .notNull()
    .references(() => pageSections.id, { onDelete: "cascade" }),
  localeCode: text("locale_code")
    .notNull()
    .references(() => locales.code, { onDelete: "cascade" }),
  content: text("content", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// SECTION & COLLECTION DEFINITIONS
// ============================================================================

export const sectionDefinitions = sqliteTable("section_definitions", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["published", "unpublished"] })
    .notNull()
    .default("published"),
  elementsStructure: text("elements_structure", { mode: "json" }).notNull(),
  templateKey: text("template_key").notNull(),
  defaultVariant: text("default_variant").notNull().default("default"),
  cssBundle: text("css_bundle"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const collectionDefinitions = sqliteTable("collection_definitions", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["published", "unpublished"] })
    .notNull()
    .default("published"),
  elementsStructure: text("elements_structure", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// COLLECTIONS & ENTRIES
// ============================================================================

export const collectionEntries = sqliteTable("collection_entries", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id")
    .notNull()
    .references(() => collectionDefinitions.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const entryContents = sqliteTable("entry_contents", {
  id: text("id").primaryKey(),
  entryId: text("entry_id")
    .notNull()
    .references(() => collectionEntries.id, { onDelete: "cascade" }),
  localeCode: text("locale_code")
    .notNull()
    .references(() => locales.code, { onDelete: "cascade" }),
  content: text("content", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// MEDIA
// ============================================================================

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  mimeGroup: text("mime_group", { enum: ["image", "video", "audio", "document"] }).notNull(),
  width: integer("width"),
  height: integer("height"),
  duration: integer("duration"),
  alt: text("alt"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// NAVIGATIONS
// ============================================================================

export const navigations = sqliteTable("navigations", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const navigationItems = sqliteTable("navigation_items", {
  id: text("id").primaryKey(),
  navigationId: text("navigation_id")
    .notNull()
    .references(() => navigations.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  value: text("value").notNull(),
  targetType: text("target_type", {
    enum: ["page", "medium", "entry", "url", "placeholder"],
  }).notNull(),
  targetUuid: text("target_uuid"),
  url: text("url"),
  sortOrder: integer("sort_order").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// ASSISTANT TABLES
// ============================================================================

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  checkpoint: text("checkpoint", { mode: "json" }),
  workingContext: text("working_context", { mode: "json" }), // NEW: Working memory storage
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["system", "user", "assistant", "tool"] }).notNull(),
  content: text("content", { mode: "json" }).notNull(),
  toolName: text("tool_name"),
  stepIdx: integer("step_idx"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const teamsRelations = relations(teams, ({ many }) => ({
  sites: many(sites),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  team: one(teams, { fields: [sites.teamId], references: [teams.id] }),
  environments: many(environments),
  pages: many(pages),
  media: many(media),
  navigations: many(navigations),
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  site: one(sites, { fields: [environments.siteId], references: [sites.id] }),
  pages: many(pages),
  media: many(media),
  navigations: many(navigations),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, { fields: [pages.siteId], references: [sites.id] }),
  environment: one(environments, {
    fields: [pages.environmentId],
    references: [environments.id],
  }),
  pageSections: many(pageSections),
}));

export const pageSectionsRelations = relations(pageSections, ({ one, many }) => ({
  page: one(pages, { fields: [pageSections.pageId], references: [pages.id] }),
  sectionDefinition: one(sectionDefinitions, {
    fields: [pageSections.sectionDefId],
    references: [sectionDefinitions.id],
  }),
  contents: many(pageSectionContents),
}));

export const pageSectionContentsRelations = relations(pageSectionContents, ({ one }) => ({
  pageSection: one(pageSections, {
    fields: [pageSectionContents.pageSectionId],
    references: [pageSections.id],
  }),
  locale: one(locales, {
    fields: [pageSectionContents.localeCode],
    references: [locales.code],
  }),
}));

export const sectionDefinitionsRelations = relations(sectionDefinitions, ({ many }) => ({
  pageSections: many(pageSections),
}));

export const collectionDefinitionsRelations = relations(collectionDefinitions, ({ many }) => ({
  entries: many(collectionEntries),
}));

export const collectionEntriesRelations = relations(collectionEntries, ({ one, many }) => ({
  collection: one(collectionDefinitions, {
    fields: [collectionEntries.collectionId],
    references: [collectionDefinitions.id],
  }),
  contents: many(entryContents),
}));

export const entryContentsRelations = relations(entryContents, ({ one }) => ({
  entry: one(collectionEntries, {
    fields: [entryContents.entryId],
    references: [collectionEntries.id],
  }),
  locale: one(locales, { fields: [entryContents.localeCode], references: [locales.code] }),
}));

export const sessionsRelations = relations(sessions, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
}));

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const insertTeamSchema = createInsertSchema(teams);
export const selectTeamSchema = createSelectSchema(teams);

export const insertSiteSchema = createInsertSchema(sites);
export const selectSiteSchema = createSelectSchema(sites);

export const insertEnvironmentSchema = createInsertSchema(environments);
export const selectEnvironmentSchema = createSelectSchema(environments);

export const insertLocaleSchema = createInsertSchema(locales);
export const selectLocaleSchema = createSelectSchema(locales);

export const insertPageSchema = createInsertSchema(pages);
export const selectPageSchema = createSelectSchema(pages);

export const insertPageSectionSchema = createInsertSchema(pageSections);
export const selectPageSectionSchema = createSelectSchema(pageSections);

export const insertPageSectionContentSchema = createInsertSchema(pageSectionContents);
export const selectPageSectionContentSchema = createSelectSchema(pageSectionContents);

export const insertSectionDefinitionSchema = createInsertSchema(sectionDefinitions);
export const selectSectionDefinitionSchema = createSelectSchema(sectionDefinitions);

export const insertCollectionDefinitionSchema = createInsertSchema(collectionDefinitions);
export const selectCollectionDefinitionSchema = createSelectSchema(collectionDefinitions);

export const insertCollectionEntrySchema = createInsertSchema(collectionEntries);
export const selectCollectionEntrySchema = createSelectSchema(collectionEntries);

export const insertEntryContentSchema = createInsertSchema(entryContents);
export const selectEntryContentSchema = createSelectSchema(entryContents);

export const insertMediaSchema = createInsertSchema(media);
export const selectMediaSchema = createSelectSchema(media);

export const insertNavigationSchema = createInsertSchema(navigations);
export const selectNavigationSchema = createSelectSchema(navigations);

export const insertNavigationItemSchema = createInsertSchema(navigationItems);
export const selectNavigationItemSchema = createSelectSchema(navigationItems);

export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);

export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);
