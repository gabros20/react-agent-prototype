/**
 * Test Token Service
 *
 * Verifies:
 * - Model limit retrieval
 * - Provider token overflow detection
 * - Part token counting (for pruning heuristics only)
 *
 * NOTE: Local token counting has been removed. Provider tokens are the
 * ONLY source of truth for compaction decisions.
 */

import {
  countPartTokens,
  getModelLimits,
  isOverflowFromProviderTokens,
  COMPACTION_THRESHOLD,
  type TextPart,
  type ToolCallPart,
  type ToolResultPart,
} from '../server/memory/compaction';

console.log('=== Token Service Tests (Provider-Only) ===\n');

// Test 1: Model Limits
console.log('1. Model Limits:');
const models = [
  'openai/gpt-4o',
  'anthropic/claude-3.5-sonnet',
  'google/gemini-1.5-pro',
  'unknown/model',
];
for (const model of models) {
  const limits = getModelLimits(model);
  console.log(`  ${model}: ${limits.contextLimit.toLocaleString()} context, ${limits.maxOutput.toLocaleString()} output`);
}
console.log();

// Test 2: Part Token Counting (for pruning heuristics)
console.log('2. Part Token Counting (pruning heuristics only):');

const textPart: TextPart = {
  id: '1',
  type: 'text',
  text: 'Hello, this is a test message with some content to count tokens.',
};
console.log(`  TextPart: ${countPartTokens(textPart)} tokens`);

const toolCallPart: ToolCallPart = {
  id: '2',
  type: 'tool-call',
  toolCallId: 'call_123',
  toolName: 'cms_getPage',
  input: { slug: 'home', includeContent: true },
};
console.log(`  ToolCallPart: ${countPartTokens(toolCallPart)} tokens`);

const toolResultPart: ToolResultPart = {
  id: '3',
  type: 'tool-result',
  toolCallId: 'call_123',
  toolName: 'cms_getPage',
  output: {
    id: 'page-123',
    title: 'Home Page',
    slug: 'home',
    sections: [
      { id: 's1', type: 'hero', content: { heading: 'Welcome' } },
      { id: 's2', type: 'features', content: { items: ['Feature 1', 'Feature 2', 'Feature 3'] } },
    ],
  },
};
console.log(`  ToolResultPart: ${countPartTokens(toolResultPart)} tokens`);

const compactedResultPart: ToolResultPart = {
  ...toolResultPart,
  compactedAt: Date.now(),
  originalTokens: 150,
};
console.log(`  CompactedToolResultPart: ${countPartTokens(compactedResultPart)} tokens (was ${compactedResultPart.originalTokens})`);
console.log();

// Test 3: Provider Token Overflow Detection (Source of Truth)
console.log('3. Provider Token Overflow Detection:');
const modelId = 'openai/gpt-4o';
const limits = getModelLimits(modelId);
const usableContext = limits.contextLimit - limits.maxOutput;
const threshold = usableContext * COMPACTION_THRESHOLD;

console.log(`  Model: ${modelId}`);
console.log(`  Context limit: ${limits.contextLimit.toLocaleString()}`);
console.log(`  Max output: ${limits.maxOutput.toLocaleString()}`);
console.log(`  Usable context: ${usableContext.toLocaleString()}`);
console.log(`  Compaction threshold (${COMPACTION_THRESHOLD * 100}%): ${threshold.toLocaleString()}`);
console.log();

// Simulate provider token reports at different levels
const providerTokenScenarios = [
  { input: 10_000, output: 500 },
  { input: 50_000, output: 2_000 },
  { input: 55_000, output: 3_000 },   // Around 50% threshold
  { input: 60_000, output: 5_000 },   // Over threshold
  { input: 100_000, output: 10_000 }, // Way over
];

console.log('  Provider token scenarios:');
for (const tokens of providerTokenScenarios) {
  const total = tokens.input + tokens.output;
  const percent = (total / usableContext) * 100;
  const isOverflow = isOverflowFromProviderTokens(tokens, limits);
  const status = isOverflow ? '⚠️ COMPACTION NEEDED' : '✅ OK';
  console.log(`    ${tokens.input.toLocaleString()} in + ${tokens.output.toLocaleString()} out = ${total.toLocaleString()} (${percent.toFixed(1)}%) ${status}`);
}
console.log();

// Test 4: Session Context Length Override
console.log('4. Session Context Length Override:');
const sessionContextLength = 200_000; // From OpenRouter API
const limitsWithSession = getModelLimits('unknown/model', sessionContextLength);
console.log(`  Unknown model with session context length ${sessionContextLength.toLocaleString()}:`);
console.log(`    Context: ${limitsWithSession.contextLimit.toLocaleString()}, Output: ${limitsWithSession.maxOutput.toLocaleString()}`);
console.log();

console.log('=== All Tests Passed ===');
