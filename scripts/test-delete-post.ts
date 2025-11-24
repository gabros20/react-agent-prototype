#!/usr/bin/env tsx
/**
 * Test script to verify cms_deletePost tool functionality
 */
import { db } from "../server/db/client";

async function testDeletePost() {
  console.log("🧪 Testing post deletion functionality...\n");

  // Check post exists before deletion
  console.log("1️⃣ Checking if post exists...");
  const postBefore = await db.query.collectionEntries.findFirst({
    where: (ce, { eq }) => eq(ce.slug, "getting-started-with-cms"),
  });

  if (!postBefore) {
    console.log("❌ Post 'getting-started-with-cms' not found!");
    console.log("   Cannot test deletion - post doesn't exist.");
    return;
  }

  console.log(`✅ Found post: "${postBefore.title}"`);
  console.log(`   ID: ${postBefore.id}`);
  console.log(`   Status: ${postBefore.status}\n`);

  // Import the delete tool
  console.log("2️⃣ Testing deletion (without confirmation)...");
  const { cmsDeletePost } = await import("../server/tools/post-tools");

  // Test without confirmation
  const result1 = await cmsDeletePost.execute(
    { postSlug: "getting-started-with-cms", confirmed: false },
    { experimental_context: { services: { entryService: await import("../server/services/cms/entry-service").then(m => m.entryService) } } } as any
  );

  console.log("Result (no confirmation):", JSON.stringify(result1, null, 2));

  if (result1.requiresConfirmation) {
    console.log("✅ Confirmation required (as expected)\n");
  }

  // Test with confirmation
  console.log("3️⃣ Testing deletion (with confirmation)...");
  const result2 = await cmsDeletePost.execute(
    { postSlug: "getting-started-with-cms", confirmed: true },
    { experimental_context: { services: { entryService: await import("../server/services/cms/entry-service").then(m => m.entryService) } } } as any
  );

  console.log("Result (confirmed):", JSON.stringify(result2, null, 2));

  if (result2.success) {
    console.log("✅ Deletion executed\n");
  }

  // Check post no longer exists
  console.log("4️⃣ Verifying post was deleted...");
  const postAfter = await db.query.collectionEntries.findFirst({
    where: (ce, { eq }) => eq(ce.slug, "getting-started-with-cms"),
  });

  if (!postAfter) {
    console.log("✅ Post successfully deleted from database!\n");
  } else {
    console.log(`❌ Post still exists!`);
    console.log(`   ID: ${postAfter.id}`);
    console.log(`   Status: ${postAfter.status}\n`);
  }

  console.log("🎉 Test complete!");
}

testDeletePost().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
