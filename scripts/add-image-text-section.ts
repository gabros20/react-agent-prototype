import { randomUUID } from "node:crypto";
import { db } from "../server/db/client";
import * as schema from "../server/db/schema";

async function addImageTextSection() {
  console.log("➕ Adding image-text section definition...");

  try {
    // Create the image-text section definition
    const imageTextSectionId = randomUUID();
    await db.insert(schema.sectionDefinitions).values({
      id: imageTextSectionId,
      key: "image-text",
      name: "Image-Text Section",
      description: "Flexible two-column layout with text and image, configurable for desktop (LTR/RTL) and mobile (image-first/text-first)",
      status: "published",
      elementsStructure: JSON.stringify({
        version: 1,
        rows: [
          {
            id: "row-1",
            slots: [
              {
                key: "heading",
                type: "text",
                label: "Heading",
              },
              {
                key: "content",
                type: "richText",
                label: "Content",
              },
              {
                key: "image",
                type: "image",
                label: "Image",
              },
              {
                key: "ctaText",
                type: "text",
                label: "CTA Button Text",
              },
              {
                key: "ctaLink",
                type: "link",
                label: "CTA Button Link",
                dataRules: { linkTargets: ["url", "page"] },
              },
              {
                key: "layout",
                type: "select",
                label: "Desktop Layout",
                dataRules: {
                  options: ["image-left", "image-right"],
                  default: "image-right",
                },
              },
              {
                key: "mobileLayout",
                type: "select",
                label: "Mobile Layout",
                dataRules: {
                  options: ["image-first", "text-first"],
                  default: "image-first",
                },
              },
              {
                key: "backgroundColor",
                type: "select",
                label: "Background Color",
                dataRules: {
                  options: ["none", "white", "gray", "primary"],
                  default: "none",
                },
              },
            ],
          },
        ],
      }),
      templateKey: "image-text",
      defaultVariant: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Successfully added image-text section definition (${imageTextSectionId})`);
    console.log("\n📋 Section Details:");
    console.log(`   Key: image-text`);
    console.log(`   Name: Image-Text Section`);
    console.log(`   Template: server/templates/sections/image-text/default.njk`);
    console.log("\n🎉 The agent can now use this section!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to add image-text section:", error);
    process.exit(1);
  }
}

addImageTextSection();
