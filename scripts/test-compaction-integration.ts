/**
 * Compaction System Integration Test
 *
 * Tests the full flow with provider-only tokens:
 * 1. Create mock messages
 * 2. Simulate provider tokens (source of truth)
 * 3. Run through prepareContextForLLM
 * 4. Verify pruning and compaction behavior
 *
 * NOTE: Local token counting has been removed. Provider tokens are the
 * ONLY source of truth for compaction decisions.
 */

import {
  prepareContextForLLM,
  getModelLimits,
  isOverflowFromProviderTokens,
  COMPACTION_THRESHOLD,
  modelMessagesToRich,
  type CompactionConfig,
} from '../server/memory/compaction';
import type { ModelMessage } from 'ai';

console.log('=== Compaction System Integration Test (Provider-Only) ===\n');

// Helper to create mock messages
function createMockConversation(turnCount: number, largeToolResults = false): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (let i = 0; i < turnCount; i++) {
    // User message
    messages.push({
      role: 'user',
      content: `User message ${i + 1}: This is a test query about the CMS.`,
    });

    // Assistant message with tool call
    messages.push({
      role: 'assistant',
      content: [
        { type: 'text', text: `Let me help with that request ${i + 1}.` },
        {
          type: 'tool-call',
          toolCallId: `call-${i}`,
          toolName: 'cms_getPage',
          args: { slug: `page-${i}` },
        },
      ],
    });

    // Tool result
    const toolOutput = largeToolResults
      ? {
          success: true,
          page: {
            id: `page-${i}`,
            title: `Test Page ${i}`,
            sections: Array(20).fill(null).map((_, si) => ({
              id: `section-${i}-${si}`,
              type: 'content',
              content: `This is the content for section ${si}. `.repeat(50),
            })),
          },
        }
      : { success: true, page: { id: `page-${i}`, title: `Test Page ${i}` } };

    messages.push({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: `call-${i}`,
          toolName: 'cms_getPage',
          output: toolOutput,
        },
      ],
    });

    // Final assistant response
    messages.push({
      role: 'assistant',
      content: `Here's the information about page ${i + 1}.`,
    });
  }

  return messages;
}

// Test 1: Check model limits
console.log('1. Model Limits Check:');
const modelId = 'openai/gpt-4o';
const limits = getModelLimits(modelId);
const usableContext = limits.contextLimit - limits.maxOutput;
const compactionThreshold = usableContext * COMPACTION_THRESHOLD;

console.log(`  Model: ${modelId}`);
console.log(`  Context limit: ${limits.contextLimit.toLocaleString()}`);
console.log(`  Max output: ${limits.maxOutput.toLocaleString()}`);
console.log(`  Usable input: ${usableContext.toLocaleString()}`);
console.log(`  Compaction triggers at: ${compactionThreshold.toLocaleString()} (${COMPACTION_THRESHOLD * 100}%)`);
console.log();

// Test 2: Provider token overflow detection
console.log('2. Provider Token Overflow Detection:');
const providerScenarios = [
  { input: 10_000, output: 500, desc: 'Low usage' },
  { input: 50_000, output: 5_000, desc: 'Near threshold' },
  { input: 60_000, output: 5_000, desc: 'Over threshold' },
  { input: 100_000, output: 10_000, desc: 'High usage' },
];

for (const scenario of providerScenarios) {
  const isOverflow = isOverflowFromProviderTokens(scenario, limits);
  const total = scenario.input + scenario.output;
  const percent = (total / usableContext) * 100;
  console.log(`  ${scenario.desc}: ${total.toLocaleString()} tokens (${percent.toFixed(1)}%) - ${isOverflow ? '⚠️ COMPACT' : '✅ OK'}`);
}
console.log();

// Test 3: Prepare context with low provider tokens (no compaction)
console.log('3. Low Provider Tokens (No Compaction):');
const smallMessages = createMockConversation(3, false);
const lowProviderTokens = { input: 10_000, output: 500 };

console.log(`  Provider tokens: ${lowProviderTokens.input.toLocaleString()} in + ${lowProviderTokens.output.toLocaleString()} out`);
console.log(`  Messages: ${smallMessages.length}`);

const lowResult = await prepareContextForLLM(smallMessages, {
  sessionId: 'test-session',
  modelId,
  providerTokens: lowProviderTokens,
  onProgress: (status) => console.log(`    Progress: ${status}`),
});

console.log(`  Was pruned: ${lowResult.result.wasPruned}`);
console.log(`  Was compacted: ${lowResult.result.wasCompacted}`);
console.log(`  Messages after: ${lowResult.messages.length}`);
console.log();

// Test 4: Prepare context with high provider tokens (triggers compaction)
console.log('4. High Provider Tokens (Triggers Compaction):');
const largeMessages = createMockConversation(10, true);
const highProviderTokens = { input: 80_000, output: 5_000 }; // Over 50% threshold

console.log(`  Provider tokens: ${highProviderTokens.input.toLocaleString()} in + ${highProviderTokens.output.toLocaleString()} out`);
console.log(`  Messages: ${largeMessages.length}`);

// Use test config with low thresholds
const testConfig: Partial<CompactionConfig> = {
  pruneMinimum: 100,
  pruneProtect: 500,
  minTurnsToKeep: 2,
};

const highResult = await prepareContextForLLM(largeMessages, {
  sessionId: 'test-session-2',
  modelId,
  providerTokens: highProviderTokens,
  config: testConfig,
  onProgress: (status) => console.log(`    Progress: ${status}`),
});

console.log(`  Was pruned: ${highResult.result.wasPruned}`);
console.log(`  Was compacted: ${highResult.result.wasCompacted}`);
console.log(`  Messages after: ${highResult.messages.length}`);
console.log(`  Pruned outputs: ${highResult.result.debug.prunedOutputs}`);
console.log(`  Compacted messages: ${highResult.result.debug.compactedMessages}`);
console.log(`  Removed tools: ${highResult.result.debug.removedTools.join(', ') || 'none'}`);
console.log();

// Test 5: Force compaction even with low tokens
console.log('5. Force Compaction:');
const forceResult = await prepareContextForLLM(smallMessages, {
  sessionId: 'test-session-3',
  modelId,
  providerTokens: lowProviderTokens,
  force: true, // Force compaction even though under threshold
  onProgress: (status) => console.log(`    Progress: ${status}`),
});

console.log(`  Was compacted (forced): ${forceResult.result.wasCompacted}`);
console.log(`  Messages after: ${forceResult.messages.length}`);

console.log('\n=== Integration Test Complete ===');
