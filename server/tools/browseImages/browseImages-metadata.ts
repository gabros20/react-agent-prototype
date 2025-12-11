/**
 * browseImages Tool Metadata
 *
 * Unified external image search across Pexels/Unsplash.
 * Replaces: pexels_searchPhotos, unsplash_searchPhotos
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "browseImages",
	description:
		"Search Pexels/Unsplash for stock photos. Returns previews. Use importImage to download.",
	phrases: [
		"stock photo",
		"stock image",
		"find stock",
		"search stock",
		"external image",
		"pexels",
		"unsplash",
		"download photo",
		"get photo from",
		"browse stock",
		"free image",
		"royalty free",
		"photo library",
	],
	relatedTools: ["importImage", "getImage"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: "photos",
		type: "external-image",
		nameField: "alt",
		idField: "id",
		isArray: true,
	},
});
