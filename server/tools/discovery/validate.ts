/**
 * Tool Index Validation
 *
 * Bidirectional validation at startup to ensure TOOL_INDEX is in sync
 * with ALL_TOOLS and CUSTOM_EXTRACTORS.
 *
 * Implements Phase 1.3.3 from DYNAMIC_TOOL_INJECTION_PLAN.md
 */

import { ALL_TOOLS } from "../all-tools";
import { TOOL_INDEX } from "./tool-index";
import { CUSTOM_EXTRACTORS } from "./custom-extractors";
import { ToolMetadataSchema } from "./types";

export interface ValidationResult {
	valid: boolean;
	toolCount: number;
	customExtractorCount: number;
	errors: string[];
	warnings: string[];
}

/**
 * Validate TOOL_INDEX against ALL_TOOLS at startup.
 * Throws if validation fails - fails fast on invalid configuration.
 */
export function validateToolIndex(): ValidationResult {
	const toolNames = Object.keys(ALL_TOOLS);
	const indexNames = Object.keys(TOOL_INDEX);
	const customNames = new Set(Object.keys(CUSTOM_EXTRACTORS));
	const errors: string[] = [];
	const warnings: string[] = [];

	// 1. Validate each metadata entry is well-formed
	for (const [name, meta] of Object.entries(TOOL_INDEX)) {
		try {
			ToolMetadataSchema.parse(meta);
		} catch (error: any) {
			errors.push(`Invalid metadata for ${name}: ${error.message}`);
		}

		// Validate name matches key
		if (meta.name !== name) {
			errors.push(
				`Metadata name mismatch: key is "${name}" but name field is "${meta.name}"`
			);
		}

		// Validate relatedTools reference existing tools
		for (const related of meta.relatedTools) {
			if (!ALL_TOOLS[related as keyof typeof ALL_TOOLS]) {
				warnings.push(
					`${name}: relatedTool "${related}" does not exist in ALL_TOOLS`
				);
			}
		}
	}

	// 2. Check ALL_TOOLS → TOOL_INDEX (every tool has metadata)
	const missingMetadata = toolNames.filter((name) => !TOOL_INDEX[name]);
	if (missingMetadata.length > 0) {
		errors.push(`Tools missing metadata: ${missingMetadata.join(", ")}`);
	}

	// 3. Check TOOL_INDEX → ALL_TOOLS (no orphan metadata)
	const orphanMetadata = indexNames.filter(
		(name) => !ALL_TOOLS[name as keyof typeof ALL_TOOLS]
	);
	if (orphanMetadata.length > 0) {
		errors.push(`Orphan metadata (no tool): ${orphanMetadata.join(", ")}`);
	}

	// 4. Check CUSTOM_EXTRACTORS → ALL_TOOLS (no orphan custom extractors)
	const orphanCustom = [...customNames].filter(
		(name) => !ALL_TOOLS[name as keyof typeof ALL_TOOLS]
	);
	if (orphanCustom.length > 0) {
		errors.push(`Orphan custom extractors: ${orphanCustom.join(", ")}`);
	}

	// 5. Check no tool has BOTH extraction schema AND custom extractor
	const duplicates = toolNames.filter(
		(name) =>
			TOOL_INDEX[name]?.extraction !== null && customNames.has(name)
	);
	if (duplicates.length > 0) {
		errors.push(
			`Tools with both schema AND custom extractor: ${duplicates.join(", ")}`
		);
	}

	const result: ValidationResult = {
		valid: errors.length === 0,
		toolCount: toolNames.length,
		customExtractorCount: customNames.size,
		errors,
		warnings,
	};

	// Throw if invalid
	if (!result.valid) {
		throw new Error(
			`Tool index validation failed:\n${errors.join("\n")}`
		);
	}

	// Log success with stats
	console.log(
		`✓ Tool index validated: ${toolNames.length} tools, ${customNames.size} custom extractors`
	);
	if (warnings.length > 0) {
		console.warn(`  Warnings:\n  - ${warnings.join("\n  - ")}`);
	}

	return result;
}

/**
 * Get validation stats without throwing (for health checks)
 */
export function getValidationStats(): ValidationResult {
	try {
		return validateToolIndex();
	} catch (error: any) {
		return {
			valid: false,
			toolCount: Object.keys(ALL_TOOLS).length,
			customExtractorCount: Object.keys(CUSTOM_EXTRACTORS).length,
			errors: [error.message],
			warnings: [],
		};
	}
}
