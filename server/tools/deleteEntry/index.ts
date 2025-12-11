/**
 * deleteEntry Tool - Index
 */

export { default as metadata } from "./deleteEntry-metadata";
export { schema, execute } from "./deleteEntry-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./deleteEntry-metadata";
import { schema, execute } from "./deleteEntry-tool";

export const deleteEntry = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
