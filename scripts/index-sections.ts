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

  // Get all section templates
  const sectionTemplates = await db.select().from(schema.sectionTemplates);
  console.log("Found", sectionTemplates.length, "section templates to index");

  for (const st of sectionTemplates) {
    const searchableText = `${st.name} ${st.key} ${st.description || ""}`;

    // Check if already indexed
    const exists = await vectorIndex.exists(st.id);
    if (exists) {
      console.log("- Already indexed:", st.key);
      continue;
    }

    console.log("- Indexing:", st.key, "-", st.name);
    await vectorIndex.add({
      id: st.id,
      type: "section_template",
      name: st.name,
      slug: st.key,
      searchableText,
      metadata: { templateFile: st.templateFile },
    });
  }

  // Also index page sections
  const pageSections = await db.query.pageSectionContents.findMany({
    with: {
      pageSection: {
        with: {
          page: true,
          sectionTemplate: true,
        },
      },
    },
  });

  console.log("\nFound", pageSections.length, "page sections to index");

  for (const ps of pageSections) {
    if (!ps.pageSection) continue;

    const pageName = ps.pageSection.page?.name || "Unknown";
    const sectionName =
      ps.pageSection.sectionTemplate?.name ||
      ps.pageSection.sectionTemplate?.key ||
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
      slug: ps.pageSection.sectionTemplate?.key || "section",
      searchableText,
      metadata: {
        pageId: ps.pageSection.pageId,
        sectionKey: ps.pageSection.sectionTemplate?.key,
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
