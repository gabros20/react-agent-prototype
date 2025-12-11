/**
 * acknowledgeRequest Tool - Index
 */

export { default as metadata } from "./acknowledgeRequest-metadata";
export { schema, execute } from "./acknowledgeRequest-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./acknowledgeRequest-metadata";
import { schema, execute } from "./acknowledgeRequest-tool";

export const acknowledgeRequestTool = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
