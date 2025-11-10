/**
 * Error Recovery System
 * 
 * Implements circuit breaker pattern and smart fallbacks:
 * - Circuit breaker: Fail fast after repeated failures
 * - Error classification: 7 categories with specific recovery strategies
 * - Smart retry logic: Exponential backoff, max attempts
 * - Alternative suggestions: Agent-friendly error messages
 */

export type ErrorCategory =
	| 'validation' // Invalid input, schema mismatch
	| 'constraint' // Unique constraint, foreign key violation
	| 'not_found' // Resource doesn't exist
	| 'reference' // Broken reference, cascade error
	| 'circuit_breaker' // Service unavailable (circuit open)
	| 'timeout' // Operation timeout
	| 'unknown' // Uncategorized error

export interface ErrorPattern {
	category: ErrorCategory
	pattern: RegExp
	recoveryStrategy: 'retry' | 'fallback' | 'skip' | 'escalate'
	suggestions: string[]
}

export interface CircuitBreakerState {
	toolName: string
	failures: number
	lastFailure: Date
	state: 'closed' | 'open' | 'half_open'
	resetAfter: number // ms
}

export interface ErrorRecoveryContext {
	logger: {
		info: (msg: string, meta?: any) => void
		warn: (msg: string, meta?: any) => void
		error: (msg: string, meta?: any) => void
	}
	traceId: string
}

export class ErrorRecoveryManager {
	private circuitBreakers = new Map<string, CircuitBreakerState>()

	private readonly MAX_FAILURES = 3
	private readonly RESET_TIMEOUT = 30000 // 30s
	private readonly MAX_RETRIES = 2

	// Error patterns with recovery strategies
	private readonly errorPatterns: ErrorPattern[] = [
		{
			category: 'validation',
			pattern: /validation failed|invalid|schema mismatch|required field/i,
			recoveryStrategy: 'retry',
			suggestions: [
				'Check input schema against section/collection definition',
				'Use cms.findResource to fuzzy-match resource by name',
				'Verify required fields are present',
			],
		},
		{
			category: 'constraint',
			pattern: /unique constraint|already exists|duplicate/i,
			recoveryStrategy: 'fallback',
			suggestions: [
				'Slug already exists - try appending timestamp or number',
				'Use cms.listPages to find existing slugs',
				'Update existing resource instead of creating new',
			],
		},
		{
			category: 'not_found',
			pattern: /not found|does not exist|404/i,
			recoveryStrategy: 'fallback',
			suggestions: [
				'Resource not found - use cms.findResource for fuzzy match',
				'Check if resource was deleted or ID is incorrect',
				'Create resource first before referencing it',
			],
		},
		{
			category: 'reference',
			pattern: /foreign key|reference|cascade|orphan/i,
			recoveryStrategy: 'escalate',
			suggestions: [
				'Referenced resource missing - create it first',
				'Check cascade delete settings',
				'Verify parent resource exists',
			],
		},
		{
			category: 'circuit_breaker',
			pattern: /circuit.*open|service unavailable|too many requests/i,
			recoveryStrategy: 'skip',
			suggestions: [
				'Circuit breaker open - tool temporarily unavailable',
				'Wait 30 seconds before retrying',
				'Use alternative tool or approach',
			],
		},
		{
			category: 'timeout',
			pattern: /timeout|timed out|deadline exceeded/i,
			recoveryStrategy: 'retry',
			suggestions: [
				'Operation timed out - retry with exponential backoff',
				'Break down operation into smaller steps',
				'Check if resource is too large',
			],
		},
		{
			category: 'unknown',
			pattern: /.*/,
			recoveryStrategy: 'escalate',
			suggestions: ['Unexpected error - review logs and manual intervention may be needed'],
		},
	]

	constructor(private context: ErrorRecoveryContext) {}

	/**
	 * Classify error and get recovery strategy
	 */
	classifyError(error: Error | string): {
		category: ErrorCategory
		recoveryStrategy: 'retry' | 'fallback' | 'skip' | 'escalate'
		suggestions: string[]
		message: string
	} {
		const errorMessage = typeof error === 'string' ? error : error.message

		for (const pattern of this.errorPatterns) {
			if (pattern.pattern.test(errorMessage)) {
				return {
					category: pattern.category,
					recoveryStrategy: pattern.recoveryStrategy,
					suggestions: pattern.suggestions,
					message: errorMessage,
				}
			}
		}

		// Fallback to unknown
		return {
			category: 'unknown',
			recoveryStrategy: 'escalate',
			suggestions: ['Unexpected error - review logs and manual intervention may be needed'],
			message: errorMessage,
		}
	}

	/**
	 * Check if circuit breaker is open for tool
	 */
	isCircuitOpen(toolName: string): boolean {
		const breaker = this.circuitBreakers.get(toolName)
		if (!breaker) return false

		// Check if circuit should reset
		if (
			breaker.state === 'open' &&
			Date.now() - breaker.lastFailure.getTime() > breaker.resetAfter
		) {
			// Try half-open state
			breaker.state = 'half_open'
			this.context.logger.info(`Circuit breaker half-open for ${toolName}`)
			return false
		}

		return breaker.state === 'open'
	}

	/**
	 * Record tool failure and update circuit breaker
	 */
	recordFailure(toolName: string, error: Error | string): void {
		let breaker = this.circuitBreakers.get(toolName)

		if (!breaker) {
			breaker = {
				toolName,
				failures: 0,
				lastFailure: new Date(),
				state: 'closed',
				resetAfter: this.RESET_TIMEOUT,
			}
			this.circuitBreakers.set(toolName, breaker)
		}

		breaker.failures++
		breaker.lastFailure = new Date()

		// Open circuit after max failures
		if (breaker.failures >= this.MAX_FAILURES) {
			breaker.state = 'open'
			this.context.logger.warn(`Circuit breaker opened for ${toolName}`, {
				failures: breaker.failures,
				resetAfter: `${breaker.resetAfter / 1000}s`,
			})
		}

		this.context.logger.error(`Tool failure recorded: ${toolName}`, {
			error: typeof error === 'string' ? error : error.message,
			failures: breaker.failures,
			state: breaker.state,
		})
	}

	/**
	 * Record tool success (reset circuit breaker)
	 */
	recordSuccess(toolName: string): void {
		const breaker = this.circuitBreakers.get(toolName)

		if (breaker) {
			if (breaker.state === 'half_open') {
				// Success in half-open state → close circuit
				breaker.state = 'closed'
				breaker.failures = 0
				this.context.logger.info(`Circuit breaker closed for ${toolName}`)
			} else if (breaker.failures > 0) {
				// Reduce failure count on success
				breaker.failures = Math.max(0, breaker.failures - 1)
			}
		}
	}

	/**
	 * Determine if operation should be retried
	 */
	shouldRetry(params: {
		toolName: string
		error: Error | string
		attemptNumber: number
	}): {
		shouldRetry: boolean
		reason: string
		waitMs?: number
	} {
		// Check circuit breaker
		if (this.isCircuitOpen(params.toolName)) {
			return {
				shouldRetry: false,
				reason: 'Circuit breaker open - tool temporarily unavailable',
			}
		}

		// Check max retries
		if (params.attemptNumber >= this.MAX_RETRIES) {
			return {
				shouldRetry: false,
				reason: `Max retries (${this.MAX_RETRIES}) exceeded`,
			}
		}

		// Check error category
		const classification = this.classifyError(params.error)

		if (classification.recoveryStrategy === 'skip' || classification.recoveryStrategy === 'escalate') {
			return {
				shouldRetry: false,
				reason: `Error category '${classification.category}' does not support retry`,
			}
		}

		// Calculate exponential backoff
		const waitMs = Math.min(1000 * 2 ** params.attemptNumber, 10000) // Max 10s

		return {
			shouldRetry: true,
			reason: `Retry attempt ${params.attemptNumber + 1}/${this.MAX_RETRIES}`,
			waitMs,
		}
	}

	/**
	 * Generate agent-friendly error observation
	 */
	generateErrorObservation(params: {
		toolName: string
		error: Error | string
		attemptNumber: number
	}): string {
		const classification = this.classifyError(params.error)

		let observation = `❌ Tool Error: ${params.toolName}\n\n`
		observation += `**Error Category:** ${classification.category}\n`
		observation += `**Message:** ${classification.message}\n\n`

		// Add recovery suggestions
		observation += '**Suggested Actions:**\n'
		classification.suggestions.forEach((suggestion, i) => {
			observation += `${i + 1}. ${suggestion}\n`
		})

		// Add retry info
		const retryDecision = this.shouldRetry({
			toolName: params.toolName,
			error: params.error,
			attemptNumber: params.attemptNumber,
		})

		if (retryDecision.shouldRetry) {
			observation += `\n💡 **Recovery:** ${retryDecision.reason} (wait ${retryDecision.waitMs}ms)\n`
		} else {
			observation += `\n🛑 **Recovery:** ${retryDecision.reason}\n`
		}

		return observation
	}

	/**
	 * Get circuit breaker status for all tools
	 */
	getCircuitStatus(): Array<{
		toolName: string
		state: string
		failures: number
		lastFailure: Date
	}> {
		return Array.from(this.circuitBreakers.values()).map((breaker) => ({
			toolName: breaker.toolName,
			state: breaker.state,
			failures: breaker.failures,
			lastFailure: breaker.lastFailure,
		}))
	}

	/**
	 * Manually reset circuit breaker (for debugging)
	 */
	resetCircuit(toolName: string): void {
		const breaker = this.circuitBreakers.get(toolName)
		if (breaker) {
			breaker.state = 'closed'
			breaker.failures = 0
			this.context.logger.info(`Circuit breaker manually reset for ${toolName}`)
		}
	}

	/**
	 * Reset all circuit breakers (for testing)
	 */
	resetAll(): void {
		this.circuitBreakers.clear()
		this.context.logger.info('All circuit breakers reset')
	}
}
