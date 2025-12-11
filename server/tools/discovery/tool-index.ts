/**
 * Tool Metadata Index
 *
 * Single source of truth for all tool metadata including:
 * - Search phrases for BM25 discovery
 * - Related tools for automatic inclusion
 * - Risk levels and confirmation requirements
 * - Extraction schemas for working memory
 *
 * Phase 1: Added new atomic tools alongside legacy tools (aliases)
 */

import type { ToolMetadata } from "./types";

// ============================================================================
// TOOL_INDEX - Complete metadata for all tools
// ============================================================================

export const TOOL_INDEX: Record<string, ToolMetadata> = {
	// ==========================================================================
	// Core Tools (3 tools)
	// ==========================================================================

	tool_search: {
		name: "tool_search",
		phrases: ["find tools", "search tools", "what tools", "discover tools", "available tools", "get tools"],
		relatedTools: [],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	final_answer: {
		name: "final_answer",
		phrases: ["final answer", "complete", "done", "finished", "respond", "present results", "wrap up", "summarize"],
		relatedTools: [],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	acknowledge: {
		name: "acknowledge",
		phrases: ["acknowledge", "confirm", "understood", "got it", "I'll check", "let me look", "working on it"],
		relatedTools: ["tool_search"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	// ==========================================================================
	// NEW ATOMIC TOOLS - Pages (4 tools)
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
	// NEW ATOMIC TOOLS - Posts (4 tools)
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
		relatedTools: ["updatePost", "browseImages"],
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
	// NEW ATOMIC TOOLS - Sections (5 tools)
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
			"replace section image", "set hero image", "set background image"
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
	// NEW ATOMIC TOOLS - Navigation (4 tools)
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
	// NEW ATOMIC TOOLS - Images (3 tools)
	// ==========================================================================

	getImage: {
		name: "getImage",
		phrases: [
			"find image", "get image", "locate image", "the image",
			"search images", "find images", "image search", "look for images",
			"images of", "images about", "search photos", "find photos",
			"list images", "all images", "show images", "image library",
			"browse images", "view all images", "what images", "available images"
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
	// NEW ATOMIC TOOLS - Entries (4 tools)
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
	// LEGACY ALIASES (kept for backward compatibility)
	// These point to the same new atomic tools
	// ==========================================================================

	cms_getPage: {
		name: "cms_getPage",
		phrases: ["get page", "find page", "show page", "fetch page", "read page", "page details", "page content"],
		relatedTools: ["getSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "page", nameField: "name", idField: "id", isArray: true },
	},

	cms_listPages: {
		name: "cms_listPages",
		phrases: ["list pages", "show pages", "all pages", "get pages", "view pages", "what pages"],
		relatedTools: ["getPage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "page", nameField: "name", idField: "id", isArray: true },
	},

	cms_createPage: {
		name: "cms_createPage",
		phrases: ["create page", "new page", "add page", "make page"],
		relatedTools: ["createSection"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: { path: "items", type: "page", nameField: "name", idField: "id", isArray: true },
	},

	cms_createPageWithContent: {
		name: "cms_createPageWithContent",
		phrases: ["create page with content", "create page with sections", "create landing page", "make page with hero"],
		relatedTools: ["getImage", "updateSection"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: { path: "page", type: "page", nameField: "name", idField: "id" },
	},

	cms_updatePage: {
		name: "cms_updatePage",
		phrases: ["update page", "edit page", "change page", "modify page"],
		relatedTools: ["getPage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: { path: "items", type: "page", nameField: "name", idField: "id", isArray: true },
	},

	cms_deletePage: {
		name: "cms_deletePage",
		phrases: ["delete page", "remove page", "trash page"],
		relatedTools: ["deleteNavItem"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_listSectionTemplates: {
		name: "cms_listSectionTemplates",
		phrases: ["list section templates", "section types", "available sections"],
		relatedTools: ["getSectionTemplate", "createSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "section_template", nameField: "name", idField: "id", isArray: true },
	},

	cms_getSectionFields: {
		name: "cms_getSectionFields",
		phrases: ["section fields", "section schema", "what fields", "section structure"],
		relatedTools: ["updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "section_template", nameField: "name", idField: "id", isArray: true },
	},

	cms_getPageSections: {
		name: "cms_getPageSections",
		phrases: ["get sections", "list sections", "page sections", "sections on page"],
		relatedTools: ["getSection", "updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "page_section", nameField: "sectionKey", idField: "id", isArray: true },
	},

	cms_getSectionContent: {
		name: "cms_getSectionContent",
		phrases: ["get section content", "section content", "read section", "fetch section"],
		relatedTools: ["updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "page_section", nameField: "sectionKey", idField: "pageSectionId", isArray: true },
	},

	cms_addSectionToPage: {
		name: "cms_addSectionToPage",
		phrases: ["add section", "add section to page", "insert section", "new section"],
		relatedTools: ["getSectionTemplate", "updateSection"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: { path: "items", type: "page_section", nameField: "sectionKey", idField: "id", isArray: true },
	},

	cms_updateSectionContent: {
		name: "cms_updateSectionContent",
		phrases: ["update section", "edit section", "change section", "modify section"],
		relatedTools: ["getSectionTemplate", "getSection"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_updateSectionImage: {
		name: "cms_updateSectionImage",
		phrases: ["update section image", "change section image", "set section image", "set hero image"],
		relatedTools: ["getImage", "getSection"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_deletePageSection: {
		name: "cms_deletePageSection",
		phrases: ["delete section", "remove section"],
		relatedTools: ["getSection"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_deletePageSections: {
		name: "cms_deletePageSections",
		phrases: ["delete sections", "remove all sections", "batch delete sections"],
		relatedTools: ["getSection"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_findImage: {
		name: "cms_findImage",
		phrases: ["find image", "get image", "locate image", "the image", "that image"],
		relatedTools: ["getImage", "updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "image", nameField: "filename", idField: "id", isArray: true },
	},

	cms_searchImages: {
		name: "cms_searchImages",
		phrases: ["search images", "find images", "image search", "look for images"],
		relatedTools: ["getImage", "updateSection"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "image", nameField: "filename", idField: "id", isArray: true },
	},

	cms_listAllImages: {
		name: "cms_listAllImages",
		phrases: ["list images", "all images", "show images", "image library", "browse images"],
		relatedTools: ["getImage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "image", nameField: "filename", idField: "id", isArray: true },
	},

	cms_addImageToSection: {
		name: "cms_addImageToSection",
		phrases: ["add image to section", "attach image", "set section image"],
		relatedTools: ["getImage", "getSectionTemplate"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_replaceImage: {
		name: "cms_replaceImage",
		phrases: ["replace image", "swap image", "change image everywhere"],
		relatedTools: ["getImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_deleteImage: {
		name: "cms_deleteImage",
		phrases: ["delete image", "remove image", "trash image", "delete photo"],
		relatedTools: ["getImage"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_getNavigation: {
		name: "cms_getNavigation",
		phrases: ["get navigation", "show navigation", "menu items", "site menu"],
		relatedTools: ["getNavItem", "createNavItem"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "nav_item", nameField: "label", idField: "label", isArray: true },
	},

	cms_addNavigationItem: {
		name: "cms_addNavigationItem",
		phrases: ["add navigation item", "add to menu", "add menu item"],
		relatedTools: ["getNavItem"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_updateNavigationItem: {
		name: "cms_updateNavigationItem",
		phrases: ["update navigation item", "edit menu item", "change navigation"],
		relatedTools: ["getNavItem"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_removeNavigationItem: {
		name: "cms_removeNavigationItem",
		phrases: ["remove navigation item", "delete menu item", "remove from nav"],
		relatedTools: ["getNavItem"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_toggleNavigationItem: {
		name: "cms_toggleNavigationItem",
		phrases: ["toggle navigation item", "enable menu item", "disable menu item", "hide nav item"],
		relatedTools: ["getNavItem"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_createPost: {
		name: "cms_createPost",
		phrases: ["create post", "new post", "write post", "create blog", "new blog post"],
		relatedTools: ["updatePost"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: { path: "items", type: "post", nameField: "title", idField: "id", isArray: true },
	},

	cms_updatePost: {
		name: "cms_updatePost",
		phrases: ["update post", "edit post", "modify post", "change post"],
		relatedTools: ["getPost"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: { path: "items", type: "post", nameField: "title", idField: "id", isArray: true },
	},

	cms_publishPost: {
		name: "cms_publishPost",
		phrases: ["publish post", "publish blog", "make live", "go live", "release post"],
		relatedTools: ["getPost"],
		riskLevel: "moderate",
		requiresConfirmation: true,
		extraction: { path: "items", type: "post", nameField: "title", idField: "id", isArray: true },
	},

	cms_archivePost: {
		name: "cms_archivePost",
		phrases: ["archive post", "unpublish post", "hide post", "take down"],
		relatedTools: ["getPost"],
		riskLevel: "moderate",
		requiresConfirmation: true,
		extraction: { path: "items", type: "post", nameField: "title", idField: "id", isArray: true },
	},

	cms_deletePost: {
		name: "cms_deletePost",
		phrases: ["delete post", "remove post", "trash post", "delete blog"],
		relatedTools: ["getPost"],
		riskLevel: "destructive",
		requiresConfirmation: true,
		extraction: null,
	},

	cms_listPosts: {
		name: "cms_listPosts",
		phrases: ["list posts", "show posts", "all posts", "get posts", "blog posts"],
		relatedTools: ["getPost"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "post", nameField: "title", idField: "id", isArray: true },
	},

	cms_getPost: {
		name: "cms_getPost",
		phrases: ["get post", "show post", "read post", "view post", "fetch post"],
		relatedTools: ["updatePost"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "post", nameField: "title", idField: "id", isArray: true },
	},

	cms_getCollectionEntries: {
		name: "cms_getCollectionEntries",
		phrases: ["get collection entries", "list entries", "collection items", "show entries"],
		relatedTools: ["getEntry"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "entry", nameField: "name", idField: "id", isArray: true },
	},

	cms_getEntryContent: {
		name: "cms_getEntryContent",
		phrases: ["get entry content", "entry details", "read entry", "fetch entry"],
		relatedTools: ["getEntry"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "items", type: "entry", nameField: "name", idField: "id", isArray: true },
	},

	// ==========================================================================
	// Utility Tools (unchanged)
	// ==========================================================================

	search_vector: {
		name: "search_vector",
		phrases: ["search vector", "semantic search", "similar content", "find similar", "content search"],
		relatedTools: ["cms_findResource"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	cms_findResource: {
		name: "cms_findResource",
		phrases: ["find resource", "search resource", "find by name", "locate resource", "search cms"],
		relatedTools: ["search_vector"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	http_get: {
		name: "http_get",
		phrases: ["http get", "fetch url", "get request", "api get", "external api", "fetch data"],
		relatedTools: ["http_post"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	http_post: {
		name: "http_post",
		phrases: ["http post", "post request", "send data", "api post", "submit to api"],
		relatedTools: ["http_get"],
		riskLevel: "moderate",
		requiresConfirmation: true,
		extraction: null,
	},

	plan_analyzeTask: {
		name: "plan_analyzeTask",
		phrases: ["analyze task", "create plan", "plan steps", "break down task", "task analysis"],
		relatedTools: [],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	web_quickSearch: {
		name: "web_quickSearch",
		phrases: ["web search", "search web", "search online", "search internet", "google", "find online", "look up"],
		relatedTools: ["web_deepResearch", "web_fetchContent"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	web_deepResearch: {
		name: "web_deepResearch",
		phrases: ["deep research", "research topic", "comprehensive research", "detailed research", "investigate"],
		relatedTools: ["web_quickSearch", "web_fetchContent"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: null,
	},

	web_fetchContent: {
		name: "web_fetchContent",
		phrases: ["fetch url", "get url content", "extract from url", "read webpage", "fetch page"],
		relatedTools: ["web_quickSearch"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: null,
	},

	pexels_searchPhotos: {
		name: "pexels_searchPhotos",
		phrases: ["pexels", "pexels search", "stock photos", "free photos", "search stock", "find stock photos"],
		relatedTools: ["pexels_downloadPhoto", "getImage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "photos", type: "pexels_photo", nameField: "alt", idField: "id", isArray: true },
	},

	pexels_downloadPhoto: {
		name: "pexels_downloadPhoto",
		phrases: ["download pexels", "download stock photo", "save pexels photo", "import stock photo"],
		relatedTools: ["pexels_searchPhotos", "getImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: { path: "image", type: "image", nameField: "filename", idField: "id" },
	},

	unsplash_searchPhotos: {
		name: "unsplash_searchPhotos",
		phrases: ["unsplash", "unsplash search", "stock photos", "free photos", "professional photos"],
		relatedTools: ["unsplash_downloadPhoto", "getImage"],
		riskLevel: "safe",
		requiresConfirmation: false,
		extraction: { path: "photos", type: "unsplash_photo", nameField: "alt", idField: "id", isArray: true },
	},

	unsplash_downloadPhoto: {
		name: "unsplash_downloadPhoto",
		phrases: ["download unsplash", "download stock photo", "save unsplash photo", "import stock photo"],
		relatedTools: ["unsplash_searchPhotos", "getImage"],
		riskLevel: "moderate",
		requiresConfirmation: false,
		extraction: { path: "$root", type: "image", nameField: "filename", idField: "imageId" },
	},
};

// Type helper for tool names
export type ToolName = keyof typeof TOOL_INDEX;

// Get all tool names
export const ALL_TOOL_NAMES = Object.keys(TOOL_INDEX) as ToolName[];
