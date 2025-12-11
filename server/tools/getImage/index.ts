/**
 * getImage Tool - Index
 */

export { default as metadata } from "./getImage-metadata";
export { schema, execute } from "./getImage-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./getImage-metadata";
import { schema, execute } from "./getImage-tool";

export const getImage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
