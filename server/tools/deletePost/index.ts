/**
 * deletePost Tool - Index
 */

export { default as metadata } from "./deletePost-metadata";
export { schema, execute } from "./deletePost-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./deletePost-metadata";
import { schema, execute } from "./deletePost-tool";

export const deletePost = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
