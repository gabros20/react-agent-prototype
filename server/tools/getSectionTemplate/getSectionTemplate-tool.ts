/**
 * getSectionTemplate Tool Implementation
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z
	.object({
		id: z.string().uuid().optional().describe("Get by section template UUID"),
		key: z
			.string()
			.optional()
			.describe('Get by section key (e.g., "hero", "feature")'),
		all: z.boolean().optional().describe("Get all section templates"),
	})
	.refine((data) => data.id || data.key || data.all, {
		message: "Provide id, key, or set all: true",
	});

export type GetSectionTemplateInput = z.infer<typeof schema>;

export async function execute(input: GetSectionTemplateInput, ctx: AgentContext) {
	if (input.id) {
		const sectionTemplate =
			await ctx.services.sectionService.getSectionTemplateById(input.id);
		if (!sectionTemplate) {
			return {
				success: false,
				count: 0,
				items: [],
				error: `Section template not found: ${input.id}`,
			};
		}
		return {
			success: true,
			count: 1,
			items: [formatSectionTemplate(sectionTemplate)],
		};
	}

	if (input.key) {
		const sectionTemplate =
			await ctx.services.sectionService.getSectionTemplateByKey(input.key);
		if (!sectionTemplate) {
			return {
				success: false,
				count: 0,
				items: [],
				error: `Section template not found: ${input.key}`,
			};
		}
		return {
			success: true,
			count: 1,
			items: [formatSectionTemplate(sectionTemplate)],
		};
	}

	if (input.all) {
		const sectionTemplates =
			await ctx.services.sectionService.listSectionTemplates();
		return {
			success: true,
			count: sectionTemplates.length,
			items: sectionTemplates.map((st: any) => ({
				id: st.id,
				key: st.key,
				name: st.name,
				description: st.description,
				templateFile: st.templateFile,
			})),
		};
	}

	return {
		success: false,
		count: 0,
		items: [],
		error: "Provide id, key, or set all: true",
	};
}

function formatSectionTemplate(sectionTemplate: any) {
	const fieldsData =
		typeof sectionTemplate.fields === "string"
			? JSON.parse(sectionTemplate.fields)
			: sectionTemplate.fields;

	const fields: { key: string; type: string; label?: string }[] = [];
	if (fieldsData?.rows) {
		for (const row of fieldsData.rows) {
			if (row.slots) {
				for (const slot of row.slots) {
					fields.push({
						key: slot.key,
						type: slot.type,
						label: slot.label,
					});
				}
			}
		}
	}

	return {
		id: sectionTemplate.id,
		key: sectionTemplate.key,
		name: sectionTemplate.name,
		description: sectionTemplate.description,
		templateFile: sectionTemplate.templateFile,
		fields,
	};
}
