/**
 * All Tools - AI SDK v6 Pattern
 *
 * Clean export of all 31 atomic tools.
 * No legacy aliases, no composite tools, no backward compatibility.
 *
 * Per-tool folder structure: server/tools/{toolName}/
 * Tool prompts: server/prompts/tools/{toolName}-prompt.xml
 */

// Core tools
import { searchToolsTool } from "./searchTools";
import { finalAnswerTool } from "./finalAnswer";
import { acknowledgeRequestTool } from "./acknowledgeRequest";

// Page tools
import { getPage } from "./getPage";
import { createPage } from "./createPage";
import { updatePage } from "./updatePage";
import { deletePage } from "./deletePage";

// Post tools
import { getPost } from "./getPost";
import { createPost } from "./createPost";
import { updatePost } from "./updatePost";
import { deletePost } from "./deletePost";

// Section tools
import { getSectionTemplate } from "./getSectionTemplate";
import { getSection } from "./getSection";
import { createSection } from "./createSection";
import { updateSection } from "./updateSection";
import { deleteSection } from "./deleteSection";

// Navigation tools
import { getNavItem } from "./getNavItem";
import { createNavItem } from "./createNavItem";
import { updateNavItem } from "./updateNavItem";
import { deleteNavItem } from "./deleteNavItem";

// Image tools (local)
import { getImage } from "./getImage";
import { createImage } from "./createImage";
import { updateImage } from "./updateImage";
import { deleteImage } from "./deleteImage";

// Entry tools
import { getEntry } from "./getEntry";
import { createEntry } from "./createEntry";
import { updateEntry } from "./updateEntry";
import { deleteEntry } from "./deleteEntry";

// External image tools (unified)
import { browseImages } from "./browseImages";
import { importImage } from "./importImage";

// Web tools (unified)
import { searchWeb } from "./searchWeb";
import { fetchContent } from "./fetchContent";

// ============================================================================
// ALL_TOOLS - 31 Atomic Tools
// ============================================================================

export const ALL_TOOLS = {
	// Core (3)
	searchTools: searchToolsTool,
	finalAnswer: finalAnswerTool,
	acknowledgeRequest: acknowledgeRequestTool,

	// Pages (4)
	getPage,
	createPage,
	updatePage,
	deletePage,

	// Posts (4)
	getPost,
	createPost,
	updatePost,
	deletePost,

	// Sections (5)
	getSectionTemplate,
	getSection,
	createSection,
	updateSection,
	deleteSection,

	// Navigation (4)
	getNavItem,
	createNavItem,
	updateNavItem,
	deleteNavItem,

	// Images - Local (4)
	getImage,
	createImage,
	updateImage,
	deleteImage,

	// Entries (4)
	getEntry,
	createEntry,
	updateEntry,
	deleteEntry,

	// Images - External (2)
	browseImages,
	importImage,

	// Web (2)
	searchWeb,
	fetchContent,
} as const;

// Type helper
export type ToolName = keyof typeof ALL_TOOLS;
