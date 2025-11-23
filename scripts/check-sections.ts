import { db } from "../server/db/client";
import * as schema from "../server/db/schema";

async function checkSections() {
  console.log("🔍 Checking section definitions in database...\n");

  try {
    const sections = await db
      .select({
        key: schema.sectionDefinitions.key,
        name: schema.sectionDefinitions.name,
        description: schema.sectionDefinitions.description,
        templateKey: schema.sectionDefinitions.templateKey,
        status: schema.sectionDefinitions.status,
      })
      .from(schema.sectionDefinitions);

    console.log(`Found ${sections.length} section definition(s):\n`);

    sections.forEach((section, index) => {
      console.log(`${index + 1}. ${section.name}`);
      console.log(`   Key: ${section.key}`);
      console.log(`   Template: server/templates/sections/${section.templateKey}/default.njk`);
      console.log(`   Status: ${section.status}`);
      console.log(`   Description: ${section.description}`);
      console.log();
    });

    // Check specifically for image-text
    const imageTextSection = sections.find(s => s.key === 'image-text');
    if (imageTextSection) {
      console.log("✅ Image-text section is registered and ready to use!");
    } else {
      console.log("❌ Image-text section not found in database.");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to check sections:", error);
    process.exit(1);
  }
}

checkSections();
