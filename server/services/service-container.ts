import { DrizzleDB } from "../db/client";
import { PageService } from "./cms/page-service";
import { SectionService } from "./cms/section-service";
import { EntryService } from "./cms/entry-service";

export class ServiceContainer {
  private static instance: ServiceContainer;

  readonly pageService: PageService;
  readonly sectionService: SectionService;
  readonly entryService: EntryService;

  private constructor(db: DrizzleDB) {
    // Initialize services
    this.pageService = new PageService(db);
    this.sectionService = new SectionService(db);
    this.entryService = new EntryService(db);
  }

  static initialize(db: DrizzleDB): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(db);
    }
    return ServiceContainer.instance;
  }

  static get(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error("ServiceContainer not initialized. Call initialize() first.");
    }
    return ServiceContainer.instance;
  }
}
