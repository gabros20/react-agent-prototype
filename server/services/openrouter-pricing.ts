/**
 * OpenRouter Pricing Service
 *
 * Fetches and caches model prices from OpenRouter API.
 * Prices are per million tokens (prompt/completion).
 */

interface ModelPricing {
	prompt: number; // $ per million tokens
	completion: number; // $ per million tokens
}

interface OpenRouterModel {
	id: string;
	pricing: {
		prompt: string; // String representation of $ per token
		completion: string;
	};
}

// Cache for model prices
let priceCache: Map<string, ModelPricing> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch model prices from OpenRouter API
 */
export async function fetchModelPrices(): Promise<Map<string, ModelPricing>> {
	const now = Date.now();

	// Return cached prices if still valid
	if (priceCache && now - lastFetchTime < CACHE_TTL_MS) {
		return priceCache;
	}

	try {
		const response = await fetch("https://openrouter.ai/api/v1/models", {
			headers: {
				Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
			},
		});

		if (!response.ok) {
			console.error("Failed to fetch OpenRouter models:", response.statusText);
			return priceCache || new Map();
		}

		const data = (await response.json()) as { data: OpenRouterModel[] };
		const prices = new Map<string, ModelPricing>();

		for (const model of data.data) {
			if (model.pricing) {
				// OpenRouter returns prices as strings representing $ per token
				// Convert to $ per million tokens for easier calculation
				const promptPrice = Number.parseFloat(model.pricing.prompt) * 1_000_000;
				const completionPrice = Number.parseFloat(model.pricing.completion) * 1_000_000;

				prices.set(model.id, {
					prompt: promptPrice,
					completion: completionPrice,
				});
			}
		}

		priceCache = prices;
		lastFetchTime = now;

		console.log(`[pricing] Cached ${prices.size} model prices from OpenRouter`);
		return prices;
	} catch (error) {
		console.error("Error fetching OpenRouter prices:", error);
		return priceCache || new Map();
	}
}

/**
 * Get pricing for a specific model
 */
export async function getModelPricing(modelId: string): Promise<ModelPricing | null> {
	const prices = await fetchModelPrices();
	return prices.get(modelId) || null;
}

/**
 * Calculate cost for a given usage
 */
export function calculateCost(
	usage: { promptTokens?: number; completionTokens?: number },
	pricing: ModelPricing
): number {
	const promptTokens = usage.promptTokens || 0;
	const completionTokens = usage.completionTokens || 0;

	// Convert tokens to millions and multiply by price per million
	const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
	const completionCost = (completionTokens / 1_000_000) * pricing.completion;

	return promptCost + completionCost;
}

/**
 * Get pricing info formatted for SSE event
 */
export async function getPricingInfo(modelId: string): Promise<{
	modelId: string;
	pricing: ModelPricing | null;
}> {
	const pricing = await getModelPricing(modelId);
	return { modelId, pricing };
}

