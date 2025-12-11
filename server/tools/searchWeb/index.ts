/**
 * searchWeb Tool - Index
 */

export { default as metadata } from "./searchWeb-metadata";
export { schema, execute } from "./searchWeb-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./searchWeb-metadata";
import { schema, execute } from "./searchWeb-tool";

export const searchWeb = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
