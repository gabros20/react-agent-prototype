/**
 * createPage Tool - Index
 *
 * Re-exports assembled tool for use in agent.
 */

export { default as metadata } from "./createPage-metadata";
export { schema, execute } from "./createPage-tool";

// Assembled tool export (for backward compatibility during migration)
import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./createPage-metadata";
import { schema, execute } from "./createPage-tool";

export const createPage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
