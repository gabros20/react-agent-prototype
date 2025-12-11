/**
 * browseImages Tool - Index
 */

export { default as metadata } from "./browseImages-metadata";
export { schema, execute } from "./browseImages-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./browseImages-metadata";
import { schema, execute } from "./browseImages-tool";

export const browseImages = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
