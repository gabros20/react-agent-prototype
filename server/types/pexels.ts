/**
 * Pexels API Types
 *
 * TypeScript interfaces for Pexels Search and Photos APIs.
 * Based on: https://www.pexels.com/api/documentation/
 */

// ============================================================================
// API Request/Response Types
// ============================================================================

export type PexelsOrientation = "landscape" | "portrait" | "square";

export type PexelsColor =
	| "red"
	| "orange"
	| "yellow"
	| "green"
	| "turquoise"
	| "blue"
	| "violet"
	| "pink"
	| "brown"
	| "black"
	| "gray"
	| "white";

export interface PexelsPhoto {
	id: number;
	width: number;
	height: number;
	url: string;
	photographer: string;
	photographer_url: string;
	photographer_id: number;
	avg_color: string;
	alt: string;
	src: {
		original: string;
		large2x: string;
		large: string;
		medium: string;
		small: string;
		portrait: string;
		landscape: string;
		tiny: string;
	};
	liked: boolean;
}

export interface PexelsSearchResponse {
	page: number;
	per_page: number;
	photos: PexelsPhoto[];
	total_results: number;
	next_page?: string;
	prev_page?: string;
}

// ============================================================================
// Transformed Types (for internal use)
// ============================================================================

export interface PexelsPhotoResult {
	id: number;
	photographer: string;
	photographerUrl: string;
	alt: string;
	width: number;
	height: number;
	previewUrl: string; // medium size for preview
	downloadUrl: string; // original for download
	avgColor: string; // hex color for placeholder
}

export interface PexelsSearchResult {
	photos: PexelsPhotoResult[];
	totalResults: number;
	page: number;
}

export interface PexelsDownloadResult {
	buffer: Buffer;
	metadata: {
		filename: string;
		photographer: string;
		photographerUrl: string;
		alt: string;
		pexelsId: number;
		width: number;
		height: number;
	};
}

// ============================================================================
// Tool Input/Output Types
// ============================================================================

export interface PexelsSearchInput {
	query: string;
	perPage?: number;
	orientation?: PexelsOrientation;
	color?: PexelsColor;
}

export interface PexelsSearchOutput {
	success: boolean;
	photos: PexelsPhotoResult[];
	totalResults: number;
	error?: string;
}

export interface PexelsDownloadInput {
	photoId: number;
	sessionId: string;
}

export interface PexelsDownloadOutput {
	success: boolean;
	isNew: boolean;
	imageId?: string;
	photographer?: string;
	photographerUrl?: string;
	message?: string;
	error?: string;
}
