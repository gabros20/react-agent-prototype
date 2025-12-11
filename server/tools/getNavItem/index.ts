/**
 * getNavItem Tool - Index
 */

export { default as metadata } from "./getNavItem-metadata";
export { schema, execute } from "./getNavItem-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./getNavItem-metadata";
import { schema, execute } from "./getNavItem-tool";

export const getNavItem = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
