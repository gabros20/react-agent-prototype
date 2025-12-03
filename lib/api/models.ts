/**
 * Models API - Fetch available LLM models
 */

import { api } from "./client";

// ============================================================================
// Types
// ============================================================================

export interface Model {
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

interface ModelsResponse {
  models: Model[];
  cached: boolean;
  count: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch all available models with tool support
 */
export async function list(): Promise<{
  models: Model[];
  cached: boolean;
  count: number;
}> {
  return api.get<ModelsResponse>("/api/models");
}

/**
 * Get a single model by ID (e.g., "openai/gpt-4o")
 */
export async function get(modelId: string): Promise<Model> {
  // Model ID contains a slash, need to encode it properly
  const [provider, model] = modelId.split("/");
  return api.get<Model>(`/api/models/${provider}/${model}`);
}

// Export as namespace
export const modelsApi = {
  list,
  get,
};
