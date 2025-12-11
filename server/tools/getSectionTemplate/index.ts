/**
 * getSectionTemplate Tool - Index
 */

export { default as metadata } from "./getSectionTemplate-metadata";
export { schema, execute } from "./getSectionTemplate-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./getSectionTemplate-metadata";
import { schema, execute } from "./getSectionTemplate-tool";

export const getSectionTemplate = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
