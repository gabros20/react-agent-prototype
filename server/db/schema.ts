import { relations } from "drizzle-orm";
import { blob, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
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

// Environment-Locale junction table (production aligned)
export const environmentLocales = sqliteTable("environment_locales", {
  id: text("id").primaryKey(),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  localeCode: text("locale_code")
    .notNull()
    .references(() => locales.code, { onDelete: "cascade" }),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  status: text("status", { enum: ["active", "inactive"] }).default("active"),
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
  parentId: text("parent_id"), // Self-reference handled in relations
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  isProtected: integer("is_protected", { mode: "boolean" }).default(false), // NEW: Default page flag
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
  sectionTemplateId: text("section_template_id") // RENAMED: sectionDefId → sectionTemplateId
    .notNull()
    .references(() => sectionTemplates.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull(),
  status: text("status", { enum: ["published", "unpublished", "draft"] }) // UPDATED: Added draft
    .notNull()
    .default("published"),
  hidden: integer("hidden", { mode: "boolean" }).default(false), // NEW: Visibility toggle
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
// SECTION & COLLECTION TEMPLATES (RENAMED from Definitions)
// ============================================================================

// RENAMED: sectionDefinitions → sectionTemplates
export const sectionTemplates = sqliteTable("section_templates", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["published", "unpublished"] })
    .notNull()
    .default("published"),
  fields: text("fields", { mode: "json" }).notNull(), // RENAMED: elementsStructure → fields
  templateFile: text("template_file").notNull(), // RENAMED: templateKey → templateFile
  defaultVariant: text("default_variant").notNull().default("default"),
  cssBundle: text("css_bundle"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// RENAMED: collectionDefinitions → collectionTemplates
export const collectionTemplates = sqliteTable("collection_templates", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["published", "unpublished"] })
    .notNull()
    .default("published"),
  fields: text("fields", { mode: "json" }).notNull(), // RENAMED: elementsStructure → fields
  hasSlug: integer("has_slug", { mode: "boolean" }).default(true), // NEW: Entry slug support
  orderDirection: text("order_direction", { enum: ["asc", "desc"] }).default("desc"), // NEW: Entry ordering
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
    .references(() => collectionTemplates.id, { onDelete: "cascade" }), // UPDATED: Reference collectionTemplates
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  // Post metadata
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  author: text("author"),
  excerpt: text("excerpt"),
  featuredImage: text("featured_image"), // URL to cover image
  category: text("category"),
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
// IMAGES (AI-Powered with Metadata & Embeddings)
// ============================================================================

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  mediaType: text("media_type").notNull(),

  // Storage approach
  storageType: text("storage_type", {
    enum: ["filesystem", "cdn", "blob"]
  }).notNull().default("filesystem"),
  filePath: text("file_path"),
  cdnUrl: text("cdn_url"),

  // Thumbnail BLOB for fast access
  thumbnailData: blob("thumbnail_data", { mode: "buffer" }),

  // Technical metadata
  fileSize: integer("file_size").notNull(), // bytes
  width: integer("width"),
  height: integer("height"),

  // Checksums for deduplication
  md5Hash: text("md5_hash"),
  sha256Hash: text("sha256_hash").unique(),

  // Processing status
  status: text("status", {
    enum: ["processing", "completed", "failed"]
  }).notNull().default("processing"),
  error: text("error"),

  // Timestamps
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull(),
  processedAt: integer("processed_at", { mode: "timestamp" }),
});

export const imageMetadata = sqliteTable("image_metadata", {
  id: text("id").primaryKey(),
  imageId: text("image_id")
    .notNull()
    .references(() => images.id, { onDelete: "cascade" })
    .unique(),

  // AI-generated descriptions
  description: text("description"), // 1-2 sentence summary
  detailedDescription: text("detailed_description"), // Longer description

  // Keywords and categorization
  tags: text("tags", { mode: "json" }), // Array of string tags
  categories: text("categories", { mode: "json" }), // Array of categories
  objects: text("objects", { mode: "json" }), // Array of {name, confidence}

  // Visual properties
  colors: text("colors", { mode: "json" }), // {dominant: [], palette: []}
  mood: text("mood"), // e.g., "cheerful", "professional"
  style: text("style"), // e.g., "minimalist", "vintage"
  composition: text("composition", { mode: "json" }), // {orientation, subject, background}

  // Searchable text (concatenated for full-text search)
  searchableText: text("searchable_text"),

  // Alt text (user-editable)
  altText: text("alt_text"),
  caption: text("caption"),

  // External source tracking (for deduplication)
  source: text("source"), // e.g., "pexels:12345", "unsplash:abc", null for uploads

  // Metadata about metadata
  generatedAt: integer("generated_at", { mode: "timestamp" }),
  model: text("model"), // e.g., "gpt-4o-mini"
});

export const imageVariants = sqliteTable("image_variants", {
  id: text("id").primaryKey(),
  imageId: text("image_id")
    .notNull()
    .references(() => images.id, { onDelete: "cascade" }),

  variantType: text("variant_type", {
    enum: ["thumbnail", "small", "medium", "large", "original"]
  }).notNull(),

  format: text("format", {
    enum: ["jpeg", "png", "webp", "avif"]
  }).notNull(),

  width: integer("width").notNull(),
  height: integer("height").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  cdnUrl: text("cdn_url"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// SITE SETTINGS
// Navigation is stored as JSON in site_settings table under key "navigation"
// ============================================================================

export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// ASSISTANT TABLES
// ============================================================================

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  modelId: text("model_id").default("openai/gpt-4o-mini"), // Selected model for this session
  workingContext: text("working_context", { mode: "json" }), // Working memory storage
  // Compaction tracking
  compactionCount: integer("compaction_count").default(0), // How many times compaction occurred
  lastCompactionAt: integer("last_compaction_at"), // Unix timestamp
  currentlyCompacting: integer("currently_compacting", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["system", "user", "assistant", "tool"] }).notNull(),
  content: text("content", { mode: "json" }).notNull(), // AI SDK format for LLM context
  displayContent: text("display_content"), // Plain text for UI rendering (nullable for tool messages)
  toolName: text("tool_name"),
  stepIdx: integer("step_idx"),
  // Compaction tracking
  tokens: integer("tokens").default(0), // Cached token count
  isSummary: integer("is_summary", { mode: "boolean" }).default(false), // Is this a compaction summary?
  isCompactionTrigger: integer("is_compaction_trigger", { mode: "boolean" }).default(false), // Is this a compaction trigger user msg?
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Message parts table for rich structure tracking
export const messageParts = sqliteTable("message_parts", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["text", "tool-call", "tool-result", "compaction-marker"] }).notNull(),
  content: text("content", { mode: "json" }).notNull(), // JSON content based on type
  tokens: integer("tokens").default(0),
  compactedAt: integer("compacted_at"), // Unix timestamp if compacted
  sortOrder: integer("sort_order").notNull(), // Order within message
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Conversation logs store detailed trace entries for each user->agent exchange
export const conversationLogs = sqliteTable("conversation_logs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  conversationIndex: integer("conversation_index").notNull(), // 1, 2, 3... ordering within session
  userPrompt: text("user_prompt").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  // Metrics: tokens, cost, duration, toolCalls, steps, errors
  metrics: text("metrics", { mode: "json" }).$type<{
    totalDuration: number;
    toolCallCount: number;
    stepCount: number;
    tokens: { input: number; output: number };
    cost: number;
    errorCount: number;
  }>(),
  // Model info: modelId, pricing
  modelInfo: text("model_info", { mode: "json" }).$type<{
    modelId: string;
    pricing: { prompt: number; completion: number } | null;
  }>(),
  // All trace entries for this conversation as JSON array
  entries: text("entries", { mode: "json" }).$type<Array<{
    id: string;
    traceId: string;
    parentId?: string;
    timestamp: number;
    duration?: number;
    type: string;
    level: string;
    stepNumber?: number;
    toolName?: string;
    toolCallId?: string;
    summary: string;
    input?: unknown;
    output?: unknown;
    tokens?: { input: number; output: number };
    error?: { message: string; stack?: string };
    jobId?: string;
    jobProgress?: number;
  }>>(),
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
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  site: one(sites, { fields: [environments.siteId], references: [sites.id] }),
  pages: many(pages),
  locales: many(environmentLocales),
}));

export const environmentLocalesRelations = relations(environmentLocales, ({ one }) => ({
  environment: one(environments, { fields: [environmentLocales.environmentId], references: [environments.id] }),
  locale: one(locales, { fields: [environmentLocales.localeCode], references: [locales.code] }),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, { fields: [pages.siteId], references: [sites.id] }),
  environment: one(environments, {
    fields: [pages.environmentId],
    references: [environments.id],
  }),
  parent: one(pages, { fields: [pages.parentId], references: [pages.id], relationName: "pageHierarchy" }), // NEW
  children: many(pages, { relationName: "pageHierarchy" }), // NEW
  pageSections: many(pageSections),
}));

export const pageSectionsRelations = relations(pageSections, ({ one, many }) => ({
  page: one(pages, { fields: [pageSections.pageId], references: [pages.id] }),
  sectionTemplate: one(sectionTemplates, { // RENAMED: sectionDefinition → sectionTemplate
    fields: [pageSections.sectionTemplateId],
    references: [sectionTemplates.id],
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

// RENAMED: sectionDefinitionsRelations → sectionTemplatesRelations
export const sectionTemplatesRelations = relations(sectionTemplates, ({ many }) => ({
  pageSections: many(pageSections),
}));

// RENAMED: collectionDefinitionsRelations → collectionTemplatesRelations
export const collectionTemplatesRelations = relations(collectionTemplates, ({ many }) => ({
  entries: many(collectionEntries),
}));

export const collectionEntriesRelations = relations(collectionEntries, ({ one, many }) => ({
  collection: one(collectionTemplates, { // UPDATED: Reference collectionTemplates
    fields: [collectionEntries.collectionId],
    references: [collectionTemplates.id],
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
  conversationLogs: many(conversationLogs),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
  parts: many(messageParts),
}));

export const messagePartsRelations = relations(messageParts, ({ one }) => ({
  message: one(messages, { fields: [messageParts.messageId], references: [messages.id] }),
  session: one(sessions, { fields: [messageParts.sessionId], references: [sessions.id] }),
}));

export const conversationLogsRelations = relations(conversationLogs, ({ one }) => ({
  session: one(sessions, { fields: [conversationLogs.sessionId], references: [sessions.id] }),
}));

export const imagesRelations = relations(images, ({ one, many }) => ({
  metadata: one(imageMetadata, {
    fields: [images.id],
    references: [imageMetadata.imageId],
  }),
  variants: many(imageVariants),
}));

export const imageMetadataRelations = relations(imageMetadata, ({ one }) => ({
  image: one(images, {
    fields: [imageMetadata.imageId],
    references: [images.id],
  }),
}));

export const imageVariantsRelations = relations(imageVariants, ({ one }) => ({
  image: one(images, {
    fields: [imageVariants.imageId],
    references: [images.id],
  }),
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

export const insertEnvironmentLocaleSchema = createInsertSchema(environmentLocales);
export const selectEnvironmentLocaleSchema = createSelectSchema(environmentLocales);

export const insertPageSchema = createInsertSchema(pages);
export const selectPageSchema = createSelectSchema(pages);

export const insertPageSectionSchema = createInsertSchema(pageSections);
export const selectPageSectionSchema = createSelectSchema(pageSections);

export const insertPageSectionContentSchema = createInsertSchema(pageSectionContents);
export const selectPageSectionContentSchema = createSelectSchema(pageSectionContents);

// RENAMED: sectionDefinition → sectionTemplate
export const insertSectionTemplateSchema = createInsertSchema(sectionTemplates);
export const selectSectionTemplateSchema = createSelectSchema(sectionTemplates);

// RENAMED: collectionDefinition → collectionTemplate
export const insertCollectionTemplateSchema = createInsertSchema(collectionTemplates);
export const selectCollectionTemplateSchema = createSelectSchema(collectionTemplates);

export const insertCollectionEntrySchema = createInsertSchema(collectionEntries);
export const selectCollectionEntrySchema = createSelectSchema(collectionEntries);

export const insertEntryContentSchema = createInsertSchema(entryContents);
export const selectEntryContentSchema = createSelectSchema(entryContents);

export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);

export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

export const insertMessagePartSchema = createInsertSchema(messageParts);
export const selectMessagePartSchema = createSelectSchema(messageParts);

export const insertImageSchema = createInsertSchema(images);
export const selectImageSchema = createSelectSchema(images);

export const insertImageMetadataSchema = createInsertSchema(imageMetadata);
export const selectImageMetadataSchema = createSelectSchema(imageMetadata);

export const insertImageVariantSchema = createInsertSchema(imageVariants);
export const selectImageVariantSchema = createSelectSchema(imageVariants);

