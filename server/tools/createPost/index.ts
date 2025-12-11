/**
 * createPost Tool - Index
 */

export { default as metadata } from "./createPost-metadata";
export { schema, execute } from "./createPost-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./createPost-metadata";
import { schema, execute } from "./createPost-tool";

export const createPost = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
