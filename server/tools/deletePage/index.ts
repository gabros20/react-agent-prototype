/**
 * deletePage Tool - Index
 *
 * Re-exports assembled tool for use in agent.
 */

export { default as metadata } from "./deletePage-metadata";
export { schema, execute } from "./deletePage-tool";

// Assembled tool export (for backward compatibility during migration)
import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./deletePage-metadata";
import { schema, execute } from "./deletePage-tool";

export const deletePage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
