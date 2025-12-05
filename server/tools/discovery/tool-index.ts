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
	// Discovery (1 tool)
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

	// ==========================================================================
	// Pages (6 tools)
	// ==========================================================================

	cms_getPage: {
		name: "cms_getPage",
		description:
			"Get a page by slug or ID. Returns metadata + section IDs by default.",
		category: "pages",
		phrases: [
			"get page",
			"find page",
			"show page",
			"page details",
			"fetch page",
			"read page",
			"page content",
			"page info",
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
		description: "Create a new page with optional sections",
		category: "pages",
		phrases: [
			"create page",
			"new page",
			"add page",
			"make page",
			"create new page",
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
			"Create a page with sections and AI-generated content. Images need to be added separately.",
		category: "pages",
		phrases: [
			"create page with content",
			"make page with sections",
			"new page with hero",
			"create full page",
			"build page",
			"generate page",
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
		description: "Update an existing page (name, slug, meta, or indexing)",
		category: "pages",
		phrases: [
			"update page",
			"edit page",
			"change page",
			"modify page",
			"rename page",
			"update page meta",
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
			"Delete a page permanently (CASCADE: deletes all sections). Requires confirmation.",
		category: "pages",
		phrases: [
			"delete page",
			"remove page",
			"destroy page",
			"trash page",
			"eliminate page",
		],
		relatedTools: ["cms_removeNavigationItem"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null, // Deletion - no entity to extract
	},

	cms_listPages: {
		name: "cms_listPages",
		description: "List all pages in the current site/environment",
		category: "pages",
		phrases: [
			"list pages",
			"show all pages",
			"what pages exist",
			"all pages",
			"get pages",
			"page list",
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
			"List all available section templates (hero, feature, cta, etc.)",
		category: "sections",
		phrases: [
			"list section templates",
			"available sections",
			"section types",
			"what sections",
			"show sections",
			"section definitions",
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
			"Get section template fields/schema. See what fields a section needs before adding content.",
		category: "sections",
		phrases: [
			"get section fields",
			"section schema",
			"section structure",
			"what fields",
			"section template",
			"field names",
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
			"Add a section to a page. Returns pageSectionId for content updates.",
		category: "sections",
		phrases: [
			"add section",
			"add section to page",
			"insert section",
			"new section",
			"create section",
			"attach section",
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
			"Update content for a page section. MERGES with existing content.",
		category: "sections",
		phrases: [
			"update section content",
			"edit section",
			"change section text",
			"modify section",
			"update section",
			"section content",
			"update title",
			"change heading",
		],
		relatedTools: ["cms_getSectionFields", "cms_getSectionContent"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // Update operation
	},

	cms_deletePageSection: {
		name: "cms_deletePageSection",
		description:
			"Delete a section from a page. Removes the section instance. Requires confirmation.",
		category: "sections",
		phrases: [
			"delete section",
			"remove section",
			"delete section from page",
			"remove section from page",
		],
		relatedTools: ["cms_getPageSections"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null, // Deletion
	},

	cms_deletePageSections: {
		name: "cms_deletePageSections",
		description:
			"Delete multiple sections from a page in one operation. Requires confirmation.",
		category: "sections",
		phrases: [
			"delete sections",
			"remove all sections",
			"delete multiple sections",
			"clear sections",
			"batch delete sections",
		],
		relatedTools: ["cms_getPageSections"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null, // Deletion
	},

	cms_getPageSections: {
		name: "cms_getPageSections",
		description:
			"Get all sections for a page. Lightweight by default, use includeContent for full content.",
		category: "sections",
		phrases: [
			"get page sections",
			"list sections",
			"page sections",
			"show sections",
			"section list",
			"what sections on page",
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
			"Get content for a specific section. Use for granular fetching.",
		category: "sections",
		phrases: [
			"get section content",
			"section content",
			"read section",
			"fetch section content",
			"section data",
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
			"Find an image by natural language description. Use when user mentions a specific image.",
		category: "images",
		phrases: [
			"find image",
			"get image",
			"locate image",
			"which image",
			"the image",
			"that image",
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
			"Search for images using semantic similarity. Expand short queries with keywords.",
		category: "images",
		phrases: [
			"search images",
			"find images",
			"image search",
			"look for images",
			"images matching",
			"images like",
			"images about",
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
			"List all images in the entire system. Use when user asks for all images.",
		category: "images",
		phrases: [
			"list all images",
			"show all images",
			"all images",
			"what images",
			"image library",
			"image list",
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
			"Add an uploaded image to a page section field. Check section fields first.",
		category: "images",
		phrases: [
			"add image to section",
			"attach image",
			"set section image",
			"put image in section",
		],
		relatedTools: ["cms_getSectionFields", "cms_searchImages"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // Update operation
	},

	cms_updateSectionImage: {
		name: "cms_updateSectionImage",
		description:
			"Update a section's image field with an uploaded image. Always check section fields first.",
		category: "images",
		phrases: [
			"update section image",
			"change section image",
			"replace section image",
			"set image",
			"update hero image",
			"change background image",
		],
		relatedTools: ["cms_getSectionFields", "cms_searchImages", "cms_findImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // Update operation
	},

	cms_replaceImage: {
		name: "cms_replaceImage",
		description:
			"Replace one image with another across all page sections.",
		category: "images",
		phrases: [
			"replace image",
			"swap image",
			"change image everywhere",
			"replace all occurrences",
		],
		relatedTools: ["cms_searchImages", "cms_findImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // Update operation
	},

	cms_deleteImage: {
		name: "cms_deleteImage",
		description:
			"Delete an image permanently. This cannot be undone. Requires confirmation.",
		category: "images",
		phrases: [
			"delete image",
			"remove image",
			"trash image",
			"destroy image",
		],
		relatedTools: ["cms_findImage"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null, // Deletion
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
		description: "Create a new blog post or content entry",
		category: "posts",
		phrases: [
			"create post",
			"new post",
			"write post",
			"add post",
			"create blog post",
			"new blog",
			"add blog post",
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
		description: "Update an existing post",
		category: "posts",
		phrases: [
			"update post",
			"edit post",
			"modify post",
			"change post",
			"update blog post",
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
		description: "Publish a draft post. Requires confirmation.",
		category: "posts",
		phrases: [
			"publish post",
			"make post live",
			"publish blog",
			"go live",
			"release post",
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
		description: "Archive a post (unpublish but keep). Requires confirmation.",
		category: "posts",
		phrases: [
			"archive post",
			"unpublish post",
			"hide post",
			"take down post",
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
		description: "Delete a post permanently. Requires confirmation.",
		category: "posts",
		phrases: ["delete post", "remove post", "trash post", "delete blog post"],
		relatedTools: ["cms_listPosts"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null, // Deletion
	},

	cms_listPosts: {
		name: "cms_listPosts",
		description: "List all posts with optional filtering",
		category: "posts",
		phrases: [
			"list posts",
			"show posts",
			"all posts",
			"get posts",
			"blog posts",
			"post list",
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
		description: "Get a specific post by ID or slug",
		category: "posts",
		phrases: [
			"get post",
			"show post",
			"read post",
			"fetch post",
			"post details",
			"view post",
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
		description: "Quick web search for information",
		category: "research",
		phrases: [
			"web search",
			"search web",
			"quick search",
			"search online",
			"find online",
			"google",
		],
		relatedTools: ["web_deepResearch", "web_fetchContent"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null, // External results
	},

	web_deepResearch: {
		name: "web_deepResearch",
		description: "Deep web research with comprehensive results",
		category: "research",
		phrases: [
			"deep research",
			"research topic",
			"comprehensive search",
			"detailed research",
			"investigate",
		],
		relatedTools: ["web_quickSearch", "web_fetchContent"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null, // External results
	},

	web_fetchContent: {
		name: "web_fetchContent",
		description: "Fetch and extract content from a URL",
		category: "research",
		phrases: [
			"fetch content",
			"get page content",
			"extract from url",
			"read webpage",
			"scrape page",
		],
		relatedTools: ["web_quickSearch"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null, // External content
	},

	// ==========================================================================
	// Pexels (2 tools)
	// ==========================================================================

	pexels_searchPhotos: {
		name: "pexels_searchPhotos",
		description:
			"Search free stock photos from Pexels. Returns previews with credits.",
		category: "pexels",
		phrases: [
			"search pexels",
			"stock photos",
			"find stock images",
			"pexels search",
			"free photos",
			"search free images",
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
			"Download a Pexels photo into the system. Checks for duplicates.",
		category: "pexels",
		phrases: [
			"download pexels photo",
			"save stock photo",
			"download from pexels",
			"add pexels image",
			"import stock photo",
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
