/**
 * getPage Tool - Index
 *
 * Re-exports assembled tool for use in agent.
 */

export { default as metadata } from "./getPage-metadata";
export { schema, execute } from "./getPage-tool";

// Assembled tool export (for backward compatibility during migration)
import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./getPage-metadata";
import { schema, execute } from "./getPage-tool";

export const getPage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
