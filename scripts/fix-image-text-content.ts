import { db } from "../server/db/client";
import * as schema from "../server/db/schema";
import { eq } from "drizzle-orm";

async function fixImageTextContent() {
  console.log("🔧 Fixing image-text section content...\n");

  try {
    // Find all page section contents with invalid image fields
    const contents = await db
      .select()
      .from(schema.pageSectionContents)
      .innerJoin(
        schema.pageSections,
        eq(schema.pageSectionContents.pageSectionId, schema.pageSections.id)
      )
      .innerJoin(
        schema.sectionDefinitions,
        eq(schema.pageSections.sectionDefId, schema.sectionDefinitions.id)
      )
      .where(eq(schema.sectionDefinitions.key, "image-text"));

    console.log(`Found ${contents.length} image-text section(s)\n`);

    for (const row of contents) {
      const content = JSON.parse(row.page_section_contents.content as string);

      // Check if image field exists and is a string (invalid format)
      if (content.image && typeof content.image === "string") {
        console.log(`❌ Found invalid image format in section ${row.page_section_contents.id}`);
        console.log(`   Current: "${content.image}"`);

        // Remove the invalid image field
        delete content.image;

        // Update the content
        await db
          .update(schema.pageSectionContents)
          .set({
            content: JSON.stringify(content),
            updatedAt: new Date(),
          })
          .where(eq(schema.pageSectionContents.id, row.page_section_contents.id));

        console.log(`   ✅ Removed invalid image field - template will use placeholder\n`);
      } else if (content.image && content.image.url) {
        console.log(`✅ Section ${row.page_section_contents.id} has valid image format\n`);
      } else {
        console.log(`✅ Section ${row.page_section_contents.id} uses placeholder (no image field)\n`);
      }
    }

    console.log("✅ All image-text sections have been checked and fixed!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to fix content:", error);
    process.exit(1);
  }
}

fixImageTextContent();
