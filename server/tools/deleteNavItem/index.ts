/**
 * deleteNavItem Tool - Index
 */

export { default as metadata } from "./deleteNavItem-metadata";
export { schema, execute } from "./deleteNavItem-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./deleteNavItem-metadata";
import { schema, execute } from "./deleteNavItem-tool";

export const deleteNavItem = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
