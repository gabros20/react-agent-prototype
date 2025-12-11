/**
 * getNavItem Tool Implementation
 */

import { z } from "zod";
import { SiteSettingsService } from "../../services/cms/site-settings-service";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	label: z.string().optional().describe("Get single item by label"),
	all: z
		.boolean()
		.optional()
		.default(true)
		.describe("Get all navigation items (default)"),
});

export type GetNavItemInput = z.infer<typeof schema>;

export async function execute(input: GetNavItemInput, ctx: AgentContext) {
	const siteSettingsService = new SiteSettingsService(ctx.db);

	try {
		const navItems = await siteSettingsService.getNavigationItems();

		if (input.label) {
			const item = navItems.find((n: any) => n.label === input.label);
			if (!item) {
				return {
					success: false,
					count: 0,
					items: [],
					error: `Navigation item not found: ${input.label}`,
				};
			}
			return {
				success: true,
				count: 1,
				items: [item],
			};
		}

		return {
			success: true,
			count: navItems.length,
			items: navItems,
		};
	} catch (error) {
		return {
			success: false,
			count: 0,
			items: [],
			error: error instanceof Error ? error.message : "Failed to get navigation",
		};
	}
}
