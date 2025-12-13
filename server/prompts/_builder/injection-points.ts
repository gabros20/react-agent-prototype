/**
 * Injection Points - Type-safe prompt template sections
 *
 * Defines all valid injection points in the agent prompt template.
 * Replaces fragile regex matching with explicit, typed sections.
 *
 * Design decisions:
 * - Each injection point has a unique XML tag pair
 * - Injection is performed by replacing content between tags
 * - Empty content results in empty tags (not removal)
 * - Unknown tags are left untouched (forward compatibility)
 */

// ============================================================================
// Injection Point Definitions
// ============================================================================

/** Valid injection point names */
export type InjectionPointName =
  | 'workingMemory'
  | 'toolUsageInstructions'
  | 'currentDatetime';

/** Map of injection points to their XML tag patterns */
export const INJECTION_POINTS: Record<InjectionPointName, {
  /** Opening tag (without angle brackets) */
  openTag: string;
  /** Closing tag (without angle brackets) */
  closeTag: string;
  /** Regex pattern to match the full section (including content) */
  pattern: RegExp;
  /** Description for documentation */
  description: string;
}> = {
  workingMemory: {
    openTag: 'working-memory',
    closeTag: 'working-memory',
    pattern: /<working-memory>[\s\S]*?<\/working-memory>/g,
    description: 'Recent entities and discovered tools from session context',
  },
  toolUsageInstructions: {
    openTag: 'tool-usage-instructions',
    closeTag: 'tool-usage-instructions',
    pattern: /<tool-usage-instructions>[\s\S]*?<\/tool-usage-instructions>/g,
    description: 'Tool-specific prompts loaded based on discovered tools',
  },
  currentDatetime: {
    openTag: 'current-datetime',
    closeTag: 'current-datetime',
    pattern: /<current-datetime>[\s\S]*?<\/current-datetime>/g,
    description: 'Current date and time for temporal context',
  },
};

// ============================================================================
// Injection Data Types
// ============================================================================

/** Data for all injection points */
export interface InjectionData {
  /** Content for <working-memory> section */
  workingMemory?: string;
  /** Content for <tool-usage-instructions> section */
  toolUsageInstructions?: string;
  /** Content for <current-datetime> section */
  currentDatetime?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format content for injection into a specific point.
 * Wraps content in the appropriate XML tags.
 */
export function formatInjection(point: InjectionPointName, content: string): string {
  const { openTag, closeTag } = INJECTION_POINTS[point];
  return `<${openTag}>\n${content}\n</${closeTag}>`;
}

/**
 * Check if a prompt template contains all expected injection points.
 * Useful for validation during development.
 */
export function validateTemplate(template: string): {
  valid: boolean;
  missing: InjectionPointName[];
  found: InjectionPointName[];
} {
  const found: InjectionPointName[] = [];
  const missing: InjectionPointName[] = [];

  for (const [name, point] of Object.entries(INJECTION_POINTS) as [InjectionPointName, typeof INJECTION_POINTS[InjectionPointName]][]) {
    if (point.pattern.test(template)) {
      found.push(name);
    } else {
      missing.push(name);
    }
    // Reset regex lastIndex (global flag issue)
    point.pattern.lastIndex = 0;
  }

  return {
    valid: missing.length === 0,
    missing,
    found,
  };
}

/**
 * Get all injection point names
 */
export function getInjectionPointNames(): InjectionPointName[] {
  return Object.keys(INJECTION_POINTS) as InjectionPointName[];
}
