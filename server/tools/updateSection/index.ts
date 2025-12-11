/**
 * updateSection Tool - Index
 */

export { default as metadata } from "./updateSection-metadata";
export { schema, execute } from "./updateSection-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./updateSection-metadata";
import { schema, execute } from "./updateSection-tool";

export const updateSection = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
