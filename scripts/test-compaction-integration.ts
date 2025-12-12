/**
 * Compaction System Integration Test
 *
 * Tests the full flow:
 * 1. Create mock messages
 * 2. Run through prepareContextForLLM
 * 3. Verify pruning and compaction behavior
 */

import {
  prepareContextForLLM,
  checkOverflow,
  getModelLimits,
  modelMessagesToRich,
  countTotalTokens,
  type CompactionConfig,
} from '../server/memory/compaction';
import type { ModelMessage } from 'ai';

console.log('=== Compaction System Integration Test ===\n');

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
console.log(`  Model: ${modelId}`);
console.log(`  Context limit: ${limits.contextLimit.toLocaleString()}`);
console.log(`  Max output: ${limits.maxOutput.toLocaleString()}`);
console.log(`  Usable input: ${(limits.contextLimit - limits.maxOutput).toLocaleString()}`);
console.log();

// Test 2: Small conversation (no action needed)
console.log('2. Small Conversation (No Compaction):');
const smallMessages = createMockConversation(3, false);
const smallRich = modelMessagesToRich(smallMessages, 'test-session');
const smallTokens = countTotalTokens(smallRich);
const smallOverflow = checkOverflow(smallRich, modelId);

console.log(`  Messages: ${smallMessages.length}`);
console.log(`  Tokens: ${smallTokens.toLocaleString()}`);
console.log(`  Overflow: ${smallOverflow.isOverflow ? '⚠️ YES' : '✅ NO'}`);
console.log();

// Test 3: Large conversation (should trigger pruning)
console.log('3. Large Conversation with Big Tool Results:');
const largeMessages = createMockConversation(10, true);
const largeRich = modelMessagesToRich(largeMessages, 'test-session');
const largeTokens = countTotalTokens(largeRich);
const largeOverflow = checkOverflow(largeRich, modelId);

console.log(`  Messages: ${largeMessages.length}`);
console.log(`  Tokens: ${largeTokens.toLocaleString()}`);
console.log(`  Overflow (90% threshold): ${largeOverflow.isOverflow ? '⚠️ YES' : '✅ NO'}`);
console.log(`  Available: ${largeOverflow.availableTokens.toLocaleString()}`);
console.log();

// Test 4: Run prepareContextForLLM on small conversation
console.log('4. Prepare Context (Small - No Action):');
const smallResult = await prepareContextForLLM(smallMessages, {
  sessionId: 'test-session',
  modelId,
  onProgress: (status) => console.log(`    Progress: ${status}`),
});

console.log(`  Messages after: ${smallResult.messages.length}`);
console.log(`  Was pruned: ${smallResult.result.wasPruned}`);
console.log(`  Was compacted: ${smallResult.result.wasCompacted}`);
console.log(`  Tokens: ${smallResult.result.tokens.before} → ${smallResult.result.tokens.final}`);
console.log();

// Test 5: Test with a small model to force overflow
console.log('5. Prepare Context with Small Model (Forces Overflow):');

// Use a model with smaller context to force overflow
const smallModelId = 'openai/gpt-4'; // Only 8192 context limit
const smallModelLimits = getModelLimits(smallModelId);
console.log(`  Using model: ${smallModelId} (limit: ${smallModelLimits.contextLimit.toLocaleString()})`);

// Use a very low threshold to force pruning
const testConfig: Partial<CompactionConfig> = {
  pruneMinimum: 100,
  pruneProtect: 500, // Only protect last 500 tokens of tool outputs
  minTurnsToKeep: 2,
  outputReserve: smallModelLimits.maxOutput,
};

// Convert large messages with small model to force overflow
const lowThresholdResult = await prepareContextForLLM(largeMessages, {
  sessionId: 'test-session-2',
  modelId: smallModelId,
  config: testConfig,
  onProgress: (status) => console.log(`    Progress: ${status}`),
});

console.log(`  Messages before: ${largeMessages.length}`);
console.log(`  Messages after: ${lowThresholdResult.messages.length}`);
console.log(`  Was pruned: ${lowThresholdResult.result.wasPruned}`);
console.log(`  Was compacted: ${lowThresholdResult.result.wasCompacted}`);
console.log(`  Tokens: ${lowThresholdResult.result.tokens.before.toLocaleString()} → ${lowThresholdResult.result.tokens.final.toLocaleString()}`);
console.log(`  Tokens saved: ${(lowThresholdResult.result.tokens.before - lowThresholdResult.result.tokens.final).toLocaleString()}`);
console.log(`  Pruned outputs: ${lowThresholdResult.result.debug.prunedOutputs}`);
console.log(`  Compacted messages: ${lowThresholdResult.result.debug.compactedMessages}`);
console.log(`  Removed tools: ${lowThresholdResult.result.debug.removedTools.join(', ') || 'none'}`);

console.log('\n=== Integration Test Complete ===');
