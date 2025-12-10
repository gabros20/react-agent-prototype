/**
 * Per-Tool Instructions (TOOL_INSTRUCTIONS)
 *
 * Detailed protocols for each tool, injected into system prompt via prepareStep
 * when the tool becomes active. Follows the pattern:
 *
 * BEFORE: Prerequisites before calling
 * AFTER: Follow-up actions after success
 * NEXT: Suggested next tools in workflow
 * GOTCHA: Edge cases and critical rules
 *
 * These are kept separate from tool descriptions (which should be SHORT)
 * to enable token-efficient context injection.
 *
 * Hot-reload: Instructions are always loaded from JSON file on each access,
 * enabling live updates without restarting the server in both dev and production.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePromptText } from "../../utils/prompt-normalizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load tool instructions from JSON file (hot-reload enabled)
 */
function loadToolInstructionsFromFile(): Record<string, string> {
	const jsonPath = path.join(__dirname, "tool-instructions.json");
	const content = fs.readFileSync(jsonPath, "utf-8");
	return JSON.parse(content);
}

/**
 * Static tool instructions (fallback only - used if JSON file fails to load)
 * Keep in sync with tool-instructions.json as backup
 */
const STATIC_TOOL_INSTRUCTIONS: Record<string, string> = {
	// ============================================================================
	// Posts
	// ============================================================================

	cms_listPosts: `BEFORE: None required
AFTER: Show count and titles to user
NEXT: cms_getPost (view details), cms_createPost (new post)
GOTCHA: Returns all posts by default. Use status param to filter (draft/published/archived).`,

	cms_getPost: `BEFORE: Use cms_listPosts if slug is unknown
AFTER: Show post details (title, status, slug)
NEXT: cms_updatePost, cms_publishPost, cms_deletePost
GOTCHA: Returns full content. Use for viewing/editing specific posts.`,

	cms_createPost: `BEFORE: cms_listPosts to check for duplicate titles
AFTER: Ask if user wants cover image; ask if ready to publish
NEXT: pexels_searchPhotos (cover image), cms_publishPost
GOTCHA: Creates DRAFT only. Set BOTH featuredImage AND content.cover for covers. Blog posts should be substantial (500+ words for guides).`,

	cms_updatePost: `BEFORE: cms_getPost to verify post exists and get current state
AFTER: Confirm changes made
NEXT: cms_publishPost if ready to go live
GOTCHA: For covers, set BOTH featuredImage AND content.cover in same call. Content MERGES with existing.`,

	cms_publishPost: `BEFORE: Post must exist as draft (verify with cms_getPost)
AFTER: Confirm publication, offer preview at /posts/blog/{slug}
NEXT: cms_getPost (show final state)
GOTCHA: Requires confirmation flow - first call returns requiresConfirmation, ask user, then call with confirmed:true.`,

	cms_archivePost: `BEFORE: Post must be published (verify with cms_getPost)
AFTER: Confirm archival
NEXT: cms_listPosts (show updated list)
GOTCHA: Archived posts are hidden but not deleted. Requires confirmed:true.`,

	cms_deletePost: `BEFORE: Verify post exists with cms_getPost
AFTER: Confirm deletion
NEXT: cms_listPosts
GOTCHA: PERMANENT deletion. Requires confirmed:true. Cannot be undone.`,

	// ============================================================================
	// Pages
	// ============================================================================

	cms_listPages: `BEFORE: None required
AFTER: Show count and page names to user
NEXT: cms_getPage (view details), cms_createPageWithContent (new page)
GOTCHA: Returns lightweight list (id, name, slug). Use cms_getPage for full details.`,

	cms_getPage: `BEFORE: cms_listPages if slug unknown
AFTER: If editing, suggest fetching specific sections
NEXT: cms_getPageSections, cms_updatePage
GOTCHA: Default is lightweight (no content). Use includeContent:true only when ALL content needed (expensive).`,

	cms_createPage: `BEFORE: cms_listPages to check slug availability
AFTER: Offer to add sections, add to navigation
NEXT: cms_addSectionToPage, cms_addNavigationItem
GOTCHA: Creates empty page. Use cms_createPageWithContent for page with sections.`,

	cms_createPageWithContent: `BEFORE: cms_listPages to check slug availability
AFTER: Offer to add images to sections, add to navigation
NEXT: cms_searchImages, cms_updateSectionImage, cms_addNavigationItem
GOTCHA: Creates page with placeholder images. Use cms_updateSectionImage to attach real images after.`,

	cms_updatePage: `BEFORE: cms_getPage to verify page exists
AFTER: Confirm changes
NEXT: cms_getPage (verify), cms_updateSectionContent (edit sections)
GOTCHA: Updates page metadata only. Use cms_updateSectionContent for section content.`,

	cms_deletePage: `BEFORE: cms_getPage to verify; cms_getNavigation to check if in menu
AFTER: Confirm deletion
NEXT: cms_removeNavigationItem if was in navigation
GOTCHA: CASCADE deletes all sections. Requires confirmed:true. Use removeFromNavigation:true to clean up nav.`,

	// ============================================================================
	// Sections
	// ============================================================================

	cms_listSectionTemplates: `BEFORE: None required
AFTER: Show available section types to user
NEXT: cms_getSectionFields (see required fields), cms_addSectionToPage
GOTCHA: Returns template definitions, not page sections. Use cms_getPageSections for sections on a page.`,

	cms_getSectionFields: `BEFORE: Know sectionDefId or key (from cms_listSectionTemplates)
AFTER: Show field schema to user if they need to update content
NEXT: cms_updateSectionContent with correct field names
GOTCHA: Use this to discover field names (title, subtitle, backgroundImage, etc.) before updating content.`,

	cms_getPageSections: `BEFORE: cms_getPage to get pageId
AFTER: Show section list to user
NEXT: cms_getSectionContent (specific section), cms_updateSectionContent
GOTCHA: Default lightweight. Use includeContent:true only when needed.`,

	cms_getSectionContent: `BEFORE: cms_getPageSections to get pageSectionId
AFTER: Show content to user
NEXT: cms_updateSectionContent (edit), cms_updateSectionImage (change image)
GOTCHA: Returns full content for ONE section. More efficient than fetching entire page.`,

	cms_addSectionToPage: `BEFORE: cms_getPage (get pageId), cms_listSectionTemplates (get sectionDefId)
AFTER: Show new pageSectionId, suggest adding content
NEXT: cms_updateSectionContent, cms_updateSectionImage
GOTCHA: Returns pageSectionId - use this for content updates, not sectionDefId.`,

	cms_updateSectionContent: `BEFORE: cms_getSectionFields to know field names
AFTER: Verify update with cms_getSectionContent if needed
NEXT: cms_updateSectionImage (for images)
GOTCHA: MERGES with existing - only send fields you want to change. Don't resend all fields.`,

	cms_deletePageSection: `BEFORE: cms_getPageSections to verify section exists
AFTER: Confirm deletion
NEXT: cms_getPageSections (verify removal)
GOTCHA: Requires confirmed:true. Cannot be undone.`,

	cms_deletePageSections: `BEFORE: cms_getPageSections to get all pageSectionIds
AFTER: Confirm batch deletion
NEXT: cms_getPageSections (verify)
GOTCHA: More efficient for deleting multiple sections. Requires confirmed:true.`,

	// ============================================================================
	// Images
	// ============================================================================

	cms_searchImages: `BEFORE: None required
AFTER: Show results with local URLs, ask which to use
NEXT: cms_updateSectionImage (attach to section)
GOTCHA: EXPAND short queries: "AI" -> "artificial intelligence robot technology". Always search existing images before Pexels.`,

	cms_findImage: `BEFORE: None required
AFTER: Show image with local URL
NEXT: cms_updateSectionImage
GOTCHA: For finding ONE specific image by description. Use cms_searchImages for multiple results.`,

	cms_listAllImages: `BEFORE: None required
AFTER: Show all images with previews
NEXT: cms_searchImages (filter), cms_updateSectionImage (use)
GOTCHA: May return many results. Consider cms_searchImages with query for filtering.`,

	cms_addImageToSection: `BEFORE: cms_getSectionFields to know image field names
AFTER: Verify with cms_getSectionContent
NEXT: None (operation complete)
GOTCHA: Deprecated - use cms_updateSectionImage instead.`,

	cms_updateSectionImage: `BEFORE: cms_getSectionFields (get field names), cms_searchImages (get imageId)
AFTER: Confirm image attached
NEXT: cms_getSectionContent (verify)
GOTCHA: imageField must match section schema (e.g., "backgroundImage", "image", "cover").`,

	cms_replaceImage: `BEFORE: cms_searchImages to find both old and new image IDs
AFTER: Confirm replacement
NEXT: cms_getSectionContent (verify)
GOTCHA: Replaces image across all usages. Use for site-wide image updates.`,

	cms_deleteImage: `BEFORE: Check image usage (may be in sections)
AFTER: Confirm deletion
NEXT: None
GOTCHA: Requires confirmed:true. Check for usages first to avoid broken images.`,

	// ============================================================================
	// Pexels (Stock Photos)
	// ============================================================================

	pexels_searchPhotos: `BEFORE: cms_searchImages to check if we already have similar images
AFTER: Show results with previews, ask which to download
NEXT: pexels_downloadPhoto
GOTCHA: Use SPECIFIC queries: "monstera deliciosa leaf close-up" not "plant". Evaluate alt text before downloading.`,

	pexels_downloadPhoto: `BEFORE: MUST use pexels_searchPhotos first to get photoId
AFTER: Confirm download, show LOCAL url from response
NEXT: cms_updateSectionImage (attach), cms_updatePost (set cover)
GOTCHA: Use LOCAL url from response (/uploads/...). NEVER use pexels.com URLs or https://yourdomain.com/... - only relative paths starting with /uploads/. Include photographer credit.`,

	// ============================================================================
	// Navigation
	// ============================================================================

	cms_getNavigation: `BEFORE: None required
AFTER: Show menu items to user
NEXT: cms_addNavigationItem, cms_toggleNavigationItem
GOTCHA: Shows header/footer navigation items with enabled status.`,

	cms_addNavigationItem: `BEFORE: cms_listPages to get correct slug
AFTER: Confirm addition
NEXT: cms_getNavigation (verify)
GOTCHA: href format: /pages/{slug}?locale=en. location: "header", "footer", or "both".`,

	cms_updateNavigationItem: `BEFORE: cms_getNavigation to verify item exists
AFTER: Confirm update
NEXT: cms_getNavigation (verify)
GOTCHA: Match label exactly to find the item.`,

	cms_removeNavigationItem: `BEFORE: cms_getNavigation to verify item exists
AFTER: Confirm removal
NEXT: cms_getNavigation (verify)
GOTCHA: Use cms_toggleNavigationItem to hide without deleting.`,

	cms_toggleNavigationItem: `BEFORE: cms_getNavigation to verify item exists
AFTER: Confirm toggle
NEXT: cms_getNavigation (verify)
GOTCHA: Better than remove - hides item without losing configuration.`,

	// ============================================================================
	// Entries (Collections)
	// ============================================================================

	cms_getCollectionEntries: `BEFORE: Know collectionId
AFTER: Show entries to user
NEXT: cms_getEntryContent (specific entry)
GOTCHA: Default lightweight. Use includeContent:true only when needed.`,

	cms_getEntryContent: `BEFORE: cms_getCollectionEntries to get entryId
AFTER: Show entry details
NEXT: None (entries are read-only through these tools)
GOTCHA: Returns full content for ONE entry.`,

	// ============================================================================
	// Search
	// ============================================================================

	search_vector: `BEFORE: None required
AFTER: Show results with similarity scores
NEXT: Relevant CMS tool for the resource type found
GOTCHA: Semantic search - finds related content, not exact matches. Use type param to filter.`,

	cms_findResource: `BEFORE: None required
AFTER: Show matches
NEXT: cms_getPage/cms_getSectionContent based on type
GOTCHA: Fuzzy match on name/slug. Specify resourceType: "page", "section", or "collection".`,

	// ============================================================================
	// HTTP
	// ============================================================================

	http_get: `BEFORE: Validate URL is external and safe
AFTER: Parse response, show relevant data
NEXT: Depends on use case
GOTCHA: For fetching external API data. Respect rate limits.`,

	http_post: `BEFORE: Validate URL and payload
AFTER: Confirm response
NEXT: Depends on use case
GOTCHA: Requires confirmed:true. Use for external API submissions only.`,

	// ============================================================================
	// Web Search (Tavily)
	// ============================================================================

	web_quickSearch: `BEFORE: None required
AFTER: Show results with snippets, cite sources
NEXT: web_fetchContent (get full page), cms_createPost (use for content)
GOTCHA: Fast (~1-2s). Good for facts, news, links. Use topic param: general/news/finance.`,

	web_deepResearch: `BEFORE: Consider if quickSearch is sufficient
AFTER: Show AI-generated answer with citations
NEXT: cms_createPost (create content from findings)
GOTCHA: More comprehensive (~3-5s). Returns AI answer + sources. Use for blog post research.`,

	web_fetchContent: `BEFORE: web_quickSearch to get URL
AFTER: Show extracted content
NEXT: cms_createPost (use content)
GOTCHA: Fetches full markdown/text from URLs. Up to 10 URLs per call.`,

	// ============================================================================
	// Planning
	// ============================================================================

	plan_analyzeTask: `BEFORE: None required
AFTER: Execute the planned steps
NEXT: First tool in the generated plan
GOTCHA: For complex multi-step tasks. Returns ordered steps with suggested tool calls.`,

	// ============================================================================
	// Core Tools (always available)
	// ============================================================================

	final_answer: `BEFORE: User asks to verify/check? → STOP, call verification tool (cms_getPost, cms_listPosts) FIRST, get result, THEN call final_answer. Complete all tool calls. Only report what tool results prove.
AFTER: None (ends turn)
NEXT: None
GOTCHA:
- NEVER say 'I will check' - actually check first
- NEVER repeat previous response - verify fresh and answer concisely
- Follow-up questions get SHORT answers (e.g., 'Yes, published' not full details)
- Images: use relative /uploads/... paths only`,

	tool_search: `BEFORE: None required
AFTER: USE the discovered tools to complete the task. Discovery alone does NOT fulfill user requests.
NEXT: Call discovered tools (e.g., cms_listPages, cms_createPost, etc.)
GOTCHA: tool_search only finds tools - you MUST then call those tools. Search by CAPABILITY keywords ("create post", "list pages") not content.`,

	acknowledge: `BEFORE: None required - call FIRST before any other tools
AFTER: Proceed with tool_search or discovered tools to fulfill the request
NEXT: tool_search (discover capabilities), or discovered CMS tools
GOTCHA: Vary your acknowledgments naturally. Match tone to request complexity:
- Quick asks: "Sure!", "On it.", "One sec..."
- Listing: "Let me pull that up.", "Checking..."
- Creating: "I'll set that up.", "Working on it."
- Complex: "Good idea, let me work through this."
NEVER use the same "I'll check the X for you" pattern repeatedly.`,
};

/**
 * Get tool instructions - always loads from JSON file (hot-reload enabled)
 * Falls back to static instructions only if JSON file cannot be loaded
 */
function getInstructions(): Record<string, string> {
	try {
		return loadToolInstructionsFromFile();
	} catch (error) {
		console.warn("[tool-instructions] Failed to load JSON, using static fallback:", error);
		return STATIC_TOOL_INSTRUCTIONS;
	}
}

/**
 * Exported for backwards compatibility (always reads fresh from JSON file)
 */
export const TOOL_INSTRUCTIONS = new Proxy({} as Record<string, string>, {
	get(_, prop: string) {
		return getInstructions()[prop];
	},
	ownKeys() {
		return Object.keys(getInstructions());
	},
	getOwnPropertyDescriptor(_, prop: string) {
		const instructions = getInstructions();
		if (prop in instructions) {
			return { enumerable: true, configurable: true, value: instructions[prop] };
		}
		return undefined;
	},
});

/**
 * Get instructions for a specific tool
 */
export function getToolInstruction(toolName: string): string | undefined {
	return getInstructions()[toolName];
}

/**
 * Get instructions for multiple tools, formatted for system prompt injection
 */
export function getToolInstructions(toolNames: string[]): string {
	const instructions = getInstructions();
	const raw = toolNames
		.map((name) => {
			const instruction = instructions[name];
			if (!instruction) return null;
			// Wrap each tool's protocol in an XML-like tag so it slots cleanly into
			// <tool-usage-instructions> ... </tool-usage-instructions> in agent.xml.
			// Example:
			// <tool_search>
			// BEFORE: ...
			// ...
			// </tool_search>
			return `<${name}>\n${instruction}\n</${name}>`;
		})
		.filter(Boolean)
		.join("\n\n");

	return normalizePromptText(raw);
}
