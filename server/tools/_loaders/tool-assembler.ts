/**
 * Tool Assembler
 *
 * Merges per-tool metadata, schema, and execute function into AI SDK tools.
 * Per-tool folder structure: server/tools/{toolName}/
 */

import { tool } from "ai";
import type { z } from "zod";
import type { ToolMetadata } from "../_types/metadata";
import type { AgentContext } from "../_types/agent-context";

/**
 * Tool files from a per-tool folder
 */
export interface ToolFiles {
	metadata: ToolMetadata;
	schema: z.ZodType<any>;
	execute: (input: any, ctx: AgentContext) => Promise<any>;
}

/**
 * Assemble a single tool from its component files.
 *
 * @param toolName - Name of the tool
 * @param files - Tool files (metadata, schema, execute)
 * @returns AI SDK tool ready for use
 *
 * @example
 * const getPageTool = assembleTool('getPage', {
 *   metadata: getPageMetadata,
 *   schema: getPageSchema,
 *   execute: getPageExecute,
 * })
 */
export function assembleTool(toolName: string, files: ToolFiles) {
	return tool({
		description: files.metadata.description || `Execute ${toolName}`,
		inputSchema: files.schema,
		execute: async (input, { experimental_context }) => {
			const ctx = experimental_context as AgentContext;
			return files.execute(input, ctx);
		},
	});
}

/**
 * Get all tool folders in the tools directory.
 * Excludes underscore-prefixed folders (_types, _loaders, etc.)
 */
export async function getToolFolders(): Promise<string[]> {
	const fs = await import("node:fs");
	const path = await import("node:path");
	const { fileURLToPath } = await import("node:url");

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const toolsDir = path.join(__dirname, "..");

	const entries = fs.readdirSync(toolsDir, { withFileTypes: true });

	return entries
		.filter((entry) => {
			// Must be a directory
			if (!entry.isDirectory()) return false;
			// Exclude underscore-prefixed folders (_types, _loaders, etc.)
			if (entry.name.startsWith("_")) return false;
			return true;
		})
		.map((entry) => entry.name);
}

/**
 * Load all tools from per-tool folders.
 * Returns a record of tool name -> AI SDK tool.
 */
export async function loadAllTools(): Promise<Record<string, any>> {
	const toolFolders = await getToolFolders();
	const tools: Record<string, any> = {};

	for (const folder of toolFolders) {
		try {
			// Dynamic import of metadata and tool files
			const { default: metadata } = await import(
				`../${folder}/${folder}-metadata`
			);
			const { schema, execute } = await import(`../${folder}/${folder}-tool`);

			tools[metadata.name] = assembleTool(metadata.name, {
				metadata,
				schema,
				execute,
			});
		} catch (error: any) {
			console.warn(
				`[tool-assembler] Failed to load tool ${folder}: ${error.message}`,
			);
		}
	}

	return tools;
}
