#!/usr/bin/env tsx
import { db } from "../server/db/client";
import { entryContents } from "../server/db/schema";
import { eq } from "drizzle-orm";

async function fixImage() {
  console.log("🔧 Fixing image URL in exploring-wales post...");

  // Get the entry ID
  const entry = await db.query.collectionEntries.findFirst({
    where: (ce, { eq }) => eq(ce.slug, "exploring-wales"),
  });

  if (!entry) {
    console.log("❌ Post not found");
    return;
  }

  // Get the content
  const content = await db.query.entryContents.findFirst({
    where: eq(entryContents.entryId, entry.id),
  });

  if (!content) {
    console.log("❌ Content not found");
    return;
  }

  // Parse and update
  const data = JSON.parse(content.content as string);

  const newBody = `# Discover the Majestic Landscapes of Wales

Wales is known for its stunning landscapes, rich history, and vibrant culture. From the breathtaking mountains to the picturesque coastlines, every corner of this beautiful country offers unique experiences for travelers.

## Adventure Awaits

Whether you're hiking in Snowdonia, exploring the coastal paths, or visiting historical castles, Wales has something for everyone. The diverse scenery includes rugged mountains, rolling hills, and charming villages, making it a perfect destination for outdoor enthusiasts.

![Mountain Landscape](/uploads/images/2025/11/24/original/7f27cf0e-0b38-4c24-b6c5-d15528c80ee3.jpg)

## Immerse Yourself in Welsh Culture

Wales is not only about its natural beauty; it's also a hub of cultural experiences. Engage with the locals, taste traditional Welsh cuisine, and participate in local festivals.

## Conclusion

Wales offers an enchanting mix of nature and culture that beckons travelers to explore its wonders. Don't miss the opportunity to uncover the beauty of this enchanting country!`;

  data.body = newBody;

  // Update
  await db
    .update(entryContents)
    .set({ content: JSON.stringify(data) })
    .where(eq(entryContents.id, content.id));

  console.log("✅ Fixed image URL!");
  console.log("   Old: https://example.com/mountain-landscape.jpg");
  console.log("   New: /uploads/images/2025/11/24/original/7f27cf0e-0b38-4c24-b6c5-d15528c80ee3.jpg");
}

fixImage().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
