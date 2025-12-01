/**
 * System Prompt Generator
 *
 * Generates the system prompt for the CMS agent by composing modular XML files.
 * Uses Handlebars for template variable injection.
 *
 * Module structure:
 * - core/base-rules.xml: Identity, ReAct loop, confirmations, session info
 * - workflows/cms-pages.xml: Page and section management
 * - workflows/cms-images.xml: Image handling and display
 * - workflows/cms-posts.xml: Blog post management
 * - workflows/cms-navigation.xml: Navigation management
 * - workflows/web-research.xml: Exa AI web research
 */

import Handlebars from "handlebars";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SystemPromptContext {
	currentDate: string;
	workingMemory?: string;
}

// Module paths relative to prompts directory
const PROMPT_MODULES = [
	"core/base-rules.xml",
	"workflows/cms-pages.xml",
	"workflows/cms-images.xml",
	"workflows/cms-posts.xml",
	"workflows/cms-navigation.xml",
	"workflows/web-research.xml",
] as const;

// Cached compiled template
let compiledTemplate: ReturnType<typeof Handlebars.compile> | null = null;

/**
 * Load and compose all prompt modules into a single template
 */
function loadPromptModules(): string {
	const promptsDir = path.join(__dirname, "../prompts");

	const modules = PROMPT_MODULES.map((modulePath) => {
		const fullPath = path.join(promptsDir, modulePath);
		try {
			return fs.readFileSync(fullPath, "utf-8");
		} catch (error) {
			console.warn(`Warning: Could not load prompt module: ${modulePath}`);
			return "";
		}
	}).filter(Boolean);

	// Compose into single agent prompt
	return `<agent>
${modules.join("\n\n")}
</agent>`;
}

/**
 * Load and compile system prompt with context
 */
export function getSystemPrompt(context: SystemPromptContext): string {
	// Lazy load and compile template once
	if (!compiledTemplate) {
		const template = loadPromptModules();
		compiledTemplate = Handlebars.compile(template);
	}

	return compiledTemplate({
		...context,
		workingMemory: context.workingMemory || "",
	});
}

/**
 * Force reload of prompt modules (useful for development)
 */
export function reloadPromptModules(): void {
	compiledTemplate = null;
}
