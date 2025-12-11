/**
 * deleteImage Tool - Index
 */

export { default as metadata } from "./deleteImage-metadata";
export { schema, execute } from "./deleteImage-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./deleteImage-metadata";
import { schema, execute } from "./deleteImage-tool";

export const deleteImage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
