/**
 * Index sections in vector database
 * Run: pnpm tsx scripts/index-sections.ts
 */

import { db } from "../server/db/client";
import * as schema from "../server/db/schema";
import { ServiceContainer } from "../server/services/service-container";

async function indexSections() {
  const services = await ServiceContainer.initialize(db);
  const vectorIndex = services.vectorIndex;

  // Get all section definitions
  const sectionDefs = await db.select().from(schema.sectionDefinitions);
  console.log("Found", sectionDefs.length, "section definitions to index");

  for (const def of sectionDefs) {
    const searchableText = `${def.name} ${def.key} ${def.description || ""}`;

    // Check if already indexed
    const exists = await vectorIndex.exists(def.id);
    if (exists) {
      console.log("- Already indexed:", def.key);
      continue;
    }

    console.log("- Indexing:", def.key, "-", def.name);
    await vectorIndex.add({
      id: def.id,
      type: "section_def",
      name: def.name,
      slug: def.key,
      searchableText,
      metadata: { templateKey: def.templateKey },
    });
  }

  // Also index page sections
  const pageSections = await db.query.pageSectionContents.findMany({
    with: {
      pageSection: {
        with: {
          page: true,
          sectionDef: true,
        },
      },
    },
  });

  console.log("\nFound", pageSections.length, "page sections to index");

  for (const ps of pageSections) {
    if (!ps.pageSection) continue;

    const pageName = ps.pageSection.page?.name || "Unknown";
    const sectionName =
      ps.pageSection.sectionDef?.name ||
      ps.pageSection.sectionDef?.key ||
      "section";
    const searchableText = `${pageName} ${sectionName} page section`;

    const exists = await vectorIndex.exists(ps.id);
    if (exists) {
      console.log("- Already indexed:", pageName, "-", sectionName);
      continue;
    }

    console.log("- Indexing:", pageName, "-", sectionName);
    await vectorIndex.add({
      id: ps.id,
      type: "section",
      name: `${pageName} - ${sectionName}`,
      slug: ps.pageSection.sectionDef?.key || "section",
      searchableText,
      metadata: {
        pageId: ps.pageSection.pageId,
        sectionKey: ps.pageSection.sectionDef?.key,
      },
    });
  }

  console.log("\nDone!");
  process.exit(0);
}

indexSections().catch((err) => {
  console.error(err);
  process.exit(1);
});
