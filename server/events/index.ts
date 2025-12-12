/**
 * Events Module - Typed SSE event system
 *
 * Provides type-safe event definitions and emission for agent execution.
 */

// Event types
export * from './event-types';

// Event emitter
export { SSEEventEmitter, type SSEWriter, type EventHistoryEntry } from './event-emitter';
