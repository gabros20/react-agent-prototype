/**
 * deleteNavItem Tool Implementation
 */

import { z } from "zod";
import { SiteSettingsService } from "../../services/cms/site-settings-service";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	labels: z
		.array(z.string())
		.describe("Labels of items to remove (always array, even for single)"),
});

export type DeleteNavItemInput = z.infer<typeof schema>;

export async function execute(input: DeleteNavItemInput, ctx: AgentContext) {
	const siteSettingsService = new SiteSettingsService(ctx.db);

	try {
		const deleted: string[] = [];
		let updatedItems: any[] = [];

		for (const label of input.labels) {
			try {
				updatedItems = await siteSettingsService.removeNavigationItem(label);
				deleted.push(label);
			} catch {
				// Continue with remaining items
			}
		}

		if (deleted.length === 0) {
			return {
				success: false,
				error: "No navigation items found with provided labels",
			};
		}

		return {
			success: true,
			message: `Removed ${deleted.length} navigation item(s)`,
			deleted,
			count: updatedItems.length,
			items: updatedItems,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to remove navigation item(s)",
		};
	}
}
