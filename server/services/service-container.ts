import type { DrizzleDB } from "../db/client";
import { EntryService } from "./cms/entry-service";
import { PageService } from "./cms/page-service";
import { SectionService } from "./cms/section-service";
import { SessionService } from "./session-service";
import { ConversationLogService } from "./conversation-log-service";
import { VectorIndexService } from "./vector-index";
import { ToolSearchService } from "./tool-search";
import { AgentOrchestrator } from "./agent";

export class ServiceContainer {
  private static instance: ServiceContainer;

  readonly db: DrizzleDB; // Expose DB for agent context
  readonly vectorIndex: VectorIndexService;
  readonly toolSearch: ToolSearchService;
  readonly pageService: PageService;
  readonly sectionService: SectionService;
  readonly entryService: EntryService;
  readonly sessionService: SessionService;
  readonly conversationLogService: ConversationLogService;

  // Lazy-initialized to avoid circular dependency (orchestrator needs ServiceContainer)
  private _agentOrchestrator?: AgentOrchestrator;

  private constructor(db: DrizzleDB) {
    this.db = db; // Store DB reference

    // Initialize vector index first
    this.vectorIndex = new VectorIndexService(process.env.LANCEDB_DIR || "data/lancedb");

    // Initialize tool search service
    this.toolSearch = new ToolSearchService();

    // Initialize services with vector index
    this.pageService = new PageService(db, this.vectorIndex);
    this.sectionService = new SectionService(db, this.vectorIndex);
    this.entryService = new EntryService(db, this.vectorIndex);

    // Initialize session service
    this.sessionService = new SessionService(db);

    // Initialize conversation log service
    this.conversationLogService = new ConversationLogService(db);
  }

  static async initialize(db: DrizzleDB): Promise<ServiceContainer> {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(db);
      await ServiceContainer.instance.vectorIndex.initialize();
      await ServiceContainer.instance.toolSearch.initialize();
    }
    return ServiceContainer.instance;
  }

  static get(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error("ServiceContainer not initialized. Call initialize() first.");
    }
    return ServiceContainer.instance;
  }

  async dispose(): Promise<void> {
    await this.vectorIndex.close();
  }

  /**
   * Get the agent orchestrator (lazy-initialized)
   */
  get agentOrchestrator(): AgentOrchestrator {
    if (!this._agentOrchestrator) {
      this._agentOrchestrator = new AgentOrchestrator({
        db: this.db,
        services: this,
        sessionService: this.sessionService,
        vectorIndex: this.vectorIndex,
      });
    }
    return this._agentOrchestrator;
  }
}
