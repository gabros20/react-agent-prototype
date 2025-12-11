/**
 * getEntry Tool - Index
 */

export { default as metadata } from "./getEntry-metadata";
export { schema, execute } from "./getEntry-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./getEntry-metadata";
import { schema, execute } from "./getEntry-tool";

export const getEntry = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
