/**
 * Prompt Builder - Type-safe prompt construction
 *
 * Builds agent prompts with explicit injection points.
 * Replaces fragile regex matching with structured, typed injections.
 *
 * Usage:
 *   const builder = new PromptBuilder(baseTemplate);
 *   const prompt = builder
 *     .withWorkingMemory(contextString)
 *     .withToolInstructions(toolPrompts)
 *     .withDatetime(new Date())
 *     .build();
 *
 * Design decisions:
 * - Immutable builder pattern (each method returns new instance)
 * - Explicit methods for each injection point (no magic strings)
 * - Validation at build time (optional)
 * - Caching for repeated builds with same data
 */

import {
  INJECTION_POINTS,
  type InjectionPointName,
  type InjectionData,
  validateTemplate,
} from './injection-points';
import { normalizePromptText } from '../../utils/prompt-normalizer';

// ============================================================================
// Prompt Builder Class
// ============================================================================

export class PromptBuilder {
  private readonly template: string;
  private readonly injections: Readonly<InjectionData>;

  // Build cache for memoization
  private _buildCache: { data: InjectionData; result: string } | null = null;

  private constructor(template: string, injections: InjectionData = {}) {
    this.template = template;
    this.injections = Object.freeze({ ...injections });
  }

  /**
   * Create a new builder from a template string
   */
  static fromTemplate(template: string): PromptBuilder {
    return new PromptBuilder(template);
  }

  /**
   * Create a new builder from a template, validating injection points exist
   */
  static fromTemplateWithValidation(template: string): PromptBuilder {
    const validation = validateTemplate(template);
    if (!validation.valid) {
      console.warn(
        `[PromptBuilder] Template missing injection points: ${validation.missing.join(', ')}`
      );
    }
    return new PromptBuilder(template);
  }

  // ============================================================================
  // Injection Methods (return new instance - immutable)
  // ============================================================================

  /**
   * Set working memory content
   * Injected into <working-memory> section
   */
  withWorkingMemory(content: string): PromptBuilder {
    return new PromptBuilder(this.template, {
      ...this.injections,
      workingMemory: content,
    });
  }

  /**
   * Set tool usage instructions
   * Injected into <tool-usage-instructions> section
   */
  withToolInstructions(content: string): PromptBuilder {
    return new PromptBuilder(this.template, {
      ...this.injections,
      toolUsageInstructions: content,
    });
  }

  /**
   * Set current datetime
   * Injected into <current-datetime> section
   */
  withDatetime(date: Date | string): PromptBuilder {
    const dateString = date instanceof Date ? date.toISOString() : date;
    return new PromptBuilder(this.template, {
      ...this.injections,
      currentDatetime: dateString,
    });
  }

  /**
   * Set multiple injections at once
   */
  withInjections(data: Partial<InjectionData>): PromptBuilder {
    return new PromptBuilder(this.template, {
      ...this.injections,
      ...data,
    });
  }

  // ============================================================================
  // Build Methods
  // ============================================================================

  /**
   * Build the final prompt with all injections applied
   */
  build(): string {
    // Check cache
    if (this._buildCache && this.injectionDataEquals(this._buildCache.data)) {
      return this._buildCache.result;
    }

    let result = this.template;

    // Apply each injection
    for (const [name, point] of Object.entries(INJECTION_POINTS) as [InjectionPointName, typeof INJECTION_POINTS[InjectionPointName]][]) {
      const content = this.injections[name] ?? '';
      const replacement = `<${point.openTag}>\n${content}\n</${point.closeTag}>`;

      // Reset regex lastIndex before use (global flag issue)
      point.pattern.lastIndex = 0;
      result = result.replace(point.pattern, replacement);
    }

    // Normalize whitespace
    result = normalizePromptText(result);

    // Cache result
    this._buildCache = { data: { ...this.injections }, result };

    return result;
  }

  /**
   * Build without normalization (preserves exact whitespace)
   */
  buildRaw(): string {
    let result = this.template;

    for (const [name, point] of Object.entries(INJECTION_POINTS) as [InjectionPointName, typeof INJECTION_POINTS[InjectionPointName]][]) {
      const content = this.injections[name] ?? '';
      const replacement = `<${point.openTag}>\n${content}\n</${point.closeTag}>`;

      point.pattern.lastIndex = 0;
      result = result.replace(point.pattern, replacement);
    }

    return result;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the current injection data (for debugging)
   */
  getInjections(): Readonly<InjectionData> {
    return this.injections;
  }

  /**
   * Check if a specific injection is set
   */
  hasInjection(point: InjectionPointName): boolean {
    return this.injections[point] !== undefined && this.injections[point] !== '';
  }

  /**
   * Get the base template (without injections)
   */
  getTemplate(): string {
    return this.template;
  }

  /**
   * Compare injection data for cache validation
   */
  private injectionDataEquals(other: InjectionData): boolean {
    return (
      this.injections.workingMemory === other.workingMemory &&
      this.injections.toolUsageInstructions === other.toolUsageInstructions &&
      this.injections.currentDatetime === other.currentDatetime
    );
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick prompt build for simple cases
 */
export function buildPrompt(
  template: string,
  data: InjectionData
): string {
  return PromptBuilder.fromTemplate(template)
    .withInjections(data)
    .build();
}
