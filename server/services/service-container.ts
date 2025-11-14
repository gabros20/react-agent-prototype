import type { DrizzleDB } from "../db/client";
import { EntryService } from "./cms/entry-service";
import { PageService } from "./cms/page-service";
import { SectionService } from "./cms/section-service";
import { SessionService } from "./session-service";
import { VectorIndexService } from "./vector-index";

export class ServiceContainer {
  private static instance: ServiceContainer;

  readonly db: DrizzleDB; // Expose DB for agent context
  readonly vectorIndex: VectorIndexService;
  readonly pageService: PageService;
  readonly sectionService: SectionService;
  readonly entryService: EntryService;
  readonly sessionService: SessionService;

  private constructor(db: DrizzleDB) {
    this.db = db; // Store DB reference
    
    // Initialize vector index first
    this.vectorIndex = new VectorIndexService(process.env.LANCEDB_DIR || "data/lancedb");

    // Initialize services with vector index
    this.pageService = new PageService(db, this.vectorIndex);
    this.sectionService = new SectionService(db, this.vectorIndex);
    this.entryService = new EntryService(db, this.vectorIndex);
    
    // Initialize session service
    this.sessionService = new SessionService(db);
  }

  static async initialize(db: DrizzleDB): Promise<ServiceContainer> {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(db);
      await ServiceContainer.instance.vectorIndex.initialize();
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
}
