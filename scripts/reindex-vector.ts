import "dotenv/config";
import { db } from "../server/db/client";
import { ServiceContainer } from "../server/services/service-container";

async function reindex() {
  console.log("Re-indexing all resources in vector database...\n");

  const services = await ServiceContainer.initialize(db);
  const vectorIndex = services.vectorIndex;

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
      console.log(`+ Indexed page: ${page.name} (${page.slug})`);
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
      console.log(`+ Indexed section: ${section.name} (${section.key})`);
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
      console.log(`+ Indexed collection: ${collection.name} (${collection.slug})`);
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
      console.log(`+ Indexed entry: ${entry.title} (${entry.slug})`);
    }

    // Index all images with metadata
    const images = await db.query.images.findMany({
      with: { metadata: true },
    });
    let imagesIndexed = 0;
    for (const img of images) {
      if (!img.metadata?.searchableText) continue;

      const tags = img.metadata.tags ? JSON.parse(img.metadata.tags as string) : [];
      const categories = img.metadata.categories ? JSON.parse(img.metadata.categories as string) : [];
      const colors = img.metadata.colors ? JSON.parse(img.metadata.colors as string) : { dominant: [] };

      await vectorIndex.add({
        id: img.id,
        type: "image",
        name: img.filename || img.id,
        slug: img.filename || img.id,
        searchableText: img.metadata.searchableText,
        metadata: {
          description: img.metadata.description,
          tags,
          categories,
          colors: colors.dominant || [],
          mood: img.metadata.mood,
          style: img.metadata.style,
        },
      });
      console.log(`+ Indexed image: ${img.originalFilename || img.filename}`);
      imagesIndexed++;
    }

    console.log("\nRe-indexing completed!");
    console.log(`   Pages: ${pages.length}`);
    console.log(`   Sections: ${sections.length}`);
    console.log(`   Collections: ${collections.length}`);
    console.log(`   Entries: ${entries.length}`);
    console.log(`   Images: ${imagesIndexed}`);
    console.log(
      `   Total: ${pages.length + sections.length + collections.length + entries.length + imagesIndexed}`,
    );

    process.exit(0);
  } catch (error) {
    console.error("Re-indexing failed:", error);
    process.exit(1);
  }
}

reindex();
