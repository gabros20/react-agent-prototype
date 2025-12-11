/**
 * getPost Tool - Index
 */

export { default as metadata } from "./getPost-metadata";
export { schema, execute } from "./getPost-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./getPost-metadata";
import { schema, execute } from "./getPost-tool";

export const getPost = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
