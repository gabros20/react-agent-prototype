import express from "express";
import { ApiResponse, HttpStatus } from "../types/api-response";

// ============================================================================
// Types
// ============================================================================

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    modality: string;
  };
  top_provider?: {
    is_moderated?: boolean;
  };
  supported_parameters?: string[];
}

interface TransformedModel {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  contextLengthFormatted: string;
  costInputPerMillion: string;
  costOutputPerMillion: string;
  provider: string;
  modality?: string;
  isModerated: boolean;
}

// ============================================================================
// Cache
// ============================================================================

let cachedModels: TransformedModel[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour server-side cache

// ============================================================================
// Helpers
// ============================================================================

function formatCostPerMillion(costPerToken: string): string {
  const cost = parseFloat(costPerToken);
  if (cost === 0) return "Free";
  const perMillion = cost * 1_000_000;
  if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/M`;
  return `$${perMillion.toFixed(2)}/M`;
}

function formatContextLength(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.floor(tokens / 1_000)}K`;
  }
  return `${tokens}`;
}

async function fetchModelsFromOpenRouter(): Promise<TransformedModel[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models");

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { data: OpenRouterModel[] };

  // Filter for models with tools support
  const toolModels = data.data.filter((model) =>
    model.supported_parameters?.includes("tools")
  );

  // Sort by context length (high to low)
  toolModels.sort((a, b) => b.context_length - a.context_length);

  // Transform to our format
  return toolModels.map((model) => ({
    id: model.id,
    name: model.name,
    description: model.description || "",
    contextLength: model.context_length,
    contextLengthFormatted: formatContextLength(model.context_length),
    costInputPerMillion: formatCostPerMillion(model.pricing.prompt),
    costOutputPerMillion: formatCostPerMillion(model.pricing.completion),
    provider: model.id.split("/")[0] || "unknown",
    modality: model.architecture?.modality,
    isModerated: model.top_provider?.is_moderated || false,
  }));
}

// ============================================================================
// Route Factory
// ============================================================================

export function createModelsRoutes() {
  const router = express.Router();

  // GET /v1/models - Get available models with tool support
  router.get("/", async (_req, res, next) => {
    try {
      const now = Date.now();

      // Check cache
      if (cachedModels && now - cacheTimestamp < CACHE_TTL_MS) {
        return res.json(
          ApiResponse.success({
            models: cachedModels,
            cached: true,
            count: cachedModels.length,
          })
        );
      }

      // Fetch fresh data
      const models = await fetchModelsFromOpenRouter();

      // Update cache
      cachedModels = models;
      cacheTimestamp = now;

      res.json(
        ApiResponse.success({
          models,
          cached: false,
          count: models.length,
        })
      );
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/models/:provider/:model - Get single model by ID (e.g., openai/gpt-4o)
  router.get("/:provider/:model", async (req, res, next) => {
    try {
      const modelId = `${req.params.provider}/${req.params.model}`;
      const now = Date.now();

      // Ensure cache is populated
      if (!cachedModels || now - cacheTimestamp >= CACHE_TTL_MS) {
        cachedModels = await fetchModelsFromOpenRouter();
        cacheTimestamp = now;
      }

      const model = cachedModels.find((m) => m.id === modelId);

      if (!model) {
        return res.status(HttpStatus.NOT_FOUND).json(
          ApiResponse.error("MODEL_NOT_FOUND", `Model '${modelId}' not found`)
        );
      }

      res.json(ApiResponse.success(model));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
