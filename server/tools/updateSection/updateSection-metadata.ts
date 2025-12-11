/**
 * updateSection Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "updateSection",
	description: "Update section content or attach image. Merges with existing.",
	phrases: [
		"update section",
		"edit section",
		"change section",
		"modify section",
		"update section content",
		"edit section text",
		"change title",
		"change heading",
		"update button",
		"edit hero",
		"update cta",
		"update section image",
		"change section image",
		"set section image",
		"replace section image",
		"set hero image",
		"set background image",
	],
	relatedTools: ["getSectionTemplate", "getSection", "getImage"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: null,
});
