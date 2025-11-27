/**
 * Pexels Stock Photo Service
 *
 * Handles Pexels API interactions:
 * - Search photos by keyword
 * - Download photos for processing
 */

import type {
	PexelsSearchResponse,
	PexelsPhoto,
	PexelsPhotoResult,
	PexelsSearchResult,
	PexelsDownloadResult,
	PexelsOrientation,
	PexelsColor,
} from "../../types/pexels";

const PEXELS_BASE_URL = "https://api.pexels.com/v1";

interface PexelsServiceConfig {
	apiKey: string;
}

export class PexelsService {
	private apiKey: string;

	constructor(config?: Partial<PexelsServiceConfig>) {
		this.apiKey = config?.apiKey || process.env.PEXELS_API_KEY || "";

		if (!this.apiKey) {
			console.warn(
				"[PexelsService] No API key configured. Set PEXELS_API_KEY environment variable."
			);
		}
	}

	/**
	 * Make authenticated request to Pexels API
	 */
	private async request<T>(endpoint: string): Promise<T> {
		const url = `${PEXELS_BASE_URL}${endpoint}`;

		const response = await fetch(url, {
			headers: {
				Authorization: this.apiKey,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Pexels API error (${response.status}): ${errorText}`);
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
		orientation?: PexelsOrientation;
		color?: PexelsColor;
	}): Promise<PexelsSearchResult> {
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

		const response = await this.request<PexelsSearchResponse>(
			`/search?${queryParams.toString()}`
		);

		return {
			photos: response.photos.map(this.transformPhoto),
			totalResults: response.total_results,
			page: response.page,
		};
	}

	/**
	 * Transform Pexels API photo to internal format
	 */
	private transformPhoto(photo: PexelsPhoto): PexelsPhotoResult {
		return {
			id: photo.id,
			photographer: photo.photographer,
			photographerUrl: photo.photographer_url,
			alt: photo.alt || `Photo by ${photo.photographer}`,
			width: photo.width,
			height: photo.height,
			previewUrl: photo.src.medium,
			downloadUrl: photo.src.original,
			avgColor: photo.avg_color,
		};
	}

	// ============================================================================
	// Download API
	// ============================================================================

	/**
	 * Download a photo by ID
	 */
	async downloadPhoto(photoId: number): Promise<PexelsDownloadResult> {
		// First, get photo details
		const photo = await this.request<PexelsPhoto>(`/photos/${photoId}`);

		// Download the image
		const imageResponse = await fetch(photo.src.original);

		if (!imageResponse.ok) {
			throw new Error(
				`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`
			);
		}

		const arrayBuffer = await imageResponse.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Determine file extension from URL
		const urlPath = new URL(photo.src.original).pathname;
		const ext = urlPath.match(/\.(jpe?g|png|webp)$/i)?.[0] || ".jpg";

		return {
			buffer,
			metadata: {
				filename: `pexels-${photoId}${ext}`,
				photographer: photo.photographer,
				photographerUrl: photo.photographer_url,
				alt: photo.alt || `Photo by ${photo.photographer}`,
				pexelsId: photoId,
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
		return !!this.apiKey;
	}
}

// Singleton instance
let pexelsServiceInstance: PexelsService | null = null;

export function getPexelsService(): PexelsService {
	if (!pexelsServiceInstance) {
		pexelsServiceInstance = new PexelsService();
	}
	return pexelsServiceInstance;
}
