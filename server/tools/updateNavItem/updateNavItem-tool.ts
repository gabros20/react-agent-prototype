/**
 * updateNavItem Tool Implementation
 *
 * Uses SiteSettingsService for all database operations (no direct DB access).
 */

import { z } from "zod";
import type { AgentContext } from "../_types/agent-context";

export const schema = z.object({
	label: z.string().describe("Current label of item to update"),
	newLabel: z.string().optional().describe("New label text"),
	href: z.string().optional().describe("New link URL"),
	location: z
		.enum(["header", "footer", "both"])
		.optional()
		.describe("New location"),
	visible: z.boolean().optional().describe("Show or hide the item"),
});

export type UpdateNavItemInput = z.infer<typeof schema>;

export async function execute(input: UpdateNavItemInput, ctx: AgentContext) {
	const siteSettingsService = ctx.services.siteSettingsService;

	try {
		const updates: {
			label?: string;
			href?: string;
			location?: "header" | "footer" | "both";
			visible?: boolean;
		} = {};
		if (input.newLabel) updates.label = input.newLabel;
		if (input.href) updates.href = input.href;
		if (input.location) updates.location = input.location;
		if (input.visible !== undefined) updates.visible = input.visible;

		const updatedItems = await siteSettingsService.updateNavigationItem(
			input.label,
			updates,
		);
		const item = updatedItems.find(
			(navItem: any) => navItem.label === (input.newLabel || input.label),
		);

		return {
			success: true,
			message: `Updated navigation item "${input.label}"${input.visible !== undefined ? ` (now ${item?.visible ? "visible" : "hidden"})` : ""}`,
			items: updatedItems,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to update navigation item",
		};
	}
}
