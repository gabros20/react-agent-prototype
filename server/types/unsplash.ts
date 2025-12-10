/**
 * Unsplash API Types
 *
 * TypeScript interfaces for Unsplash Search and Photos APIs.
 * Based on: https://unsplash.com/documentation
 */

// ============================================================================
// API Request/Response Types
// ============================================================================

export type UnsplashOrientation = "landscape" | "portrait" | "squarish";

export type UnsplashColor =
	| "black_and_white"
	| "black"
	| "white"
	| "yellow"
	| "orange"
	| "red"
	| "purple"
	| "magenta"
	| "green"
	| "teal"
	| "blue";

export interface UnsplashPhotoUrls {
	raw: string;
	full: string;
	regular: string;
	small: string;
	thumb: string;
}

export interface UnsplashPhotoLinks {
	self: string;
	html: string;
	download: string;
	download_location: string;
}

export interface UnsplashUser {
	id: string;
	username: string;
	name: string;
	portfolio_url: string | null;
	links: {
		self: string;
		html: string;
		photos: string;
	};
}

export interface UnsplashPhoto {
	id: string;
	created_at: string;
	updated_at: string;
	width: number;
	height: number;
	color: string;
	blur_hash: string | null;
	likes: number;
	liked_by_user: boolean;
	description: string | null;
	alt_description: string | null;
	urls: UnsplashPhotoUrls;
	links: UnsplashPhotoLinks;
	user: UnsplashUser;
}

export interface UnsplashSearchResponse {
	total: number;
	total_pages: number;
	results: UnsplashPhoto[];
}

export interface UnsplashDownloadResponse {
	url: string;
}

// ============================================================================
// Transformed Types (for internal use)
// ============================================================================

export interface UnsplashPhotoResult {
	id: string;
	photographer: string;
	photographerUrl: string;
	alt: string;
	width: number;
	height: number;
	previewUrl: string; // small size for preview
	downloadUrl: string; // full size for download
	color: string; // hex color for placeholder
}

export interface UnsplashSearchResult {
	photos: UnsplashPhotoResult[];
	totalResults: number;
	totalPages: number;
}

export interface UnsplashDownloadResult {
	buffer: Buffer;
	metadata: {
		filename: string;
		photographer: string;
		photographerUrl: string;
		alt: string;
		unsplashId: string;
		width: number;
		height: number;
	};
}
