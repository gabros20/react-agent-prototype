/**
 * Tools - Native AI SDK v6 Pattern
 * 
 * All tools are defined in all-tools.ts with native AI SDK v6 pattern.
 * No registry, no factories, no wrappers - just pure AI SDK tools.
 */

export { ALL_TOOLS, TOOL_METADATA } from './all-tools'
export * from './types'

// Log available tools
import { ALL_TOOLS } from './all-tools'
console.log(`✅ Native AI SDK v6 Tools initialized: ${Object.keys(ALL_TOOLS).length} tools`)
Object.keys(ALL_TOOLS).forEach((name) => console.log(`   - ${name}`))
