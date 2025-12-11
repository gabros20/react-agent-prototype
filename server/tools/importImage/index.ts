/**
 * importImage Tool - Index
 */

export { default as metadata } from "./importImage-metadata";
export { schema, execute } from "./importImage-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./importImage-metadata";
import { schema, execute } from "./importImage-tool";

export const importImage = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
