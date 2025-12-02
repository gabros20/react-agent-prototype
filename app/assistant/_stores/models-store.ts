'use client';

import { create } from 'zustand';

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

interface ModelsState {
  models: Model[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchModels: () => Promise<void>;
  getModelById: (modelId: string) => Model | undefined;
  getModelsByProvider: () => Record<string, Model[]>;
}

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'openrouter-models-cache';

interface CacheData {
  models: Model[];
  timestamp: number;
}

function loadFromCache(): CacheData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CacheData = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - data.timestamp < CACHE_TTL_MS) {
      return data;
    }

    // Cache expired
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function saveToCache(models: Model[]): void {
  if (typeof window === 'undefined') return;

  try {
    const data: CacheData = {
      models,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  // Fetch models from API (with localStorage caching)
  fetchModels: async () => {
    // Check cache first
    const cached = loadFromCache();
    if (cached) {
      set({
        models: cached.models,
        lastFetched: cached.timestamp,
        isLoading: false,
        error: null,
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/models');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch models');
      }

      const models: Model[] = result.data.models;

      // Save to cache
      saveToCache(models);

      set({
        models,
        lastFetched: Date.now(),
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Failed to fetch models:', error);
    }
  },

  // Get model by ID
  getModelById: (modelId: string) => {
    return get().models.find((m) => m.id === modelId);
  },

  // Group models by provider
  getModelsByProvider: () => {
    const models = get().models;
    return models.reduce((acc, model) => {
      const provider = model.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(model);
      return acc;
    }, {} as Record<string, Model[]>);
  },
}));
