/**
 * fetchContent Tool - Index
 */

export { default as metadata } from "./fetchContent-metadata";
export { schema, execute } from "./fetchContent-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./fetchContent-metadata";
import { schema, execute } from "./fetchContent-tool";

export const fetchContent = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
