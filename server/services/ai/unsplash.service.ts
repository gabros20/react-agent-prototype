/**
 * Unsplash Stock Photo Service
 *
 * Handles Unsplash API interactions:
 * - Search photos by keyword
 * - Download photos for processing
 * - Track downloads (required by Unsplash API guidelines)
 */

import type {
	UnsplashSearchResponse,
	UnsplashPhoto,
	UnsplashPhotoResult,
	UnsplashSearchResult,
	UnsplashDownloadResult,
	UnsplashDownloadResponse,
	UnsplashOrientation,
	UnsplashColor,
} from "../../types/unsplash";

const UNSPLASH_BASE_URL = "https://api.unsplash.com";

interface UnsplashServiceConfig {
	accessKey: string;
}

export class UnsplashService {
	private accessKey: string;

	constructor(config?: Partial<UnsplashServiceConfig>) {
		this.accessKey = config?.accessKey || process.env.UNSPLASH_ACCESS_KEY || "";

		if (!this.accessKey) {
			console.warn(
				"[UnsplashService] No API key configured. Set UNSPLASH_ACCESS_KEY environment variable."
			);
		}
	}

	/**
	 * Make authenticated request to Unsplash API
	 */
	private async request<T>(endpoint: string): Promise<T> {
		const url = `${UNSPLASH_BASE_URL}${endpoint}`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Client-ID ${this.accessKey}`,
				"Accept-Version": "v1",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Unsplash API error (${response.status}): ${errorText}`);
		}

		return response.json();
	}

	// ============================================================================
	// Search API
	// ============================================================================

	/**
	 * Search photos by query with optional filters
	 */
	async search(params: {
		query: string;
		perPage?: number;
		page?: number;
		orientation?: UnsplashOrientation;
		color?: UnsplashColor;
		orderBy?: "relevant" | "latest";
	}): Promise<UnsplashSearchResult> {
		const queryParams = new URLSearchParams({
			query: params.query,
			per_page: String(params.perPage || 10),
			page: String(params.page || 1),
		});

		if (params.orientation) {
			queryParams.set("orientation", params.orientation);
		}

		if (params.color) {
			queryParams.set("color", params.color);
		}

		if (params.orderBy) {
			queryParams.set("order_by", params.orderBy);
		}

		const response = await this.request<UnsplashSearchResponse>(
			`/search/photos?${queryParams.toString()}`
		);

		return {
			photos: response.results.map(this.transformPhoto),
			totalResults: response.total,
			totalPages: response.total_pages,
		};
	}

	/**
	 * Transform Unsplash API photo to internal format
	 */
	private transformPhoto(photo: UnsplashPhoto): UnsplashPhotoResult {
		return {
			id: photo.id,
			photographer: photo.user.name,
			photographerUrl: photo.user.links.html,
			alt: photo.alt_description || photo.description || `Photo by ${photo.user.name}`,
			width: photo.width,
			height: photo.height,
			previewUrl: photo.urls.small,
			downloadUrl: photo.urls.full,
			color: photo.color,
		};
	}

	// ============================================================================
	// Download API
	// ============================================================================

	/**
	 * Get photo details by ID
	 */
	async getPhoto(photoId: string): Promise<UnsplashPhoto> {
		return this.request<UnsplashPhoto>(`/photos/${photoId}`);
	}

	/**
	 * Track download (required by Unsplash API guidelines)
	 * Must be called when downloading a photo
	 */
	async trackDownload(photoId: string): Promise<string> {
		const response = await this.request<UnsplashDownloadResponse>(
			`/photos/${photoId}/download`
		);
		return response.url;
	}

	/**
	 * Download a photo by ID
	 */
	async downloadPhoto(photoId: string): Promise<UnsplashDownloadResult> {
		// First, get photo details
		const photo = await this.getPhoto(photoId);

		// Track download (required by Unsplash API guidelines)
		await this.trackDownload(photoId);

		// Download the image from full URL
		const imageResponse = await fetch(photo.urls.full);

		if (!imageResponse.ok) {
			throw new Error(
				`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`
			);
		}

		const arrayBuffer = await imageResponse.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Unsplash serves JPEGs
		const ext = ".jpg";

		return {
			buffer,
			metadata: {
				filename: `unsplash-${photoId}${ext}`,
				photographer: photo.user.name,
				photographerUrl: photo.user.links.html,
				alt: photo.alt_description || photo.description || `Photo by ${photo.user.name}`,
				unsplashId: photoId,
				width: photo.width,
				height: photo.height,
			},
		};
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Check if API key is configured
	 */
	isConfigured(): boolean {
		return !!this.accessKey;
	}
}

// Singleton instance
let unsplashServiceInstance: UnsplashService | null = null;

export function getUnsplashService(): UnsplashService {
	if (!unsplashServiceInstance) {
		unsplashServiceInstance = new UnsplashService();
	}
	return unsplashServiceInstance;
}
