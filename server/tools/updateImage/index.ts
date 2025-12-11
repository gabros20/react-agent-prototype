/**
 * updateImage Tool - Index
 */

export { default as metadata } from "./updateImage-metadata";
export { schema, execute } from "./updateImage-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./updateImage-metadata";
import { schema, execute } from "./updateImage-tool";

export const updateImage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
