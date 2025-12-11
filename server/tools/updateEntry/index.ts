/**
 * updateEntry Tool - Index
 */

export { default as metadata } from "./updateEntry-metadata";
export { schema, execute } from "./updateEntry-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./updateEntry-metadata";
import { schema, execute } from "./updateEntry-tool";

export const updateEntry = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
