/**
 * Tool Registry
 *
 * Single source of truth for all tool metadata.
 * Used by ToolSearchService for BM25 + vector hybrid search.
 *
 * Contains:
 * - Search phrases for BM25 discovery
 * - Related tools for automatic inclusion
 * - Risk levels and confirmation requirements
 * - Extraction schemas for working memory
 */

import type { ToolMetadata } from "./types";

// ============================================================================
// TOOL_REGISTRY - Complete metadata for all 31 atomic tools
// ============================================================================

export const TOOL_REGISTRY: Record<string, ToolMetadata> = {
	// ==========================================================================
	// Core Tools (3 tools)
	// ==========================================================================

	searchTools: {
		name: "searchTools",
		phrases: ["find tools", "search tools", "what tools", "discover tools", "available tools", "get tools"],
		relatedTools: [],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	finalAnswer: {
		name: "finalAnswer",
		phrases: ["final answer", "complete", "done", "finished", "respond", "present results", "wrap up", "summarize"],
		relatedTools: [],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	acknowledgeRequest: {
		name: "acknowledgeRequest",
		phrases: ["acknowledge", "confirm", "understood", "got it", "I'll check", "let me look", "working on it"],
		relatedTools: ["searchTools"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	// ==========================================================================
	// Page Tools (4 tools)
	// ==========================================================================

	getPage: {
		name: "getPage",
		phrases: [
			"get page", "find page", "show page", "fetch page", "read page",
			"page details", "page content", "page info", "view page", "open page",
			"page by slug", "page by id", "list pages", "show pages", "all pages",
			"get pages", "view pages", "what pages", "see pages", "browse pages"
		],
		relatedTools: ["getSection", "updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "page",
			nameField: "name",
			idField: "id",
			isArray: true,
		},
	},

	createPage: {
		name: "createPage",
		phrases: ["create page", "new page", "add page", "make page", "build page", "create empty page"],
		relatedTools: ["createSection", "updateSection"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "page",
			nameField: "name",
			idField: "id",
			isArray: true,
		},
	},

	updatePage: {
		name: "updatePage",
		phrases: [
			"update page", "edit page", "change page", "modify page",
			"rename page", "update page meta", "change page slug", "edit page seo"
		],
		relatedTools: ["getPage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "page",
			nameField: "name",
			idField: "id",
			isArray: true,
		},
	},

	deletePage: {
		name: "deletePage",
		phrases: ["delete page", "remove page", "trash page", "destroy page", "delete website page"],
		relatedTools: ["deleteNavItem"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	// ==========================================================================
	// Post Tools (4 tools)
	// ==========================================================================

	getPost: {
		name: "getPost",
		phrases: [
			"get post", "show post", "read post", "view post", "fetch post",
			"post details", "blog post content", "get article",
			"list posts", "show posts", "all posts", "get posts",
			"blog posts", "view posts", "posts list", "articles"
		],
		relatedTools: ["updatePost"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "post",
			nameField: "title",
			idField: "id",
			isArray: true,
		},
	},

	createPost: {
		name: "createPost",
		phrases: [
			"create post", "new post", "write post", "add post",
			"create blog", "new blog post", "write blog",
			"create article", "new article", "blog post", "make post"
		],
		relatedTools: ["updatePost", "getImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "post",
			nameField: "title",
			idField: "id",
			isArray: true,
		},
	},

	updatePost: {
		name: "updatePost",
		phrases: [
			"update post", "edit post", "modify post", "change post",
			"update blog", "edit blog post", "change post content",
			"publish post", "publish blog", "make live", "go live",
			"archive post", "unpublish post", "hide post"
		],
		relatedTools: ["getPost"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "post",
			nameField: "title",
			idField: "id",
			isArray: true,
		},
	},

	deletePost: {
		name: "deletePost",
		phrases: ["delete post", "remove post", "trash post", "delete blog", "delete article"],
		relatedTools: ["getPost"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	// ==========================================================================
	// Section Tools (5 tools)
	// ==========================================================================

	getSectionTemplate: {
		name: "getSectionTemplate",
		phrases: [
			"list section templates", "section types", "available sections",
			"what sections", "section templates", "section definitions",
			"hero section", "cta section", "feature section",
			"section fields", "section schema", "what fields",
			"section structure", "field names", "get section fields"
		],
		relatedTools: ["createSection", "updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "section_template",
			nameField: "name",
			idField: "id",
			isArray: true,
		},
	},

	getSection: {
		name: "getSection",
		phrases: [
			"get sections", "list sections", "page sections", "show sections",
			"sections on page", "what sections", "view sections", "get page sections",
			"get section content", "section content", "read section",
			"fetch section", "section data", "view section content"
		],
		relatedTools: ["updateSection", "getSectionTemplate"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "page_section",
			nameField: "sectionKey",
			idField: "id",
			isArray: true,
		},
	},

	createSection: {
		name: "createSection",
		phrases: [
			"add section", "add section to page", "insert section",
			"new section", "create section", "add hero",
			"add cta", "add feature section", "put section on page"
		],
		relatedTools: ["getSectionTemplate", "updateSection"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "page_section",
			nameField: "sectionKey",
			idField: "id",
			isArray: true,
		},
	},

	updateSection: {
		name: "updateSection",
		phrases: [
			"update section", "edit section", "change section", "modify section",
			"update section content", "edit section text", "change title",
			"change heading", "update button", "edit hero", "update cta",
			"update section image", "change section image", "set section image",
			"replace section image", "set hero image", "set background image",
			"add image to section", "attach image"
		],
		relatedTools: ["getSectionTemplate", "getSection", "getImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	deleteSection: {
		name: "deleteSection",
		phrases: [
			"delete section", "remove section", "delete section from page",
			"remove section from page", "trash section",
			"delete sections", "remove all sections", "batch delete sections"
		],
		relatedTools: ["getSection"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	// ==========================================================================
	// Navigation Tools (4 tools)
	// ==========================================================================

	getNavItem: {
		name: "getNavItem",
		phrases: [
			"get navigation", "show navigation", "menu items",
			"navigation menu", "site menu", "nav items", "header menu"
		],
		relatedTools: ["createNavItem", "updateNavItem"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "nav_item",
			nameField: "label",
			idField: "label",
			isArray: true,
		},
	},

	createNavItem: {
		name: "createNavItem",
		phrases: [
			"add navigation item", "add to menu", "add menu item",
			"add to nav", "add link to navigation", "new menu item"
		],
		relatedTools: ["getNavItem"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	updateNavItem: {
		name: "updateNavItem",
		phrases: [
			"update navigation item", "edit menu item", "change navigation",
			"modify nav item", "rename menu item",
			"toggle navigation item", "enable menu item", "disable menu item",
			"hide nav item", "show nav item"
		],
		relatedTools: ["getNavItem"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	deleteNavItem: {
		name: "deleteNavItem",
		phrases: [
			"remove navigation item", "delete menu item",
			"remove from nav", "delete from menu"
		],
		relatedTools: ["getNavItem"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	// ==========================================================================
	// Image Tools - Local (4 tools)
	// ==========================================================================

	getImage: {
		name: "getImage",
		phrases: [
			"find image", "get image", "locate image", "the image",
			"search images", "find images", "image search", "look for images",
			"images of", "images about", "search photos", "find photos",
			"list images", "all images", "show images", "image library",
			"view all images", "what images", "available images", "local images"
		],
		relatedTools: ["updateSection", "browseImages"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "image",
			nameField: "filename",
			idField: "id",
			isArray: true,
		},
	},

	createImage: {
		name: "createImage",
		phrases: ["upload image", "add image", "create image", "new image", "upload photo", "add photo", "upload file"],
		relatedTools: ["getImage", "updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: ".", type: "image", nameField: "filename", idField: "imageId" },
	},

	updateImage: {
		name: "updateImage",
		phrases: [
			"update image", "edit image metadata", "change image description",
			"update image tags", "modify image"
		],
		relatedTools: ["getImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	deleteImage: {
		name: "deleteImage",
		phrases: ["delete image", "remove image", "trash image", "delete photo", "remove photo"],
		relatedTools: ["getImage"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	// ==========================================================================
	// Entry Tools (4 tools)
	// ==========================================================================

	getEntry: {
		name: "getEntry",
		phrases: [
			"get entry", "get collection entries", "list entries",
			"collection items", "show entries", "entries in collection",
			"get entry content", "entry details", "read entry",
			"fetch entry", "entry data"
		],
		relatedTools: ["updateEntry"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "entry",
			nameField: "title",
			idField: "id",
			isArray: true,
		},
	},

	createEntry: {
		name: "createEntry",
		phrases: [
			"create entry", "new entry", "add entry",
			"create collection entry", "add to collection"
		],
		relatedTools: ["updateEntry"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: {
			path: "items",
			type: "entry",
			nameField: "title",
			idField: "id",
			isArray: true,
		},
	},

	updateEntry: {
		name: "updateEntry",
		phrases: [
			"update entry", "edit entry", "modify entry",
			"change entry", "update entry content"
		],
		relatedTools: ["getEntry"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	deleteEntry: {
		name: "deleteEntry",
		phrases: ["delete entry", "remove entry", "trash entry"],
		relatedTools: ["getEntry"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	// ==========================================================================
	// External Image Tools (2 tools)
	// ==========================================================================

	browseImages: {
		name: "browseImages",
		phrases: [
			"stock photo", "stock image", "find stock", "search stock",
			"external image", "pexels", "unsplash", "download photo",
			"browse stock", "free image", "royalty free", "photo library"
		],
		relatedTools: ["importImage", "getImage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "photos", type: "external-image", nameField: "alt", idField: "id", isArray: true },
	},

	importImage: {
		name: "importImage",
		phrases: [
			"import image", "download image", "import photo", "download photo",
			"save image", "get from pexels", "get from unsplash", "add stock photo"
		],
		relatedTools: ["browseImages", "getImage", "updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: ".", type: "image", nameField: "filename", idField: "imageId" },
	},

	// ==========================================================================
	// Web Tools (2 tools)
	// ==========================================================================

	searchWeb: {
		name: "searchWeb",
		phrases: [
			"search web", "web search", "search online", "look up", "find online",
			"google", "search internet", "research", "find information",
			"what is", "who is", "when did", "how to"
		],
		relatedTools: ["fetchContent"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	fetchContent: {
		name: "fetchContent",
		phrases: [
			"fetch url", "get url content", "read url", "extract content",
			"scrape page", "get page content", "read website", "fetch page"
		],
		relatedTools: ["searchWeb"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

};

// Type helper for tool names
export type ToolName = keyof typeof TOOL_REGISTRY;

// Get all tool names
export const ALL_TOOL_NAMES = Object.keys(TOOL_REGISTRY) as ToolName[];
