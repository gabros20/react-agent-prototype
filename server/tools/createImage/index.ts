/**
 * createImage Tool - Index
 */

export { default as metadata } from "./createImage-metadata";
export { schema, execute } from "./createImage-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./createImage-metadata";
import { schema, execute } from "./createImage-tool";

export const createImage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
