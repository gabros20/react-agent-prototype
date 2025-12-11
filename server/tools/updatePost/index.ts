/**
 * updatePost Tool - Index
 */

export { default as metadata } from "./updatePost-metadata";
export { schema, execute } from "./updatePost-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./updatePost-metadata";
import { schema, execute } from "./updatePost-tool";

export const updatePost = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
