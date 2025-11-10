import { ToolRegistry } from './registry'
import * as cmsTools from './categories/cms'
import * as httpTools from './categories/http'
import * as planningTools from './categories/planning'

// Create registry instance
export const registry = new ToolRegistry()

// Register all CMS tools
Object.values(cmsTools).forEach((tool) => {
  if (tool && typeof tool === 'object' && '_metadata' in tool) {
    registry.register(tool)
  }
})

// Register HTTP tools
Object.values(httpTools).forEach((tool) => {
  if (tool && typeof tool === 'object' && '_metadata' in tool) {
    registry.register(tool)
  }
})

// Register planning tools
Object.values(planningTools).forEach((tool) => {
  if (tool && typeof tool === 'object' && '_metadata' in tool) {
    registry.register(tool)
  }
})

// Export tools for direct use
export { cmsTools, httpTools, planningTools }
export { ToolRegistry } from './registry'
export * from './types'

// Log registered tools
console.log(`✅ Tool Registry initialized with ${registry.getAllToolIds().length} tools:`)
registry.getAllToolIds().forEach((id) => console.log(`   - ${id}`))
