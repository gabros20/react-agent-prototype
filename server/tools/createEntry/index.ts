/**
 * createEntry Tool - Index
 */

export { default as metadata } from "./createEntry-metadata";
export { schema, execute } from "./createEntry-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./createEntry-metadata";
import { schema, execute } from "./createEntry-tool";

export const createEntry = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
