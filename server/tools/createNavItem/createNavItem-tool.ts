/**
 * createNavItem Tool Implementation
 */

import { z } from "zod";
import { SiteSettingsService } from "../../services/cms/site-settings-service";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	label: z.string().describe('Navigation link text (e.g., "Home", "About")'),
	href: z.string().describe('Link URL (for pages: "/pages/slug?locale=en")'),
	location: z.enum(["header", "footer", "both"]).describe("Where to show"),
});

export type CreateNavItemInput = z.infer<typeof schema>;

export async function execute(input: CreateNavItemInput, ctx: AgentContext) {
	const siteSettingsService = new SiteSettingsService(ctx.db);

	try {
		const updatedItems = await siteSettingsService.addNavigationItem({
			label: input.label,
			href: input.href,
			location: input.location,
		});

		return {
			success: true,
			message: `Added navigation item "${input.label}"`,
			count: updatedItems.length,
			items: updatedItems,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to add navigation item",
		};
	}
}
