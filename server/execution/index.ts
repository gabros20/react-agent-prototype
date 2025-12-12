/**
 * Execution Module - Agent execution orchestration
 *
 * Decomposed orchestrator with single-responsibility components:
 * - AgentOrchestrator: Thin coordinator
 * - ContextCoordinator: Session & context management
 * - StreamProcessor: Stream handling & entity extraction
 */

// Main orchestrator
export { AgentOrchestrator } from './orchestrator';

// Coordinators
export { ContextCoordinator } from './context-coordinator';
export { StreamProcessor } from './stream-processor';

// Types
export type {
  ExecuteOptions,
  ResolvedExecuteOptions,
  OrchestratorDependencies,
  OrchestratorResult,
  StreamProcessingResult,
  PreparedContext,
  LoggerFactory,
} from './types';
