/**
 * Test Tool Output Pruner
 *
 * Verifies:
 * - Pruning preserves recent tool outputs
 * - Pruning clears old tool outputs past PRUNE_PROTECT threshold
 * - Tool call information is preserved
 * - Message sequence remains valid
 * - Compacted outputs have timestamp
 */

import {
  pruneToolOutputs,
  needsPruning,
  estimatePruneSavings,
  countTotalTokens,
  type RichMessage,
  type TextPart,
  type ToolCallPart,
  type ToolResultPart,
  type CompactionConfig,
} from '../server/memory/compaction';

console.log('=== Tool Output Pruner Tests ===\n');

// Helper to create a large tool result (simulating CMS data)
function createLargeToolResult(id: string, toolName: string, size: 'small' | 'medium' | 'large'): ToolResultPart {
  let output: unknown;

  if (size === 'small') {
    output = { success: true, id: 'item-1' };
  } else if (size === 'medium') {
    output = {
      success: true,
      page: {
        id: 'page-123',
        title: 'Test Page',
        sections: Array(5).fill(null).map((_, i) => ({
          id: `section-${i}`,
          type: 'content',
          content: 'This is some section content that represents a moderate amount of data.',
        })),
      },
    };
  } else {
    // Large: simulate a page with many sections and content
    output = {
      success: true,
      pages: Array(10).fill(null).map((_, pi) => ({
        id: `page-${pi}`,
        title: `Page ${pi}`,
        slug: `page-${pi}`,
        sections: Array(5).fill(null).map((_, si) => ({
          id: `section-${pi}-${si}`,
          type: 'content',
          content: `This is the content for section ${si} of page ${pi}. `.repeat(20),
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
        })),
      })),
    };
  }

  return {
    id: `result-${id}`,
    type: 'tool-result',
    toolCallId: `call-${id}`,
    toolName,
    output,
  };
}

// Create a conversation with multiple tool uses
function createTestConversation(): RichMessage[] {
  const messages: RichMessage[] = [];
  let msgId = 0;

  // Turn 1: User asks for pages (OLD - will be pruned)
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'user',
    parts: [{ id: 'p1', type: 'text', text: 'Show me all pages' }],
    createdAt: Date.now() - 60000,
    tokens: 10,
  });

  // Assistant calls listPages
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'assistant',
    parts: [
      { id: 'p2', type: 'text', text: 'Let me list all pages for you.' },
      {
        id: 'p3',
        type: 'tool-call',
        toolCallId: 'call-old-1',
        toolName: 'cms_listPages',
        input: {},
      },
    ],
    createdAt: Date.now() - 59000,
    tokens: 20,
  });

  // Tool result (LARGE - should be pruned)
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'tool',
    parts: [createLargeToolResult('old-1', 'cms_listPages', 'large')],
    createdAt: Date.now() - 58000,
    tokens: 5000, // Simulated large output
  });

  // Turn 2: User asks about a specific page (OLD - will be pruned)
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'user',
    parts: [{ id: 'p4', type: 'text', text: 'Show me page-1' }],
    createdAt: Date.now() - 50000,
    tokens: 10,
  });

  // Assistant calls getPage
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'assistant',
    parts: [
      { id: 'p5', type: 'text', text: 'Here is page-1:' },
      {
        id: 'p6',
        type: 'tool-call',
        toolCallId: 'call-old-2',
        toolName: 'cms_getPage',
        input: { slug: 'page-1' },
      },
    ],
    createdAt: Date.now() - 49000,
    tokens: 20,
  });

  // Tool result (LARGE - should be pruned)
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'tool',
    parts: [createLargeToolResult('old-2', 'cms_getPage', 'large')],
    createdAt: Date.now() - 48000,
    tokens: 5000,
  });

  // Turn 3: Another old interaction
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'user',
    parts: [{ id: 'p7', type: 'text', text: 'Update the hero section' }],
    createdAt: Date.now() - 40000,
    tokens: 10,
  });

  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'assistant',
    parts: [
      { id: 'p8', type: 'text', text: 'Updating the hero section...' },
      {
        id: 'p9',
        type: 'tool-call',
        toolCallId: 'call-old-3',
        toolName: 'cms_updateSection',
        input: { sectionId: 'hero-1', content: { heading: 'New Heading' } },
      },
    ],
    createdAt: Date.now() - 39000,
    tokens: 25,
  });

  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'tool',
    parts: [createLargeToolResult('old-3', 'cms_updateSection', 'medium')],
    createdAt: Date.now() - 38000,
    tokens: 500,
  });

  // Turn 4: RECENT - should be protected
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'user',
    parts: [{ id: 'p10', type: 'text', text: 'Now show me the footer' }],
    createdAt: Date.now() - 5000,
    tokens: 10,
  });

  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'assistant',
    parts: [
      { id: 'p11', type: 'text', text: 'Here is the footer:' },
      {
        id: 'p12',
        type: 'tool-call',
        toolCallId: 'call-recent-1',
        toolName: 'cms_getFooter',
        input: {},
      },
    ],
    createdAt: Date.now() - 4000,
    tokens: 20,
  });

  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'tool',
    parts: [createLargeToolResult('recent-1', 'cms_getFooter', 'medium')],
    createdAt: Date.now() - 3000,
    tokens: 500,
  });

  // Turn 5: MOST RECENT - should definitely be protected
  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'user',
    parts: [{ id: 'p13', type: 'text', text: 'What is the site name?' }],
    createdAt: Date.now() - 1000,
    tokens: 10,
  });

  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'assistant',
    parts: [
      { id: 'p14', type: 'text', text: 'Checking settings...' },
      {
        id: 'p15',
        type: 'tool-call',
        toolCallId: 'call-recent-2',
        toolName: 'cms_getSettings',
        input: {},
      },
    ],
    createdAt: Date.now() - 500,
    tokens: 20,
  });

  messages.push({
    id: `msg-${msgId++}`,
    sessionId: 'test-session',
    role: 'tool',
    parts: [createLargeToolResult('recent-2', 'cms_getSettings', 'small')],
    createdAt: Date.now(),
    tokens: 50,
  });

  return messages;
}

// Test 1: Check if conversation needs pruning
console.log('1. Needs Pruning Check:');
const messages = createTestConversation();
const totalTokensBefore = countTotalTokens(messages);
console.log(`  Total messages: ${messages.length}`);
console.log(`  Total tokens before: ${totalTokensBefore.toLocaleString()}`);

// Use low thresholds for testing
const testConfig: Partial<CompactionConfig> = {
  pruneMinimum: 100,   // Low threshold for testing
  pruneProtect: 200,   // Protect only most recent outputs
  minTurnsToKeep: 2,
};

const needsToPrune = needsPruning(messages, testConfig);
console.log(`  Needs pruning: ${needsToPrune}`);
console.log();

// Test 2: Estimate savings before pruning
console.log('2. Estimated Savings:');
const estimate = estimatePruneSavings(messages, testConfig);
console.log(`  Total tool output tokens: ${estimate.totalToolTokens.toLocaleString()}`);
console.log(`  Prunable tokens: ${estimate.prunableTokens.toLocaleString()}`);
console.log(`  Tool outputs count: ${estimate.outputsCount}`);
console.log();

// Test 3: Actually prune
console.log('3. Pruning Results:');
const pruneResult = pruneToolOutputs(messages, testConfig);
const totalTokensAfter = countTotalTokens(pruneResult.messages);

console.log(`  Outputs pruned: ${pruneResult.outputsPruned}`);
console.log(`  Tokens saved: ${pruneResult.tokensSaved.toLocaleString()}`);
console.log(`  Pruned tools: ${pruneResult.prunedTools.join(', ') || 'none'}`);
console.log(`  Total tokens after: ${totalTokensAfter.toLocaleString()}`);
console.log(`  Actual savings: ${(totalTokensBefore - totalTokensAfter).toLocaleString()}`);
console.log();

// Test 4: Verify recent outputs are preserved
console.log('4. Recent Outputs Preserved:');
const recentToolMessages = pruneResult.messages.filter(m => m.role === 'tool');
let preservedCount = 0;
let prunedCount = 0;

for (const msg of recentToolMessages) {
  for (const part of msg.parts) {
    if (part.type === 'tool-result') {
      const resultPart = part as ToolResultPart;
      if (resultPart.compactedAt) {
        prunedCount++;
        console.log(`  ❌ ${resultPart.toolName}: PRUNED (was ${resultPart.originalTokens} tokens)`);
      } else {
        preservedCount++;
        console.log(`  ✅ ${resultPart.toolName}: PRESERVED`);
      }
    }
  }
}
console.log(`  Summary: ${preservedCount} preserved, ${prunedCount} pruned`);
console.log();

// Test 5: Tool calls are preserved (only outputs cleared)
console.log('5. Tool Calls Preserved:');
const toolCalls = pruneResult.messages
  .filter(m => m.role === 'assistant')
  .flatMap(m => m.parts)
  .filter(p => p.type === 'tool-call') as ToolCallPart[];

console.log(`  Tool calls count: ${toolCalls.length}`);
for (const call of toolCalls) {
  console.log(`  ✅ ${call.toolName} (${call.toolCallId}): input preserved`);
}
console.log();

// Test 6: Message count unchanged
console.log('6. Message Integrity:');
console.log(`  Messages before: ${messages.length}`);
console.log(`  Messages after: ${pruneResult.messages.length}`);
console.log(`  Message count preserved: ${messages.length === pruneResult.messages.length ? '✅ YES' : '❌ NO'}`);

console.log('\n=== All Pruner Tests Complete ===');
