/**
 * updatePage Tool - Index
 *
 * Re-exports assembled tool for use in agent.
 */

export { default as metadata } from "./updatePage-metadata";
export { schema, execute } from "./updatePage-tool";

// Assembled tool export (for backward compatibility during migration)
import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./updatePage-metadata";
import { schema, execute } from "./updatePage-tool";

export const updatePage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
