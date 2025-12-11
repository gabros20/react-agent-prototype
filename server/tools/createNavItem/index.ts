/**
 * createNavItem Tool - Index
 */

export { default as metadata } from "./createNavItem-metadata";
export { schema, execute } from "./createNavItem-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./createNavItem-metadata";
import { schema, execute } from "./createNavItem-tool";

export const createNavItem = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
