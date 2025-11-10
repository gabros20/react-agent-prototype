/**
 * Hierarchical Memory Manager
 * 
 * Implements three-layer memory architecture to prevent context overflow:
 * 1. Working Memory: Recent messages (last 5-10), ~2k-5k tokens
 * 2. Subgoal Memory: Compressed completed subgoals, ~1k-2k tokens
 * 3. Long-term Memory: Persistent facts (future: vector DB)
 * 
 * Based on HiAgent 2024: 2x success rate, 3.8 fewer steps
 */

import type { CoreMessage } from 'ai'

export interface Subgoal {
	id: string
	name: string
	status: 'in_progress' | 'completed' | 'failed'
	summary: string
	keyObservations: string[]
	tokenCount: number
	createdAt: Date
	completedAt?: Date
}

export interface MemoryLayers {
	workingMemory: CoreMessage[]
	subgoalMemory: Subgoal[]
	longTermFacts: string[]
}

export interface MemoryContext {
	logger: {
		info: (msg: string, meta?: any) => void
		warn: (msg: string, meta?: any) => void
		error: (msg: string, meta?: any) => void
	}
	traceId: string
}

export class HierarchicalMemoryManager {
	private layers: MemoryLayers = {
		workingMemory: [],
		subgoalMemory: [],
		longTermFacts: [],
	}

	private readonly MAX_WORKING_TOKENS = 5000 // ~5k tokens for working memory
	private readonly MAX_TOTAL_TOKENS = 100000 // 80% of Gemini 2.5 Flash limit (128k)
	private readonly COMPRESSION_THRESHOLD = 0.8 // Compress at 80% capacity

	constructor(private context: MemoryContext) {}

	/**
	 * Add message to working memory with automatic compression
	 */
	async addMessage(message: CoreMessage): Promise<void> {
		this.layers.workingMemory.push(message)

		// Check if compression needed
		const totalTokens = this.estimateTokens()
		if (totalTokens > this.MAX_TOTAL_TOKENS * this.COMPRESSION_THRESHOLD) {
			this.context.logger.warn(
				`Context approaching limit (${totalTokens}/${this.MAX_TOTAL_TOKENS}), compressing...`
			)
			await this.compress()
		}
	}

	/**
	 * Estimate total token count across all layers
	 */
	estimateTokens(messages?: CoreMessage[]): number {
		const msgs = messages || this.layers.workingMemory

		// Rough estimate: 1 token = 4 chars
		const workingTokens = msgs.reduce((sum, msg) => {
			const content =
				typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
			return sum + Math.ceil(content.length / 4)
		}, 0)

		// Subgoal summaries
		const subgoalTokens = this.layers.subgoalMemory.reduce((sum, sg) => {
			return sum + Math.ceil((sg.summary.length + sg.keyObservations.join('').length) / 4)
		}, 0)

		// Long-term facts
		const factTokens = this.layers.longTermFacts.reduce((sum, fact) => {
			return sum + Math.ceil(fact.length / 4)
		}, 0)

		return workingTokens + subgoalTokens + factTokens
	}

	/**
	 * Get compressed context for agent (all layers)
	 */
	getContext(): CoreMessage[] {
		const context: CoreMessage[] = []

		// 1. System prompt (always first in working memory)
		if (this.layers.workingMemory.length > 0 && this.layers.workingMemory[0].role === 'system') {
			context.push(this.layers.workingMemory[0])
		}

		// 2. Subgoal summaries (compressed history)
		for (const subgoal of this.layers.subgoalMemory) {
			context.push({
				role: 'assistant',
				content: `[Previous subgoal: ${subgoal.name}]\n${subgoal.summary}\nKey observations: ${subgoal.keyObservations.join('; ')}`,
			})
		}

		// 3. Working memory (current subgoal)
		context.push(...this.layers.workingMemory.slice(1))

		return context
	}

	/**
	 * Detect if subgoal completed from recent messages
	 */
	private detectSubgoalCompletion(): Subgoal | null {
		const lastMessages = this.layers.workingMemory.slice(-5)

		for (const msg of lastMessages) {
			if (msg.role !== 'assistant') continue

			const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

			// Pattern: "✅ Done: Created hero section" or "Completed: ..."
			const doneMatch = content.match(/(?:✅\s*Done|Completed):\s*(.+?)(?:\n|$)/i)
			if (doneMatch) {
				return {
					id: crypto.randomUUID(),
					name: doneMatch[1].trim(),
					status: 'completed',
					summary: '', // Will be filled by compression
					keyObservations: [],
					tokenCount: this.estimateTokens(this.layers.workingMemory),
					createdAt: new Date(),
					completedAt: new Date(),
				}
			}

			// Pattern: "❌ Failed: ..." or "Error: ..."
			const failMatch = content.match(/(?:❌\s*Failed|Error):\s*(.+?)(?:\n|$)/i)
			if (failMatch) {
				return {
					id: crypto.randomUUID(),
					name: failMatch[1].trim(),
					status: 'failed',
					summary: '', // Will be filled by compression
					keyObservations: [],
					tokenCount: this.estimateTokens(this.layers.workingMemory),
					createdAt: new Date(),
					completedAt: new Date(),
				}
			}
		}

		return null
	}

	/**
	 * Compress working memory into subgoal summary
	 */
	private async compress(): Promise<void> {
		// 1. Detect if subgoal completed
		const subgoal = this.detectSubgoalCompletion()

		if (subgoal) {
			// 2. Generate compressed summary (simple extraction for now, LLM-based later)
			const summary = this.summarizeSubgoal(this.layers.workingMemory, subgoal.name)

			subgoal.summary = summary.text
			subgoal.keyObservations = summary.keyFacts

			// 3. Store in subgoal memory
			this.layers.subgoalMemory.push(subgoal)

			const originalTokens = subgoal.tokenCount
			const compressedTokens = this.estimateTokens([{ role: 'assistant', content: summary.text }])

			this.context.logger.info(`Compressed subgoal: ${subgoal.name}`, {
				originalTokens,
				compressedTokens,
				compressionRatio: (originalTokens / compressedTokens).toFixed(2),
			})

			// 4. Prune working memory
			this.pruneWorkingMemory()
		} else {
			// No subgoal detected, do importance-based pruning
			this.pruneByImportance()
		}
	}

	/**
	 * Summarize working memory into compact subgoal summary
	 */
	private summarizeSubgoal(
		messages: CoreMessage[],
		subgoalName: string
	): { text: string; keyFacts: string[] } {
		const keyFacts: string[] = []

		// Extract key observations from tool results
		for (const msg of messages) {
			const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

			// Extract tool results
			if (msg.role === 'tool') {
				const resultMatch = content.match(/(?:created|updated|deleted).*?(?:page|section|entry)/gi)
				if (resultMatch) {
					keyFacts.push(...resultMatch.map((m) => m.trim()))
				}
			}

			// Extract validation results
			if (content.includes('✅') || content.includes('validation')) {
				const validationMatch = content.match(/✅\s*(.+?)(?:\n|$)/gi)
				if (validationMatch) {
					keyFacts.push(...validationMatch.map((m) => m.replace(/✅\s*/, '').trim()))
				}
			}
		}

		// Simple summary for now (LLM-based later)
		const summary = `Completed: ${subgoalName}. Key actions: ${keyFacts.slice(0, 3).join(', ')}.`

		return {
			text: summary,
			keyFacts: Array.from(new Set(keyFacts)).slice(0, 5), // Top 5 unique facts
		}
	}

	/**
	 * Keep only essential working memory (system prompt + recent messages)
	 */
	private pruneWorkingMemory(): void {
		const system =
			this.layers.workingMemory[0]?.role === 'system' ? [this.layers.workingMemory[0]] : []
		const recent = this.layers.workingMemory.slice(-3) // Keep last 3 messages

		this.layers.workingMemory = [...system, ...recent]

		this.context.logger.info('Pruned working memory', {
			kept: this.layers.workingMemory.length,
		})
	}

	/**
	 * Importance-based pruning (keep system, recent, and tool results)
	 */
	private pruneByImportance(): void {
		const system =
			this.layers.workingMemory[0]?.role === 'system' ? [this.layers.workingMemory[0]] : []
		const recent = this.layers.workingMemory.slice(-5)
		const middle = this.layers.workingMemory.slice(1, -5)

		// Score middle messages by importance
		const scored = middle.map((msg) => ({
			message: msg,
			score: this.scoreImportance(msg),
		}))

		// Keep top 50% by importance
		const threshold = Math.ceil(scored.length * 0.5)
		const important = scored
			.sort((a, b) => b.score - a.score)
			.slice(0, threshold)
			.map((s) => s.message)

		this.layers.workingMemory = [...system, ...important, ...recent]

		this.context.logger.info(`Pruned ${middle.length - important.length} low-importance messages`)
	}

	/**
	 * Score message importance (0-10)
	 */
	private scoreImportance(msg: CoreMessage): number {
		let score = 5 // Base score

		const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

		// Tool messages are more important
		if (msg.role === 'tool') score += 2

		// Messages with validation results
		if (content.includes('✅') || content.includes('validation')) score += 1

		// Error messages
		if (content.includes('❌') || content.includes('error')) score += 2

		// HITL approval messages
		if (content.includes('approval') || content.includes('approve')) score += 3

		return score
	}

	/**
	 * Get current memory state (for checkpointing)
	 */
	getState(): MemoryLayers {
		return {
			workingMemory: [...this.layers.workingMemory],
			subgoalMemory: [...this.layers.subgoalMemory],
			longTermFacts: [...this.layers.longTermFacts],
		}
	}

	/**
	 * Restore memory state (from checkpoint)
	 */
	restoreState(state: MemoryLayers): void {
		this.layers = {
			workingMemory: [...state.workingMemory],
			subgoalMemory: [...state.subgoalMemory],
			longTermFacts: [...state.longTermFacts],
		}

		this.context.logger.info('Memory state restored', {
			workingMessages: this.layers.workingMemory.length,
			subgoals: this.layers.subgoalMemory.length,
			facts: this.layers.longTermFacts.length,
		})
	}
}
