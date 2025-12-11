/**
 * deleteSection Tool - Index
 */

export { default as metadata } from "./deleteSection-metadata";
export { schema, execute } from "./deleteSection-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./deleteSection-metadata";
import { schema, execute } from "./deleteSection-tool";

export const deleteSection = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
