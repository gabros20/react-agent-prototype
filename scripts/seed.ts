import { randomUUID } from "node:crypto";
import { db } from "../server/db/client";
import * as schema from "../server/db/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // ========================================================================
    // 1. Create team
    // ========================================================================
    const teamId = randomUUID();
    await db.insert(schema.teams).values({
      id: teamId,
      name: "dev-team",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created team: ${teamId}`);

    // ========================================================================
    // 2. Create site
    // ========================================================================
    const siteId = randomUUID();
    const envId = randomUUID();
    await db.insert(schema.sites).values({
      id: siteId,
      teamId,
      name: "local-site",
      domain: "localhost:4000",
      previewDomain: "localhost:4000",
      defaultEnvironmentId: envId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created site: ${siteId}`);

    // ========================================================================
    // 3. Create environment
    // ========================================================================
    await db.insert(schema.environments).values({
      id: envId,
      siteId,
      name: "main",
      isProtected: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created environment: ${envId}`);

    // ========================================================================
    // 4. Create locales
    // ========================================================================
    await db.insert(schema.locales).values([
      {
        code: "en",
        name: "English",
        status: "active",
        createdAt: new Date(),
      },
      {
        code: "de",
        name: "German",
        status: "inactive",
        createdAt: new Date(),
      },
    ]);
    console.log("✓ Created locales: en, de");

    // ========================================================================
    // 5. Create section definitions
    // ========================================================================
    const heroSectionId = randomUUID();
    await db.insert(schema.sectionDefinitions).values({
      id: heroSectionId,
      key: "hero",
      name: "Hero Section",
      description: "Homepage hero with title, subtitle, image, and CTA",
      status: "published",
      elementsStructure: JSON.stringify({
        version: 1,
        rows: [
          {
            id: "row-1",
            slots: [
              {
                key: "title",
                type: "text",
                label: "Title",
                dataRules: { required: true },
              },
              {
                key: "subtitle",
                type: "text",
                label: "Subtitle",
              },
              {
                key: "image",
                type: "image",
                label: "Hero Image",
              },
              {
                key: "ctaText",
                type: "text",
                label: "CTA Button Text",
              },
              {
                key: "ctaLink",
                type: "link",
                label: "CTA Link",
                dataRules: { linkTargets: ["url", "page"] },
              },
            ],
          },
        ],
      }),
      templateKey: "hero",
      defaultVariant: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created section definition: hero (${heroSectionId})`);

    const featureSectionId = randomUUID();
    await db.insert(schema.sectionDefinitions).values({
      id: featureSectionId,
      key: "feature",
      name: "Feature Section",
      description: "Feature grid with heading and items",
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
                dataRules: { required: true },
              },
              {
                key: "description",
                type: "richText",
                label: "Description",
              },
            ],
          },
        ],
      }),
      templateKey: "feature",
      defaultVariant: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created section definition: feature (${featureSectionId})`);

    const ctaSectionId = randomUUID();
    await db.insert(schema.sectionDefinitions).values({
      id: ctaSectionId,
      key: "cta",
      name: "Call-to-Action Section",
      description: "CTA with heading, description, and button",
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
                dataRules: { required: true },
              },
              {
                key: "description",
                type: "text",
                label: "Description",
              },
              {
                key: "buttonText",
                type: "text",
                label: "Button Text",
              },
              {
                key: "buttonLink",
                type: "link",
                label: "Button Link",
                dataRules: { linkTargets: ["url", "page"] },
              },
            ],
          },
        ],
      }),
      templateKey: "cta",
      defaultVariant: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created section definition: cta (${ctaSectionId})`);

    // ========================================================================
    // 6. Create collection definition: blog
    // ========================================================================
    const blogCollectionId = randomUUID();
    await db.insert(schema.collectionDefinitions).values({
      id: blogCollectionId,
      slug: "blog",
      name: "Blog Posts",
      description: "Collection of blog posts",
      status: "published",
      elementsStructure: JSON.stringify({
        version: 1,
        rows: [
          {
            id: "row-1",
            slots: [
              {
                key: "body",
                type: "richText",
                label: "Post Body",
                dataRules: { required: true },
              },
              {
                key: "cover",
                type: "image",
                label: "Cover Image",
              },
              {
                key: "tags",
                type: "option",
                label: "Tags",
                dataRules: {
                  multiple: true,
                  optionValues: ["AI", "Tech", "Design", "Development"],
                },
              },
            ],
          },
        ],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created collection definition: blog (${blogCollectionId})`);

    // ========================================================================
    // 7. Create page: home
    // ========================================================================
    const homePageId = randomUUID();
    await db.insert(schema.pages).values({
      id: homePageId,
      siteId,
      environmentId: envId,
      slug: "home",
      name: "Homepage",
      indexing: true,
      meta: JSON.stringify({
        title: "Home",
        description: "Welcome to our site",
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created page: home (${homePageId})`);

    // ========================================================================
    // 8. Add hero section to home page
    // ========================================================================
    const pageSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: pageSectionId,
      pageId: homePageId,
      sectionDefId: heroSectionId,
      sortOrder: 0,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Added hero section to home page`);

    // ========================================================================
    // 9. Add hero content (English)
    // ========================================================================
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId,
      localeCode: "en",
      content: JSON.stringify({
        title: "Welcome to Our CMS",
        subtitle: "AI-powered content management",
        image: null,
        ctaText: "Get Started",
        ctaLink: { type: "url", href: "/contact" },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Added hero content (English)");

    // ========================================================================
    // 10. Create blog entry
    // ========================================================================
    const blogEntryId = randomUUID();
    await db.insert(schema.collectionEntries).values({
      id: blogEntryId,
      collectionId: blogCollectionId,
      slug: "hello-world",
      title: "Hello World",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created blog entry: hello-world (${blogEntryId})`);

    // ========================================================================
    // 11. Add blog entry content
    // ========================================================================
    await db.insert(schema.entryContents).values({
      id: randomUUID(),
      entryId: blogEntryId,
      localeCode: "en",
      content: JSON.stringify({
        body: "# Hello World\n\nThis is my first blog post!",
        cover: null,
        tags: ["AI", "Tech"],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Added blog entry content (English)");

    // ========================================================================
    // 12. Create default session
    // ========================================================================
    const sessionId = randomUUID();
    await db.insert(schema.sessions).values({
      id: sessionId,
      title: "New Session",
      checkpoint: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created default session: ${sessionId}`);

    // ========================================================================
    // Summary
    // ========================================================================
    console.log("\n✅ Seed completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Team ID: ${teamId}`);
    console.log(`   Site ID: ${siteId}`);
    console.log(`   Environment ID: ${envId}`);
    console.log(`   Home Page ID: ${homePageId}`);
    console.log(`   Session ID: ${sessionId}`);
    console.log(`\n🔗 Preview: http://localhost:4000/pages/home?locale=en`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
