/**
 * getSection Tool - Index
 */

export { default as metadata } from "./getSection-metadata";
export { schema, execute } from "./getSection-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./getSection-metadata";
import { schema, execute } from "./getSection-tool";

export const getSection = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
