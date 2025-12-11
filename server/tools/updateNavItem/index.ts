/**
 * updateNavItem Tool - Index
 */

export { default as metadata } from "./updateNavItem-metadata";
export { schema, execute } from "./updateNavItem-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./updateNavItem-metadata";
import { schema, execute } from "./updateNavItem-tool";

export const updateNavItem = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
