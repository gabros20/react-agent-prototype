/**
 * Checkpoint Manager
 * 
 * Provides state persistence for long-running agent tasks:
 * - Auto-checkpoint every 3 steps
 * - Checkpoint on phase transitions
 * - Checkpoint before HITL approval
 * - Resume from checkpoint after crash/timeout
 * 
 * Enables:
 * - Survive server restarts (resume in <1s)
 * - Timeout recovery (continue 10-step task after 120s timeout)
 * - User can close browser, come back later
 * - Debugging: replay from any checkpoint
 */

import type { CoreMessage } from 'ai'
import type { DrizzleDB } from '../../db/client.js'
import type { MemoryLayers, Subgoal } from './memory-manager.js'
import * as schema from '../../db/schema.js'
import { eq } from 'drizzle-orm'

export interface AgentCheckpoint {
	id: string
	sessionId: string
	traceId: string
	phase: 'planning' | 'executing' | 'verifying' | 'reflecting'
	mode: 'architect' | 'cms-crud' | 'debug' | 'ask'
	currentSubgoal: string | null
	completedSubgoals: string[]

	// Memory state
	messages: CoreMessage[]
	workingMemory: CoreMessage[]
	subgoalMemory: Subgoal[]

	// Execution state
	stepNumber: number
	pendingActions: string[]
	lastToolResult: any | null

	// Metadata
	tokenCount: number
	estimatedCompletion: number // % complete (0-100)
	createdAt: Date
}

export interface CheckpointContext {
	logger: {
		info: (msg: string, meta?: any) => void
		warn: (msg: string, meta?: any) => void
		error: (msg: string, meta?: any) => void
	}
}

export class CheckpointManager {
	constructor(
		private db: DrizzleDB,
		private context: CheckpointContext
	) {}

	/**
	 * Save checkpoint to database
	 */
	async save(checkpoint: AgentCheckpoint): Promise<void> {
		try {
			// Update session with checkpoint data
			await this.db
				.update(schema.sessions)
				.set({
					checkpoint: JSON.stringify(checkpoint),
					updatedAt: new Date(),
				})
				.where(eq(schema.sessions.id, checkpoint.sessionId))

			this.context.logger.info('Checkpoint saved', {
				sessionId: checkpoint.sessionId,
				checkpointId: checkpoint.id,
				stepNumber: checkpoint.stepNumber,
				phase: checkpoint.phase,
				tokenCount: checkpoint.tokenCount,
				completion: `${checkpoint.estimatedCompletion}%`,
			})
		} catch (error: any) {
			this.context.logger.error('Failed to save checkpoint', {
				sessionId: checkpoint.sessionId,
				error: error.message,
			})
			throw error
		}
	}

	/**
	 * Load checkpoint from database
	 */
	async restore(sessionId: string): Promise<AgentCheckpoint | null> {
		try {
			const result = await this.db.query.sessions.findFirst({
				where: eq(schema.sessions.id, sessionId),
			})

			if (!result?.checkpoint) {
				this.context.logger.warn('No checkpoint found', { sessionId })
				return null
			}

			const checkpoint = JSON.parse(result.checkpoint as string) as AgentCheckpoint

			this.context.logger.info('Checkpoint restored', {
				sessionId,
				checkpointId: checkpoint.id,
				stepNumber: checkpoint.stepNumber,
				phase: checkpoint.phase,
				subgoalsCompleted: checkpoint.completedSubgoals.length,
			})

			return checkpoint
		} catch (error: any) {
			this.context.logger.error('Failed to restore checkpoint', {
				sessionId,
				error: error.message,
			})
			return null
		}
	}

	/**
	 * Check if checkpoint exists for session
	 */
	async exists(sessionId: string): Promise<boolean> {
		try {
			const result = await this.db.query.sessions.findFirst({
				where: eq(schema.sessions.id, sessionId),
				columns: { checkpoint: true },
			})

			return !!result?.checkpoint
		} catch (error) {
			return false
		}
	}

	/**
	 * Clear checkpoint (on successful completion or manual reset)
	 */
	async clear(sessionId: string): Promise<void> {
		try {
			await this.db
				.update(schema.sessions)
				.set({
					checkpoint: null,
					updatedAt: new Date(),
				})
				.where(eq(schema.sessions.id, sessionId))

			this.context.logger.info('Checkpoint cleared', { sessionId })
		} catch (error: any) {
			this.context.logger.error('Failed to clear checkpoint', {
				sessionId,
				error: error.message,
			})
		}
	}

	/**
	 * List all sessions with checkpoints (for recovery UI)
	 */
	async listCheckpoints(): Promise<Array<{ sessionId: string; checkpoint: AgentCheckpoint }>> {
		try {
			const results = await this.db.query.sessions.findMany({
				where: (sessions, { isNotNull }) => isNotNull(sessions.checkpoint),
			})

			return results
				.map((r) => {
					try {
						return {
							sessionId: r.id,
							checkpoint: JSON.parse(r.checkpoint as string) as AgentCheckpoint,
						}
					} catch {
						return null
					}
				})
				.filter((r): r is { sessionId: string; checkpoint: AgentCheckpoint } => r !== null)
		} catch (error: any) {
			this.context.logger.error('Failed to list checkpoints', {
				error: error.message,
			})
			return []
		}
	}

	/**
	 * Create checkpoint from current agent state
	 */
	createCheckpoint(params: {
		sessionId: string
		traceId: string
		phase: AgentCheckpoint['phase']
		mode: AgentCheckpoint['mode']
		stepNumber: number
		maxSteps: number
		messages: CoreMessage[]
		memoryState: MemoryLayers
		currentSubgoal: string | null
		completedSubgoals: string[]
		lastToolResult?: any
	}): AgentCheckpoint {
		return {
			id: crypto.randomUUID(),
			sessionId: params.sessionId,
			traceId: params.traceId,
			phase: params.phase,
			mode: params.mode,
			currentSubgoal: params.currentSubgoal,
			completedSubgoals: params.completedSubgoals,

			// Memory state
			messages: params.messages,
			workingMemory: params.memoryState.workingMemory,
			subgoalMemory: params.memoryState.subgoalMemory,

			// Execution state
			stepNumber: params.stepNumber,
			pendingActions: [], // TODO: Extract from last step
			lastToolResult: params.lastToolResult || null,

			// Metadata
			tokenCount: this.estimateTokens(params.messages),
			estimatedCompletion: Math.min((params.stepNumber / params.maxSteps) * 100, 100),
			createdAt: new Date(),
		}
	}

	/**
	 * Estimate token count for checkpoint
	 */
	private estimateTokens(messages: CoreMessage[]): number {
		return messages.reduce((sum, msg) => {
			const content =
				typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
			return sum + Math.ceil(content.length / 4)
		}, 0)
	}

	/**
	 * Determine if checkpoint should be created
	 */
	shouldCheckpoint(params: {
		stepNumber: number
		phase: string
		previousPhase?: string
		isBeforeApproval?: boolean
		isAfterError?: boolean
	}): boolean {
		// Always checkpoint every 3 steps
		if (params.stepNumber % 3 === 0) return true

		// Checkpoint on phase transitions
		if (params.previousPhase && params.phase !== params.previousPhase) return true

		// Checkpoint before HITL approval
		if (params.isBeforeApproval) return true

		// Checkpoint after errors (for recovery)
		if (params.isAfterError) return true

		return false
	}
}
