import "dotenv/config";
import { db } from "../server/db/client";
import { VectorIndexService } from "../server/services/vector-index";

async function reindex() {
  console.log("🔄 Re-indexing all resources in vector database...");

  const vectorIndex = new VectorIndexService(process.env.LANCEDB_DIR || "data/lancedb");
  await vectorIndex.initialize();

  try {
    // Index all pages
    const pages = await db.query.pages.findMany();
    for (const page of pages) {
      await vectorIndex.add({
        id: page.id,
        type: "page",
        name: page.name,
        slug: page.slug,
        searchableText: `${page.name} ${page.slug}`,
        metadata: { siteId: page.siteId },
      });
      console.log(`✓ Indexed page: ${page.name} (${page.slug})`);
    }

    // Index all section definitions
    const sections = await db.query.sectionDefinitions.findMany();
    for (const section of sections) {
      await vectorIndex.add({
        id: section.id,
        type: "section_def",
        name: section.name,
        slug: section.key,
        searchableText: `${section.name} ${section.key} ${section.description || ""}`,
        metadata: { templateKey: section.templateKey },
      });
      console.log(`✓ Indexed section: ${section.name} (${section.key})`);
    }

    // Index all collections
    const collections = await db.query.collectionDefinitions.findMany();
    for (const collection of collections) {
      await vectorIndex.add({
        id: collection.id,
        type: "collection",
        name: collection.name,
        slug: collection.slug,
        searchableText: `${collection.name} ${collection.slug} ${collection.description || ""}`,
        metadata: {},
      });
      console.log(`✓ Indexed collection: ${collection.name} (${collection.slug})`);
    }

    // Index all entries
    const entries = await db.query.collectionEntries.findMany();
    for (const entry of entries) {
      await vectorIndex.add({
        id: entry.id,
        type: "entry",
        name: entry.title,
        slug: entry.slug,
        searchableText: `${entry.title} ${entry.slug}`,
        metadata: { collectionId: entry.collectionId },
      });
      console.log(`✓ Indexed entry: ${entry.title} (${entry.slug})`);
    }

    await vectorIndex.close();

    console.log("\n✅ Re-indexing completed successfully!");
    console.log(`   Pages: ${pages.length}`);
    console.log(`   Sections: ${sections.length}`);
    console.log(`   Collections: ${collections.length}`);
    console.log(`   Entries: ${entries.length}`);
    console.log(
      `   Total: ${pages.length + sections.length + collections.length + entries.length}`,
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Re-indexing failed:", error);
    process.exit(1);
  }
}

reindex();
