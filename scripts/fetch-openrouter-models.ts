/**
 * Fetches OpenRouter models with tool support and saves to JSON
 * API: https://openrouter.ai/api/v1/models
 */

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  supported_parameters?: string[];
}

interface TransformedModel {
  modelId: string;
  name: string;
  description: string;
  contextLength: number;
  costInputTokens: string;
  costOutputTokens: string;
  tags: string[];
  modality?: string;
  provider: string;
}

async function fetchOpenRouterModels(): Promise<void> {
  console.log("Fetching models from OpenRouter API...");

  const response = await fetch("https://openrouter.ai/api/v1/models");

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { data: OpenRouterModel[] };
  console.log(`Fetched ${data.data.length} total models`);

  // Filter for models with tools support
  const toolModels = data.data.filter((model) =>
    model.supported_parameters?.includes("tools")
  );

  console.log(`Found ${toolModels.length} models with tools support`);

  // Sort by context length (high to low)
  toolModels.sort((a, b) => b.context_length - a.context_length);

  // Transform to our desired format
  const transformed: TransformedModel[] = toolModels.map((model) => {
    // Extract provider from model ID (e.g., "google/gemini-2.5-pro" -> "google")
    const provider = model.id.split("/")[0] || "unknown";

    // Build tags from available metadata
    const tags: string[] = [];
    if (model.architecture?.modality) {
      tags.push(model.architecture.modality);
    }
    if (model.top_provider?.is_moderated) {
      tags.push("moderated");
    }

    return {
      modelId: model.id,
      name: model.name,
      description: model.description || "",
      contextLength: model.context_length,
      costInputTokens: model.pricing.prompt,
      costOutputTokens: model.pricing.completion,
      tags,
      modality: model.architecture?.modality,
      provider,
    };
  });

  // Format pricing for readability
  const formatted = transformed.map((m) => ({
    ...m,
    costInputTokensPerMillion: formatCostPerMillion(m.costInputTokens),
    costOutputTokensPerMillion: formatCostPerMillion(m.costOutputTokens),
    contextLengthFormatted: formatContextLength(m.contextLength),
  }));

  // Save full results
  const outputPath = new URL("../data/openrouter-models.json", import.meta.url);
  await Bun.write(outputPath.pathname, JSON.stringify(formatted, null, 2));
  console.log(`\nSaved ${formatted.length} models to data/openrouter-models.json`);

  // Print summary
  console.log("\n=== Top 10 Models by Context Length ===\n");
  formatted.slice(0, 10).forEach((m, i) => {
    console.log(
      `${i + 1}. ${m.name} (${m.modelId})\n` +
        `   Context: ${m.contextLengthFormatted} | ` +
        `Input: ${m.costInputTokensPerMillion} | ` +
        `Output: ${m.costOutputTokensPerMillion}`
    );
  });
}

function formatCostPerMillion(costPerToken: string): string {
  const cost = parseFloat(costPerToken);
  if (cost === 0) return "Free";
  const perMillion = cost * 1_000_000;
  return `$${perMillion.toFixed(2)}/M`;
}

function formatContextLength(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return `${tokens}`;
}

// Run
fetchOpenRouterModels().catch(console.error);

