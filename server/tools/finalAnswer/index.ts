/**
 * finalAnswer Tool - Index
 */

export { default as metadata } from "./finalAnswer-metadata";
export { schema, execute } from "./finalAnswer-tool";

import { assembleTool } from "../_loaders/tool-assembler";
import metadata from "./finalAnswer-metadata";
import { schema, execute } from "./finalAnswer-tool";

export const finalAnswerTool = assembleTool(metadata.name, {
	metadata,
	schema,
	execute,
});
