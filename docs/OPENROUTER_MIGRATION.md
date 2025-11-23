# OpenRouter Migration - Image Metadata Generation

## Summary

The image handling system now uses **OpenRouter** instead of requiring a separate OpenAI API key.

## Changes Made

### 1. Code Changes

**File**: `server/services/ai/metadata-generation.service.ts`

**Before:**
```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [/* ... */],
  response_format: { type: "json_object" },
  max_tokens: 500,
});
```

**After:**
```typescript
import OpenAI from "openai";

// Use OpenAI SDK with OpenRouter's API endpoint
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.BASE_URL || "http://localhost:3000",
    "X-Title": "ReAct CMS Agent - Image Metadata",
  },
});

const response = await openai.chat.completions.create({
  model: "openai/gpt-4o-mini",  // OpenRouter model format
  messages: [/* ... */],
  response_format: { type: "json_object" },
  max_tokens: 500,
});
```

**Key Differences:**
- Same OpenAI SDK, different base URL
- Uses `OPENROUTER_API_KEY` instead of `OPENAI_API_KEY`
- Model name includes provider prefix: `openai/gpt-4o-mini`
- Added OpenRouter-required headers (HTTP-Referer, X-Title)
- All other API parameters remain unchanged (full compatibility)

### 2. Documentation Updates

Updated all references from `OPENAI_API_KEY` to `OPENROUTER_API_KEY` in:

- ✅ `docs/IMAGE_SETUP_CHECKLIST.md`
- ✅ `docs/IMAGE_HANDLING_README.md`
- ✅ `docs/IMAGE_SYSTEM_COMPLETE.md`
- ✅ `scripts/test-image-upload.sh`

## Environment Variables

**Required:**
```env
OPENROUTER_API_KEY=sk-or-v1-...
```

**No longer needed:**
```env
OPENAI_API_KEY=sk-...  # ❌ Not required
```

## Benefits

1. **Single API Key**: Use your existing OpenRouter key for all AI operations
2. **Unified Billing**: All AI costs (agent, embeddings, image metadata) through one provider
3. **Consistent Architecture**: Matches the pattern used in `server/agent/orchestrator.ts`
4. **OpenRouter Features**: Access to fallback models, rate limit handling, and unified API

## Model Used

- **Model**: `openai/gpt-4o-mini` via OpenRouter
- **Cost**: Same as direct OpenAI (OpenRouter passes through OpenAI pricing)
- **Vision Mode**: Uses base64-encoded images
- **Token Usage**: ~85 tokens per image (with low detail mode optimization)

## Testing

After migration, test the complete flow:

```bash
# 1. Verify OpenRouter key is set
grep OPENROUTER_API_KEY .env

# 2. Start the worker
pnpm worker:dev

# 3. Upload test image
curl -X POST http://localhost:8787/api/upload \
  -F "files=@test.jpg" \
  -F "sessionId=test-123"

# 4. Check processing logs
# Worker should show: "✅ Job ... (generate-metadata) completed successfully"
```

## Compatibility

- ✅ AI SDK 6 compatible
- ✅ Works with existing OpenRouter setup
- ✅ No changes to database schema
- ✅ No changes to API endpoints
- ✅ Maintains retry logic and error handling

## Migration Date

**Date**: 2025-11-22
**Status**: ✅ Complete
**Breaking Changes**: None (environment variable change only)

---

**Note**: If you encounter any issues with vision model support, OpenRouter also supports other vision models like `anthropic/claude-3-haiku` or `google/gemini-pro-vision` as alternatives.
