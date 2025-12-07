/**
 * Tool Metadata Index
 *
 * Single source of truth for all tool metadata including:
 * - Search phrases for BM25 discovery
 * - Related tools for automatic inclusion
 * - Risk levels and confirmation requirements
 * - Extraction schemas for working memory
 *
 * Implements Phase 1.2 from DYNAMIC_TOOL_INJECTION_PLAN.md
 */

import type { ToolMetadata } from "./types";

// ============================================================================
// TOOL_INDEX - Complete metadata for all 45 tools
// ============================================================================

export const TOOL_INDEX: Record<string, ToolMetadata> = {
	// ==========================================================================
	// Core Tools (2 tools)
	// ==========================================================================

	tool_search: {
		name: "tool_search",
		description:
			"Search for CMS tools you need. Describe what you want to do in natural language.",
		category: "search",
		phrases: [
			"find tools",
			"search tools",
			"what tools",
			"discover tools",
			"available tools",
			"get tools",
		],
		relatedTools: [],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null, // Discovery tool doesn't produce entities
	},

	final_answer: {
		name: "final_answer",
		description:
			"Present final results to user. Call when all actions are complete.",
		category: "final-answer",
		phrases: [
			"final answer",
			"complete",
			"done",
			"finished",
			"respond",
			"present results",
			"wrap up",
			"summarize",
		],
		relatedTools: [],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null, // Core tool - no entity extraction
	},

	// ==========================================================================
	// Pages (6 tools)
	// ==========================================================================

	cms_getPage: {
		name: "cms_getPage",
		description:
			"Get page by slug or ID with metadata and section IDs. Use includeContent for full content.",
		category: "pages",
		phrases: [
			"get page",
			"find page",
			"show page",
			"fetch page",
			"read page",
			"page details",
			"page content",
			"page info",
			"view page",
			"open page",
			"page by slug",
			"page by id",
		],
		relatedTools: ["cms_getPageSections", "cms_getSectionContent"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "$root",
			type: "page",
			nameField: "name",
			idField: "id",
		},
	},

	cms_createPage: {
		name: "cms_createPage",
		description: "Create new empty page. Use cms_createPageWithContent for page with sections.",
		category: "pages",
		phrases: [
			"create page",
			"new page",
			"add page",
			"make page",
			"build page",
			"create empty page",
		],
		relatedTools: ["cms_addSectionToPage", "cms_updateSectionContent"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "page",
			type: "page",
			nameField: "name",
			idField: "id",
		},
	},

	cms_createPageWithContent: {
		name: "cms_createPageWithContent",
		description:
			"Create page with hero, features, CTA sections. Best for landing pages. Images added separately.",
		category: "pages",
		phrases: [
			"create page with content",
			"create page with sections",
			"create landing page",
			"make page with hero",
			"build full page",
			"generate page",
			"create page with hero",
			"new landing page",
			"create website page",
		],
		relatedTools: ["cms_searchImages", "cms_updateSectionImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "page",
			type: "page",
			nameField: "name",
			idField: "id",
		},
	},

	cms_updatePage: {
		name: "cms_updatePage",
		description: "Update page name, slug, meta description, or SEO settings.",
		category: "pages",
		phrases: [
			"update page",
			"edit page",
			"change page",
			"modify page",
			"rename page",
			"update page meta",
			"change page slug",
			"edit page seo",
			"update page title",
		],
		relatedTools: ["cms_getPage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "page",
			type: "page",
			nameField: "name",
			idField: "id",
		},
	},

	cms_deletePage: {
		name: "cms_deletePage",
		description:
			"Delete page permanently with all sections. Requires confirmation.",
		category: "pages",
		phrases: [
			"delete page",
			"remove page",
			"trash page",
			"destroy page",
			"delete website page",
		],
		relatedTools: ["cms_removeNavigationItem"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_listPages: {
		name: "cms_listPages",
		description: "List all pages in site. Returns names, slugs, IDs.",
		category: "pages",
		phrases: [
			"list pages",
			"show pages",
			"all pages",
			"get pages",
			"view pages",
			"what pages",
			"see pages",
			"browse pages",
			"page list",
			"pages overview",
		],
		relatedTools: ["cms_getPage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "pages",
			type: "page",
			nameField: "name",
			idField: "id",
			isArray: true,
		},
	},

	// ==========================================================================
	// Sections (8 tools)
	// ==========================================================================

	cms_listSectionTemplates: {
		name: "cms_listSectionTemplates",
		description:
			"List available section types: hero, feature, cta, image-text, testimonial.",
		category: "sections",
		phrases: [
			"list section templates",
			"section types",
			"available sections",
			"what sections",
			"section templates",
			"section definitions",
			"hero section",
			"cta section",
			"feature section",
		],
		relatedTools: ["cms_getSectionFields", "cms_addSectionToPage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "sectionDefs",
			type: "section_def",
			nameField: "name",
			idField: "id",
			isArray: true,
		},
	},

	cms_getSectionFields: {
		name: "cms_getSectionFields",
		description:
			"Get section schema and field names. Check before updating section content.",
		category: "sections",
		phrases: [
			"section fields",
			"section schema",
			"what fields",
			"section structure",
			"field names",
			"section template fields",
			"get section fields",
		],
		relatedTools: ["cms_updateSectionContent", "cms_updateSectionImage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "$root",
			type: "section_def",
			nameField: "name",
			idField: "id",
		},
	},

	cms_addSectionToPage: {
		name: "cms_addSectionToPage",
		description:
			"Add hero, feature, cta, or other section to page. Returns pageSectionId.",
		category: "sections",
		phrases: [
			"add section",
			"add section to page",
			"insert section",
			"new section",
			"create section",
			"add hero",
			"add cta",
			"add feature section",
			"put section on page",
		],
		relatedTools: [
			"cms_getSectionFields",
			"cms_updateSectionContent",
			"cms_listSectionTemplates",
		],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "$root",
			type: "page_section",
			nameField: "sectionDefId",
			idField: "pageSectionId",
		},
	},

	cms_updateSectionContent: {
		name: "cms_updateSectionContent",
		description:
			"Update section text, title, button. MERGES with existing - only sends changed fields.",
		category: "sections",
		phrases: [
			"update section",
			"edit section",
			"change section",
			"modify section",
			"update section content",
			"edit section text",
			"change title",
			"change heading",
			"update button",
			"edit hero",
			"update cta",
		],
		relatedTools: ["cms_getSectionFields", "cms_getSectionContent"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_deletePageSection: {
		name: "cms_deletePageSection",
		description:
			"Delete one section from page. Requires confirmation.",
		category: "sections",
		phrases: [
			"delete section",
			"remove section",
			"delete section from page",
			"remove section from page",
			"trash section",
		],
		relatedTools: ["cms_getPageSections"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_deletePageSections: {
		name: "cms_deletePageSections",
		description:
			"Delete multiple sections at once. Batch deletion. Requires confirmation.",
		category: "sections",
		phrases: [
			"delete sections",
			"remove all sections",
			"delete multiple sections",
			"clear sections",
			"batch delete sections",
			"remove sections",
		],
		relatedTools: ["cms_getPageSections"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_getPageSections: {
		name: "cms_getPageSections",
		description:
			"List all sections on a page with IDs and types. Use includeContent for full data.",
		category: "sections",
		phrases: [
			"get sections",
			"list sections",
			"page sections",
			"show sections",
			"sections on page",
			"what sections",
			"view sections",
			"get page sections",
		],
		relatedTools: ["cms_getSectionContent", "cms_updateSectionContent"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "sections",
			type: "page_section",
			nameField: "sectionKey",
			idField: "id",
			isArray: true,
		},
	},

	cms_getSectionContent: {
		name: "cms_getSectionContent",
		description:
			"Get one section's full content by pageSectionId. Granular fetch.",
		category: "sections",
		phrases: [
			"get section content",
			"section content",
			"read section",
			"fetch section",
			"section data",
			"view section content",
			"section details",
		],
		relatedTools: ["cms_updateSectionContent", "cms_getPageSections"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "$root",
			type: "page_section",
			nameField: "sectionKey",
			idField: "pageSectionId",
		},
	},

	// ==========================================================================
	// Images (7 tools)
	// ==========================================================================

	cms_findImage: {
		name: "cms_findImage",
		description:
			"Find one specific image by description. Use for 'the puppy photo' style references.",
		category: "images",
		phrases: [
			"find image",
			"get image",
			"locate image",
			"the image",
			"that image",
			"which image",
			"find photo",
			"get photo",
			"specific image",
		],
		relatedTools: ["cms_searchImages", "cms_updateSectionImage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "image",
			type: "image",
			nameField: "filename",
			idField: "id",
		},
	},

	cms_searchImages: {
		name: "cms_searchImages",
		description:
			"Search images by description using semantic matching. Returns multiple results.",
		category: "images",
		phrases: [
			"search images",
			"find images",
			"image search",
			"look for images",
			"images of",
			"images about",
			"search photos",
			"find photos",
			"pictures of",
			"image library search",
		],
		relatedTools: ["cms_updateSectionImage", "cms_findImage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "images",
			type: "image",
			nameField: "filename",
			idField: "id",
			isArray: true,
		},
	},

	cms_listAllImages: {
		name: "cms_listAllImages",
		description:
			"List all uploaded images in the system. Browse entire image library.",
		category: "images",
		phrases: [
			"list images",
			"all images",
			"show images",
			"image library",
			"browse images",
			"view all images",
			"what images",
			"available images",
		],
		relatedTools: ["cms_searchImages"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "images",
			type: "image",
			nameField: "filename",
			idField: "id",
			isArray: true,
		},
	},

	cms_addImageToSection: {
		name: "cms_addImageToSection",
		description:
			"Attach image to section field like backgroundImage or heroImage.",
		category: "images",
		phrases: [
			"add image to section",
			"attach image",
			"set section image",
			"put image in section",
			"attach image to section",
		],
		relatedTools: ["cms_getSectionFields", "cms_searchImages"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_updateSectionImage: {
		name: "cms_updateSectionImage",
		description:
			"Set or change section image field. Use for hero background, feature images.",
		category: "images",
		phrases: [
			"update section image",
			"change section image",
			"set section image",
			"replace section image",
			"set hero image",
			"set background image",
			"change hero image",
			"update background",
			"set feature image",
		],
		relatedTools: ["cms_getSectionFields", "cms_searchImages", "cms_findImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_replaceImage: {
		name: "cms_replaceImage",
		description:
			"Replace image everywhere it's used across all sections.",
		category: "images",
		phrases: [
			"replace image",
			"swap image",
			"change image everywhere",
			"replace image globally",
			"substitute image",
		],
		relatedTools: ["cms_searchImages", "cms_findImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_deleteImage: {
		name: "cms_deleteImage",
		description:
			"Delete image permanently from system. Cannot be undone. Requires confirmation.",
		category: "images",
		phrases: [
			"delete image",
			"remove image",
			"trash image",
			"delete photo",
			"remove photo",
		],
		relatedTools: ["cms_findImage"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	// ==========================================================================
	// Navigation (5 tools)
	// ==========================================================================

	cms_getNavigation: {
		name: "cms_getNavigation",
		description: "Get current navigation menu items",
		category: "navigation",
		phrases: [
			"get navigation",
			"show navigation",
			"menu items",
			"navigation menu",
			"site menu",
			"nav items",
			"header menu",
		],
		relatedTools: ["cms_addNavigationItem", "cms_updateNavigationItem"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "nav_item",
			nameField: "label",
			idField: "label", // Nav items use label as key
			isArray: true,
		},
	},

	cms_addNavigationItem: {
		name: "cms_addNavigationItem",
		description: "Add a new item to the navigation menu",
		category: "navigation",
		phrases: [
			"add navigation item",
			"add to menu",
			"add menu item",
			"add to nav",
			"add link to navigation",
			"new menu item",
		],
		relatedTools: ["cms_getNavigation"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // Action result
	},

	cms_updateNavigationItem: {
		name: "cms_updateNavigationItem",
		description: "Update an existing navigation menu item",
		category: "navigation",
		phrases: [
			"update navigation item",
			"edit menu item",
			"change navigation",
			"modify nav item",
			"rename menu item",
		],
		relatedTools: ["cms_getNavigation"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // Update operation
	},

	cms_removeNavigationItem: {
		name: "cms_removeNavigationItem",
		description: "Remove an item from the navigation menu",
		category: "navigation",
		phrases: [
			"remove navigation item",
			"delete menu item",
			"remove from nav",
			"delete from menu",
		],
		relatedTools: ["cms_getNavigation"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // Deletion
	},

	cms_toggleNavigationItem: {
		name: "cms_toggleNavigationItem",
		description: "Enable or disable a navigation menu item",
		category: "navigation",
		phrases: [
			"toggle navigation item",
			"enable menu item",
			"disable menu item",
			"hide nav item",
			"show nav item",
		],
		relatedTools: ["cms_getNavigation"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null, // Toggle operation
	},

	// ==========================================================================
	// Posts (7 tools)
	// ==========================================================================

	cms_createPost: {
		name: "cms_createPost",
		description: "Create blog post with title, content, tags. Created as draft. Add image via featuredImage.",
		category: "posts",
		phrases: [
			"create post",
			"new post",
			"write post",
			"add post",
			"create blog",
			"new blog post",
			"write blog",
			"create article",
			"new article",
			"blog post",
			"make post",
		],
		relatedTools: ["cms_updatePost", "cms_publishPost"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "post",
			type: "post",
			nameField: "title",
			idField: "id",
		},
	},

	cms_updatePost: {
		name: "cms_updatePost",
		description: "Update post title, content, tags, or featuredImage.",
		category: "posts",
		phrases: [
			"update post",
			"edit post",
			"modify post",
			"change post",
			"update blog",
			"edit blog post",
			"change post content",
		],
		relatedTools: ["cms_getPost"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "post",
			type: "post",
			nameField: "title",
			idField: "id",
		},
	},

	cms_publishPost: {
		name: "cms_publishPost",
		description: "Publish draft post to make it live. Requires confirmation.",
		category: "posts",
		phrases: [
			"publish post",
			"publish blog",
			"make live",
			"go live",
			"release post",
			"publish article",
		],
		relatedTools: ["cms_getPost"],
		riskLevel: "moderate",
		requiresConfirmation: true,
		extraction: {
			path: "post",
			type: "post",
			nameField: "title",
			idField: "id",
		},
	},

	cms_archivePost: {
		name: "cms_archivePost",
		description: "Archive post to hide without deleting. Requires confirmation.",
		category: "posts",
		phrases: [
			"archive post",
			"unpublish post",
			"hide post",
			"take down",
			"archive blog",
		],
		relatedTools: ["cms_getPost"],
		riskLevel: "moderate",
		requiresConfirmation: true,
		extraction: {
			path: "post",
			type: "post",
			nameField: "title",
			idField: "id",
		},
	},

	cms_deletePost: {
		name: "cms_deletePost",
		description: "Delete post permanently. Cannot be undone. Requires confirmation.",
		category: "posts",
		phrases: [
			"delete post",
			"remove post",
			"trash post",
			"delete blog",
			"delete article",
		],
		relatedTools: ["cms_listPosts"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_listPosts: {
		name: "cms_listPosts",
		description: "List all blog posts. Filter by status: draft, published, archived.",
		category: "posts",
		phrases: [
			"list posts",
			"show posts",
			"all posts",
			"get posts",
			"blog posts",
			"view posts",
			"posts list",
			"articles",
			"all blogs",
		],
		relatedTools: ["cms_getPost"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "posts",
			type: "post",
			nameField: "title",
			idField: "id",
			isArray: true,
		},
	},

	cms_getPost: {
		name: "cms_getPost",
		description: "Get post by ID or slug with full content and metadata.",
		category: "posts",
		phrases: [
			"get post",
			"show post",
			"read post",
			"view post",
			"fetch post",
			"post details",
			"blog post content",
			"get article",
		],
		relatedTools: ["cms_updatePost"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "$root",
			type: "post",
			nameField: "title",
			idField: "id",
		},
	},

	// ==========================================================================
	// Entries / Collections (2 tools)
	// ==========================================================================

	cms_getCollectionEntries: {
		name: "cms_getCollectionEntries",
		description:
			"Get all entries for a collection. Lightweight by default.",
		category: "entries",
		phrases: [
			"get collection entries",
			"list entries",
			"collection items",
			"show entries",
			"entries in collection",
		],
		relatedTools: ["cms_getEntryContent"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "entries",
			type: "entry",
			nameField: "name",
			idField: "id",
			isArray: true,
		},
	},

	cms_getEntryContent: {
		name: "cms_getEntryContent",
		description: "Get content for a specific entry. Granular fetching.",
		category: "entries",
		phrases: [
			"get entry content",
			"entry details",
			"read entry",
			"fetch entry",
			"entry data",
		],
		relatedTools: ["cms_getCollectionEntries"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "$root",
			type: "entry",
			nameField: "name",
			idField: "id",
		},
	},

	// ==========================================================================
	// Search (2 tools)
	// ==========================================================================

	search_vector: {
		name: "search_vector",
		description: "Search for content using vector similarity (semantic search)",
		category: "search",
		phrases: [
			"search vector",
			"semantic search",
			"similar content",
			"find similar",
			"content search",
		],
		relatedTools: ["cms_findResource"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null, // Uses custom extractor
	},

	cms_findResource: {
		name: "cms_findResource",
		description:
			"Find CMS resource by name/query. Works for pages, sections, collections.",
		category: "search",
		phrases: [
			"find resource",
			"search resource",
			"find by name",
			"locate resource",
			"search cms",
		],
		relatedTools: ["search_vector"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null, // Uses custom extractor (dynamic type)
	},

	// ==========================================================================
	// HTTP (2 tools)
	// ==========================================================================

	http_get: {
		name: "http_get",
		description: "Make HTTP GET request to external API",
		category: "http",
		phrases: [
			"http get",
			"fetch url",
			"get request",
			"api get",
			"external api",
			"fetch data",
		],
		relatedTools: ["http_post"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // External data
	},

	http_post: {
		name: "http_post",
		description: "Make HTTP POST request to external API. Requires confirmation.",
		category: "http",
		phrases: [
			"http post",
			"post request",
			"send data",
			"api post",
			"submit to api",
		],
		relatedTools: ["http_get"],
		riskLevel: "moderate",
		requiresConfirmation: true,
		extraction: null, // External data
	},

	// ==========================================================================
	// Planning (1 tool)
	// ==========================================================================

	plan_analyzeTask: {
		name: "plan_analyzeTask",
		description: "Analyze user request and create execution plan",
		category: "planning",
		phrases: [
			"analyze task",
			"create plan",
			"plan steps",
			"break down task",
			"task analysis",
		],
		relatedTools: [],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null, // Planning result
	},

	// ==========================================================================
	// Web Research (3 tools)
	// ==========================================================================

	web_quickSearch: {
		name: "web_quickSearch",
		description: "Fast web search for facts, news, quick info. Returns snippets and links.",
		category: "research",
		phrases: [
			"web search",
			"search web",
			"search online",
			"search internet",
			"google",
			"find online",
			"look up",
			"quick search",
			"web lookup",
			"online search",
			"internet search",
		],
		relatedTools: ["web_deepResearch", "web_fetchContent"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	web_deepResearch: {
		name: "web_deepResearch",
		description: "Comprehensive research with full report. Best for blog content. Takes 30-120s.",
		category: "research",
		phrases: [
			"deep research",
			"research topic",
			"comprehensive research",
			"detailed research",
			"investigate",
			"thorough research",
			"full research",
			"in-depth search",
			"research for blog",
			"content research",
		],
		relatedTools: ["web_quickSearch", "web_fetchContent"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	web_fetchContent: {
		name: "web_fetchContent",
		description: "Extract content from specific URL. Get article text from webpage.",
		category: "research",
		phrases: [
			"fetch url",
			"get url content",
			"extract from url",
			"read webpage",
			"fetch page",
			"get page content",
			"scrape url",
		],
		relatedTools: ["web_quickSearch"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	// ==========================================================================
	// Pexels (2 tools)
	// ==========================================================================

	pexels_searchPhotos: {
		name: "pexels_searchPhotos",
		description:
			"Search free stock photos from Pexels. Returns previews with photographer credit.",
		category: "pexels",
		phrases: [
			"pexels",
			"pexels search",
			"pexels photos",
			"stock photos",
			"stock images",
			"free photos",
			"free images",
			"search stock",
			"find stock photos",
			"search pexels",
			"download image",
			"get stock photo",
		],
		relatedTools: ["pexels_downloadPhoto", "cms_searchImages"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "photos",
			type: "pexels_photo",
			nameField: "alt",
			idField: "id",
			isArray: true,
		},
	},

	pexels_downloadPhoto: {
		name: "pexels_downloadPhoto",
		description:
			"Download Pexels photo to system. Returns local image ID for use in sections/posts.",
		category: "pexels",
		phrases: [
			"download pexels",
			"download stock photo",
			"save pexels photo",
			"download photo",
			"import stock photo",
			"add pexels image",
			"download from pexels",
			"save stock image",
		],
		relatedTools: ["pexels_searchPhotos", "cms_searchImages"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "image",
			type: "image",
			nameField: "filename",
			idField: "id",
		},
	},
};

// Type helper for tool names
export type ToolName = keyof typeof TOOL_INDEX;

// Get all tool names
export const ALL_TOOL_NAMES = Object.keys(TOOL_INDEX) as ToolName[];
