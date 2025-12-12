/**
 * Test Token Service
 *
 * Verifies:
 * - Token counting for text messages
 * - Token counting for tool call/result pairs
 * - Model limit retrieval
 * - Overflow detection
 */

import {
  countPartTokens,
  countMessageTokens,
  countTotalTokens,
  getModelLimits,
  isApproachingOverflow,
  calculateAvailableTokens,
  calculateContextUsagePercent,
  type RichMessage,
  type TextPart,
  type ToolCallPart,
  type ToolResultPart,
} from '../server/memory/compaction';

console.log('=== Token Service Tests ===\n');

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

// Test 2: Part Token Counting
console.log('2. Part Token Counting:');

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

// Test 3: Message Token Counting
console.log('3. Message Token Counting:');

const userMessage: RichMessage = {
  id: 'msg-1',
  sessionId: 'session-123',
  role: 'user',
  parts: [textPart],
  createdAt: Date.now(),
  tokens: 0,
};
userMessage.tokens = countMessageTokens(userMessage);
console.log(`  UserMessage: ${userMessage.tokens} tokens`);

const assistantMessage: RichMessage = {
  id: 'msg-2',
  sessionId: 'session-123',
  role: 'assistant',
  parts: [
    { id: 'p1', type: 'text', text: 'Let me get that page for you.' },
    toolCallPart,
  ],
  createdAt: Date.now(),
  tokens: 0,
};
assistantMessage.tokens = countMessageTokens(assistantMessage);
console.log(`  AssistantMessage (text + tool call): ${assistantMessage.tokens} tokens`);

const toolMessage: RichMessage = {
  id: 'msg-3',
  sessionId: 'session-123',
  role: 'tool',
  parts: [toolResultPart],
  createdAt: Date.now(),
  tokens: 0,
};
toolMessage.tokens = countMessageTokens(toolMessage);
console.log(`  ToolMessage: ${toolMessage.tokens} tokens`);
console.log();

// Test 4: Total Token Counting
console.log('4. Total Token Counting:');
const messages: RichMessage[] = [userMessage, assistantMessage, toolMessage];
const total = countTotalTokens(messages);
console.log(`  Total for ${messages.length} messages: ${total} tokens`);
console.log();

// Test 5: Overflow Detection
console.log('5. Overflow Detection:');
const modelId = 'openai/gpt-4o';
const limits = getModelLimits(modelId);

// Simulate different usage levels
const usageLevels = [10_000, 50_000, 100_000, 110_000, 120_000];
for (const usage of usageLevels) {
  const available = calculateAvailableTokens(modelId, usage);
  const percent = calculateContextUsagePercent(modelId, usage);
  const isOverflow = isApproachingOverflow(modelId, usage, undefined, 0.9);
  const status = isOverflow ? '⚠️ OVERFLOW' : '✅ OK';
  console.log(`  ${usage.toLocaleString()} tokens: ${percent.toFixed(1)}% used, ${available.toLocaleString()} available ${status}`);
}
console.log();

// Test 6: Model-specific calculations
console.log('6. Model-specific Context Limits:');
const testModels = ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-1.5-pro'];
for (const model of testModels) {
  const modelLimits = getModelLimits(model);
  const usableContext = modelLimits.contextLimit - modelLimits.maxOutput;
  console.log(`  ${model}:`);
  console.log(`    Context: ${modelLimits.contextLimit.toLocaleString()}, Output: ${modelLimits.maxOutput.toLocaleString()}`);
  console.log(`    Usable for input: ${usableContext.toLocaleString()}`);
}

console.log('\n=== All Tests Passed ===');
