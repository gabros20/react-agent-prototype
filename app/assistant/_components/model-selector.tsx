'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ModelSelector as ModelSelectorRoot,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
} from '@/components/ai-elements/model-selector';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, ChevronDown, HelpCircle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModelsStore, type Model } from '../_stores/models-store';
import { useSessionStore } from '../_stores/session-store';
import { useChatStore } from '../_stores/chat-store';

interface ModelSelectorProps {
  disabled?: boolean;
}

// Default model when none is selected
const DEFAULT_MODEL_ID = 'openai/gpt-4o-mini';

// Sort providers by popularity/importance
const PROVIDER_ORDER = [
  'openai',
  'anthropic',
  'google',
  'meta-llama',
  'mistralai',
  'deepseek',
  'x-ai',
  'cohere',
  'qwen',
];

// Map OpenRouter provider IDs to ModelSelectorLogo provider names
function mapProviderToLogo(provider: string): string {
  const mapping: Record<string, string> = {
    openai: 'openai',
    anthropic: 'anthropic',
    google: 'google',
    'meta-llama': 'llama',
    mistralai: 'mistral',
    deepseek: 'deepseek',
    'x-ai': 'xai',
    cohere: 'inference', // fallback
    qwen: 'alibaba',
    perplexity: 'perplexity',
    nvidia: 'nvidia',
    groq: 'groq',
  };
  return mapping[provider] || provider;
}

function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    'meta-llama': 'Meta',
    mistralai: 'Mistral',
    deepseek: 'DeepSeek',
    'x-ai': 'xAI',
    cohere: 'Cohere',
    qwen: 'Qwen',
    perplexity: 'Perplexity',
    nvidia: 'NVIDIA',
    groq: 'Groq',
  };
  return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

function getModelShortName(model: Model): string {
  const name = model.name;
  const providerPrefix = model.provider + '/';
  if (name.toLowerCase().startsWith(providerPrefix.toLowerCase())) {
    return name.slice(providerPrefix.length);
  }
  return name;
}

export function ModelSelector({ disabled = false }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const models = useModelsStore((state) => state.models);
  const isLoading = useModelsStore((state) => state.isLoading);
  const fetchModels = useModelsStore((state) => state.fetchModels);
  const { sessions, updateSessionModel } = useSessionStore();
  const chatSessionId = useChatStore((state) => state.sessionId);

  // Fetch models on mount
  useEffect(() => {
    if (models.length === 0) {
      fetchModels();
    }
  }, [models.length, fetchModels]);

  // Get current session from chatStore's sessionId
  const currentSession = sessions.find((s) => s.id === chatSessionId);
  const currentModelId = currentSession?.modelId || DEFAULT_MODEL_ID;

  // Group models by provider, sorted
  const groupedModels = useMemo(() => {
    const byProvider = models.reduce((acc, model) => {
      const provider = model.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(model);
      return acc;
    }, {} as Record<string, Model[]>);

    const sortedProviders = Object.keys(byProvider).sort((a, b) => {
      const aIndex = PROVIDER_ORDER.indexOf(a);
      const bIndex = PROVIDER_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return sortedProviders.map((provider) => ({
      provider,
      displayName: getProviderDisplayName(provider),
      logoProvider: mapProviderToLogo(provider),
      models: byProvider[provider],
    }));
  }, [models]);

  // Get current model for display
  const currentModel = models.find((m) => m.id === currentModelId);

  const handleModelSelect = async (modelId: string) => {
    if (!chatSessionId) return;
    try {
      await updateSessionModel(chatSessionId, modelId);
      setOpen(false);
    } catch (error) {
      console.error('Failed to update model:', error);
    }
  };

  if (isLoading && models.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">Loading models...</span>
    );
  }

  const displayName = currentModel
    ? getModelShortName(currentModel)
    : currentModelId.split('/')[1] || 'Select model';

  return (
    <ModelSelectorRoot open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1 max-w-[200px] font-normal"
          disabled={disabled || !chatSessionId}
        >
          {currentModel && (
            <ModelSelectorLogo
              provider={mapProviderToLogo(currentModel.provider) as any}
              className="size-4"
            />
          )}
          <span className="truncate text-xs text-muted-foreground">
            {displayName}
          </span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent className="w-[480px] max-w-[90vw]">
        <ModelSelectorInput placeholder="Search models..." className="text-base py-4" />
        <ModelSelectorList className="max-h-[400px]">
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {groupedModels.map((group) => (
            <ModelSelectorGroup key={group.provider} heading={group.displayName}>
              {group.models.slice(0, 10).map((model) => {
                const shortName = getModelShortName(model);
                const isSelected = model.id === currentModelId;
                // Include searchable text in value for cmdk filtering
                const searchValue = `${model.id} ${model.name} ${shortName} ${group.displayName}`.toLowerCase();
                return (
                  <ModelSelectorItem
                    key={model.id}
                    value={searchValue}
                    keywords={[model.id, model.name, shortName, group.displayName]}
                    onSelect={() => handleModelSelect(model.id)}
                    className={cn(
                      "flex items-center gap-3 py-2.5 px-3",
                      isSelected && "bg-accent"
                    )}
                  >
                    <ModelSelectorLogo
                      provider={group.logoProvider as any}
                      className="size-5 shrink-0"
                    />
                    <div className="flex flex-col flex-1 min-w-0 gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">
                          {shortName}
                        </span>
                        {model.description && (
                          <Tooltip>
                            <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => e.preventDefault()}
                              >
                                <HelpCircle className="size-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              className="max-w-[400px] text-sm leading-relaxed bg-white text-foreground border shadow-lg dark:bg-popover dark:text-popover-foreground"
                              arrowClassName="bg-white fill-white dark:bg-popover dark:fill-popover"
                              sideOffset={8}
                            >
                              {model.description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <Layers className="size-3 text-blue-600 dark:text-blue-400" />
                          {model.contextLengthFormatted}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ↓ {model.costInputPerMillion}
                        </span>
                        <span className="text-amber-600 dark:text-amber-400">
                          ↑ {model.costOutputPerMillion}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </ModelSelectorItem>
                );
              })}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelectorRoot>
  );
}
