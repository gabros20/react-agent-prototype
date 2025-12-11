/**
 * createSection Tool - Index
 */

export { default as metadata } from "./createSection-metadata";
export { schema, execute } from "./createSection-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./createSection-metadata";
import { schema, execute } from "./createSection-tool";

export const createSection = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
