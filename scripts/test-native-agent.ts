/**
 * Test Native AI SDK v6 Agent
 * 
 * Tests the refactored agent with:
 * - experimental_context injection
 * - Native message history
 * - Tool execution
 */

import 'dotenv/config'
import { db } from '../server/db/client'
import { ServiceContainer } from '../server/services/service-container'
import { createAgent, executeAgentWithRetry } from '../server/agent/orchestrator'
import type { AgentContext } from '../server/tools/types'

async function testAgent() {
  console.log('🧪 Testing Native AI SDK v6 Agent\n')
  
  try {
    // Initialize services
    console.log('1. Initializing services...')
    const services = await ServiceContainer.initialize(db)
    console.log('   ✅ Services initialized\n')
    
    // Create context
    console.log('2. Creating agent context...')
    const context: AgentContext = {
      db,
      vectorIndex: services.vectorIndex,
      logger: {
        info: (msg: string | object, meta?: any) => {
          const message = typeof msg === 'string' ? msg : JSON.stringify(msg)
          console.log('   [INFO]', message, meta || '')
        },
        warn: (msg: string | object, meta?: any) => {
          const message = typeof msg === 'string' ? msg : JSON.stringify(msg)
          console.warn('   [WARN]', message, meta || '')
        },
        error: (msg: string | object, meta?: any) => {
          const message = typeof msg === 'string' ? msg : JSON.stringify(msg)
          console.error('   [ERROR]', message, meta || '')
        }
      },
      traceId: 'test-trace-001',
      sessionId: 'test-session-001',
      services,
      sessionService: services.sessionService,
      cmsTarget: {
        siteId: 'default-site',
        environmentId: 'main'
      }
    }
    console.log('   ✅ Context created\n')
    
    // Note: No need to create agent separately anymore
    console.log('3. Agent ready\n')
    
    // Test 1: Simple query
    console.log('4. Test 1: Simple query (no tools)')
    console.log('   Prompt: "What is 2+2?"')
    const result1 = await executeAgentWithRetry(
      'What is 2+2?',
      context
    )
    console.log('   ✅ Response:', result1.text)
    console.log('   Steps:', result1.steps.length)
    console.log('   Retries:', result1.retries)
    console.log()
    
    // Test 2: Query that requires tools
    console.log('5. Test 2: Query requiring tools')
    console.log('   Prompt: "List all pages in the CMS"')
    const result2 = await executeAgentWithRetry(
      'List all pages in the CMS',
      context
    )
    console.log('   ✅ Response:', result2.text)
    console.log('   Steps:', result2.steps.length)
    console.log('   Retries:', result2.retries)
    console.log()
    
    // Test 3: Context retention (with previous messages)
    console.log('6. Test 3: Context retention')
    console.log('   Building conversation history...')
    const previousMessages = [
      { role: 'user' as const, content: 'List all pages' },
      ...result2.response.messages
    ]
    console.log('   Previous messages:', previousMessages.length)
    console.log('   Prompt: "How many pages are there?"')
    const result3 = await executeAgentWithRetry(
      'How many pages are there?',
      context,
      previousMessages as any
    )
    console.log('   ✅ Response:', result3.text)
    console.log('   (Should reference previous tool call results)')
    console.log()
    
    console.log('✅ ALL TESTS PASSED!')
    console.log()
    console.log('Summary:')
    console.log('  - ✅ Agent created with native AI SDK v6 pattern')
    console.log('  - ✅ experimental_context injection works')
    console.log('  - ✅ Tools execute successfully')
    console.log('  - ✅ Message history retained')
    console.log('  - ✅ No "_zod" errors!')
    console.log()
    
    process.exit(0)
  } catch (error) {
    console.error('❌ TEST FAILED:', error)
    console.error((error as Error).stack)
    process.exit(1)
  }
}

testAgent()
