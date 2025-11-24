import { randomUUID } from "node:crypto";
import { db } from "../server/db/client";
import * as schema from "../server/db/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Placeholder images for blog posts
    // Fixed image UUIDs that match seed-images.ts
    // These will be updated to actual /uploads/ paths by update-blog-images.ts
    const seedImageIds = [
      "7f27cf0e-0b38-4c24-b6c5-d15528c80ee3", // mountain-landscape.jpg
      "8550a4b0-8ba2-4907-b79c-218f59e2d8e6", // golden-puppy.jpg
      "3f794a9f-5c90-4934-b48f-02d4fdc1c59f", // desk-workspace.jpg
    ];

    // Placeholder URLs for page sections (will be updated by update-page-images.ts)
    const seedImageUrls = [
      "/assets/images/placeholders/hero-placeholder.jpg",
      "/assets/images/placeholders/image-text-placeholder.jpg",
      "/assets/images/placeholders/feature-icon-placeholder.svg"
    ];

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
              {
                key: "backgroundImage",
                type: "image",
                label: "Background Image",
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

    const gallerySectionId = randomUUID();
    await db.insert(schema.sectionDefinitions).values({
      id: gallerySectionId,
      key: "gallery",
      name: "Image Gallery",
      description: "Gallery with title and multiple images",
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
                label: "Gallery Title",
              },
              {
                key: "images",
                type: "imageArray",
                label: "Gallery Images",
                dataRules: { maxImages: 12 },
              },
              {
                key: "layout",
                type: "select",
                label: "Layout",
                dataRules: {
                  options: ["grid", "masonry", "carousel"],
                  default: "grid",
                },
              },
            ],
          },
        ],
      }),
      templateKey: "gallery",
      defaultVariant: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created section definition: gallery (${gallerySectionId})`);

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
    console.log(`✓ Created section definition: image-text (${imageTextSectionId})`);

    const headerSectionId = randomUUID();
    await db.insert(schema.sectionDefinitions).values({
      id: headerSectionId,
      key: "header",
      name: "Header",
      description: "Site header with logo, navigation, and CTA button",
      status: "published",
      elementsStructure: JSON.stringify({
        version: 1,
        rows: [
          {
            id: "row-1",
            slots: [
              {
                key: "logo",
                type: "image",
                label: "Logo",
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
            ],
          },
        ],
      }),
      templateKey: "header",
      defaultVariant: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created section definition: header (${headerSectionId})`);

    const footerSectionId = randomUUID();
    await db.insert(schema.sectionDefinitions).values({
      id: footerSectionId,
      key: "footer",
      name: "Footer",
      description: "Site footer with navigation and copyright",
      status: "published",
      elementsStructure: JSON.stringify({
        version: 1,
        rows: [
          {
            id: "row-1",
            slots: [
              {
                key: "companyName",
                type: "text",
                label: "Company Name",
              },
            ],
          },
        ],
      }),
      templateKey: "footer",
      defaultVariant: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created section definition: footer (${footerSectionId})`);

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
    // 7. Initialize global navigation
    // ========================================================================
    await db.insert(schema.siteSettings).values({
      id: randomUUID(),
      key: "navigation",
      value: JSON.stringify([
        {
          label: "Home",
          href: "/pages/home?locale=en",
          location: "both",
          visible: true,
        },
        {
          label: "Blog",
          href: "/posts/blog?locale=en",
          location: "both",
          visible: true,
        },
        {
          label: "About",
          href: "/pages/about?locale=en",
          location: "both",
          visible: true,
        },
        {
          label: "Contact",
          href: "/pages/contact?locale=en",
          location: "header",
          visible: true,
        },
      ]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Initialized global navigation with Blog link");

    // ========================================================================
    // 8. Create page: home
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
    // 9. Add header section to home page
    // ========================================================================
    const headerPageSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: headerPageSectionId,
      pageId: homePageId,
      sectionDefId: headerSectionId,
      sortOrder: 0,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Added header section to home page`);

    // ========================================================================
    // 10. Add header content (English)
    // ========================================================================
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: headerPageSectionId,
      localeCode: "en",
      content: JSON.stringify({
        ctaText: "Get Started",
        ctaLink: { type: "url", href: "/pages/contact?locale=en" },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Added header content (English)");

    // ========================================================================
    // 11. Add hero section to home page
    // ========================================================================
    const heroPageSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: heroPageSectionId,
      pageId: homePageId,
      sectionDefId: heroSectionId,
      sortOrder: 1,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Added hero section to home page`);

    // ========================================================================
    // 12. Add hero content (English) - Using uploaded image
    // ========================================================================
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: heroPageSectionId,
      localeCode: "en",
      content: JSON.stringify({
        title: "Welcome to Our CMS",
        subtitle: "AI-powered content management with intelligent image handling",
        image: {
          url: "/uploads/images/2025/11/23/original/7f27cf0e-0b38-4c24-b6c5-d15528c80ee3.jpg",
          alt: "Scenic landscape showcasing natural beauty"
        },
        ctaText: "Get Started",
        ctaLink: { type: "url", href: "/pages/contact?locale=en" },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Added hero content (English)");

    // ========================================================================
    // 13. Add feature section to home page
    // ========================================================================
    const featurePageSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: featurePageSectionId,
      pageId: homePageId,
      sectionDefId: featureSectionId,
      sortOrder: 2,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Added feature section to home page`);

    // ========================================================================
    // 14. Add feature content (English)
    // ========================================================================
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: featurePageSectionId,
      localeCode: "en",
      content: JSON.stringify({
        heading: "Powerful Features",
        description: "Discover the capabilities that make our CMS stand out from the rest",
        items: [
          {
            icon: { url: "/assets/images/placeholders/feature-icon-placeholder.svg" },
            title: "AI-Powered Image Management",
            description: "Automatically organize, tag, and optimize images with intelligent processing"
          },
          {
            icon: { url: "/assets/images/placeholders/feature-icon-placeholder.svg" },
            title: "Multi-Language Support",
            description: "Create content in multiple languages with seamless localization"
          },
          {
            icon: { url: "/assets/images/placeholders/feature-icon-placeholder.svg" },
            title: "Real-Time Preview",
            description: "See your changes instantly with our live preview system"
          },
          {
            icon: { url: "/assets/images/placeholders/feature-icon-placeholder.svg" },
            title: "Flexible Content Sections",
            description: "Build dynamic pages with modular, reusable content sections"
          }
        ]
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Added feature content (English)");

    // ========================================================================
    // 15. Add image-text section to home page
    // ========================================================================
    const imageTextPageSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: imageTextPageSectionId,
      pageId: homePageId,
      sectionDefId: imageTextSectionId,
      sortOrder: 3,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Added image-text section to home page`);

    // ========================================================================
    // 16. Add image-text content (English)
    // ========================================================================
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: imageTextPageSectionId,
      localeCode: "en",
      content: JSON.stringify({
        heading: "Built for Modern Teams",
        content: "Our CMS combines cutting-edge AI technology with intuitive design to help your team create, manage, and publish content faster than ever before.\n\nWhether you're building a marketing site, a blog, or a complex multi-language platform, we've got you covered with powerful features and seamless workflows.",
        image: {
          url: "/uploads/images/2025/11/23/original/8550a4b0-8ba2-4907-b79c-218f59e2d8e6.jpg",
          alt: "Team collaboration"
        },
        layout: "image-right",
        mobileLayout: "image-first",
        backgroundColor: "gray",
        ctaText: "Learn More",
        ctaLink: { type: "url", href: "/pages/about?locale=en" }
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Added image-text content (English)");

    // ========================================================================
    // 17. Add CTA section to home page
    // ========================================================================
    const ctaPageSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: ctaPageSectionId,
      pageId: homePageId,
      sectionDefId: ctaSectionId,
      sortOrder: 4,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Added CTA section to home page`);

    // ========================================================================
    // 18. Add CTA content (English)
    // ========================================================================
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: ctaPageSectionId,
      localeCode: "en",
      content: JSON.stringify({
        heading: "Ready to Transform Your Content?",
        description: "Join thousands of teams already using our platform to create amazing digital experiences",
        buttonText: "Start Free Trial",
        buttonLink: { type: "url", href: "/pages/contact?locale=en" }
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Added CTA content (English)");

    // ========================================================================
    // 19. Add footer section to home page
    // ========================================================================
    const footerPageSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: footerPageSectionId,
      pageId: homePageId,
      sectionDefId: footerSectionId,
      sortOrder: 999,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Added footer section to home page`);

    // ========================================================================
    // 20. Add footer content (English)
    // ========================================================================
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: footerPageSectionId,
      localeCode: "en",
      content: JSON.stringify({
        companyName: "My Company",
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Added footer content (English)");

    // ========================================================================
    // 21. Create About page
    // ========================================================================
    const aboutPageId = randomUUID();
    await db.insert(schema.pages).values({
      id: aboutPageId,
      siteId,
      environmentId: envId,
      slug: "about",
      name: "About Us",
      indexing: true,
      meta: JSON.stringify({
        title: "About Us",
        description: "Learn more about our team and mission",
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created page: about (${aboutPageId})`);

    // ========================================================================
    // 22. Add sections to About page
    // ========================================================================
    // Header
    const aboutHeaderSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: aboutHeaderSectionId,
      pageId: aboutPageId,
      sectionDefId: headerSectionId,
      sortOrder: 0,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: aboutHeaderSectionId,
      localeCode: "en",
      content: JSON.stringify({
        ctaText: "Get Started",
        ctaLink: { type: "url", href: "/pages/contact?locale=en" },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Hero (centered variant)
    const aboutHeroSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: aboutHeroSectionId,
      pageId: aboutPageId,
      sectionDefId: heroSectionId,
      sortOrder: 1,
      status: "published",
      variant: "centered",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: aboutHeroSectionId,
      localeCode: "en",
      content: JSON.stringify({
        title: "About Our Team",
        subtitle: "We're building the future of content management",
        image: {
          url: "/uploads/images/2025/11/23/original/3f794a9f-5c90-4934-b48f-02d4fdc1c59f.jpg",
          alt: "Our team"
        },
        ctaText: "Join Us",
        ctaLink: { type: "url", href: "/pages/contact?locale=en" },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Image-Text sections
    const aboutImageText1Id = randomUUID();
    await db.insert(schema.pageSections).values({
      id: aboutImageText1Id,
      pageId: aboutPageId,
      sectionDefId: imageTextSectionId,
      sortOrder: 2,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: aboutImageText1Id,
      localeCode: "en",
      content: JSON.stringify({
        heading: "Our Mission",
        content: "We believe content creation should be intuitive, powerful, and accessible to everyone. That's why we built a CMS that combines the best of AI technology with human creativity.\n\nOur platform empowers teams to focus on what matters most: creating exceptional content that resonates with their audience.",
        image: {
          url: "/uploads/images/2025/11/23/original/7f27cf0e-0b38-4c24-b6c5-d15528c80ee3.jpg",
          alt: "Our mission"
        },
        layout: "image-left",
        mobileLayout: "text-first",
        backgroundColor: "white"
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const aboutImageText2Id = randomUUID();
    await db.insert(schema.pageSections).values({
      id: aboutImageText2Id,
      pageId: aboutPageId,
      sectionDefId: imageTextSectionId,
      sortOrder: 3,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: aboutImageText2Id,
      localeCode: "en",
      content: JSON.stringify({
        heading: "Our Values",
        content: "**Innovation:** We push boundaries and embrace new technologies.\n\n**Simplicity:** Complex problems deserve elegant solutions.\n\n**Collaboration:** Great work happens when teams work together seamlessly.",
        image: {
          url: "/uploads/images/2025/11/23/original/8550a4b0-8ba2-4907-b79c-218f59e2d8e6.jpg",
          alt: "Our values"
        },
        layout: "image-right",
        mobileLayout: "image-first",
        backgroundColor: "gray"
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Footer
    const aboutFooterSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: aboutFooterSectionId,
      pageId: aboutPageId,
      sectionDefId: footerSectionId,
      sortOrder: 999,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: aboutFooterSectionId,
      localeCode: "en",
      content: JSON.stringify({
        companyName: "My Company",
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Created About page with full content");

    // ========================================================================
    // 23. Create Contact page
    // ========================================================================
    const contactPageId = randomUUID();
    await db.insert(schema.pages).values({
      id: contactPageId,
      siteId,
      environmentId: envId,
      slug: "contact",
      name: "Contact Us",
      indexing: true,
      meta: JSON.stringify({
        title: "Contact Us",
        description: "Get in touch with our team",
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created page: contact (${contactPageId})`);

    // ========================================================================
    // 24. Add sections to Contact page
    // ========================================================================
    // Header
    const contactHeaderSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: contactHeaderSectionId,
      pageId: contactPageId,
      sectionDefId: headerSectionId,
      sortOrder: 0,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: contactHeaderSectionId,
      localeCode: "en",
      content: JSON.stringify({
        ctaText: "Get Started",
        ctaLink: { type: "url", href: "/pages/contact?locale=en" },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Hero
    const contactHeroSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: contactHeroSectionId,
      pageId: contactPageId,
      sectionDefId: heroSectionId,
      sortOrder: 1,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: contactHeroSectionId,
      localeCode: "en",
      content: JSON.stringify({
        title: "Get In Touch",
        subtitle: "We'd love to hear from you and help bring your ideas to life",
        image: {
          url: "/uploads/images/2025/11/23/original/3f794a9f-5c90-4934-b48f-02d4fdc1c59f.jpg",
          alt: "Contact us"
        }
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // CTA
    const contactCtaSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: contactCtaSectionId,
      pageId: contactPageId,
      sectionDefId: ctaSectionId,
      sortOrder: 2,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: contactCtaSectionId,
      localeCode: "en",
      content: JSON.stringify({
        heading: "Let's Start a Conversation",
        description: "Whether you have a question, feedback, or want to explore how our CMS can help your team, we're here to help",
        buttonText: "Send Us a Message",
        buttonLink: { type: "url", href: "mailto:hello@example.com" }
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Footer
    const contactFooterSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: contactFooterSectionId,
      pageId: contactPageId,
      sectionDefId: footerSectionId,
      sortOrder: 999,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: contactFooterSectionId,
      localeCode: "en",
      content: JSON.stringify({
        companyName: "My Company",
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Created Contact page with full content");

    // ========================================================================
    // 25. Create blog posts (3 posts: 2 published, 1 draft)
    // ========================================================================

    // Post 1: Published - Getting Started Guide
    const post1Id = randomUUID();
    await db.insert(schema.collectionEntries).values({
      id: post1Id,
      collectionId: blogCollectionId,
      slug: "getting-started-with-cms",
      title: "Getting Started with Our CMS",
      status: "published",
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      author: "Sarah Johnson",
      excerpt: "Learn how to build dynamic websites with our powerful content management system",
      featuredImage: seedImageIds[0], // Mountain landscape - will be updated to /uploads/ path
      category: "Tutorials",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });

    await db.insert(schema.entryContents).values({
      id: randomUUID(),
      entryId: post1Id,
      localeCode: "en",
      content: JSON.stringify({
        body: `# Getting Started with Our CMS

Welcome to our comprehensive guide on building dynamic websites with our content management system!

## What You'll Learn

In this tutorial, we'll cover:

- Setting up your first project
- Creating pages and sections
- Managing content with the visual editor
- Publishing your site to production

## Prerequisites

Before you begin, you should have:

- Basic knowledge of web development
- Node.js 18+ installed
- A code editor (VS Code recommended)

## Step 1: Installation

First, install the CLI tool:

\`\`\`bash
npm install -g our-cms-cli
cms init my-project
\`\`\`

## Step 2: Create Your First Page

Navigate to the dashboard and click "New Page". Give it a name like "Home" and choose a template.

## Step 3: Add Sections

Drag and drop sections from the sidebar to build your page layout. Each section is customizable with various content fields.

## Next Steps

Now that you have a basic understanding, explore our advanced features:

- Dynamic routing
- Multi-language support
- E-commerce integration
- Custom components

Happy building! 🚀`,
        cover: {
          url: seedImageIds[0], // Mountain landscape - will be updated to /uploads/ path
          alt: "CMS Dashboard Screenshot"
        },
        tags: ["tutorial", "getting-started", "cms", "web-development"]
      }),
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });
    console.log(`✓ Created blog post: getting-started-with-cms (${post1Id}) - PUBLISHED`);

    // Post 2: Published - Advanced Techniques
    const post2Id = randomUUID();
    await db.insert(schema.collectionEntries).values({
      id: post2Id,
      collectionId: blogCollectionId,
      slug: "advanced-customization-techniques",
      title: "Advanced Customization Techniques",
      status: "published",
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      author: "Michael Chen",
      excerpt: "Take your sites to the next level with these advanced customization patterns",
      featuredImage: seedImageIds[1], // Golden puppy - will be updated to /uploads/ path
      category: "Advanced",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    await db.insert(schema.entryContents).values({
      id: randomUUID(),
      entryId: post2Id,
      localeCode: "en",
      content: JSON.stringify({
        body: `# Advanced Customization Techniques

Ready to unlock the full power of our CMS? Let's dive into advanced customization patterns.

## Custom Components

Create reusable components that fit your brand:

\`\`\`jsx
export function CustomHero({ title, subtitle, image }) {
  return (
    <section className="hero">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <img src={image} alt={title} />
    </section>
  )
}
\`\`\`

## Dynamic Data Fetching

Integrate with external APIs:

\`\`\`javascript
const products = await fetch('https://api.example.com/products')
  .then(res => res.json())
\`\`\`

## Performance Optimization

### Image Optimization

Use our built-in image optimizer for automatic compression and format conversion:

- WebP for modern browsers
- AVIF for cutting-edge performance
- Automatic responsive sizing

### Code Splitting

Split your code by route to reduce initial bundle size:

\`\`\`javascript
const Dashboard = lazy(() => import('./Dashboard'))
\`\`\`

## Deployment Strategies

### Edge Functions

Deploy serverless functions at the edge for ultra-low latency:

\`\`\`javascript
export default async function handler(req) {
  return new Response('Hello from the edge!')
}
\`\`\`

### CI/CD Integration

Automate your deployment pipeline with GitHub Actions, GitLab CI, or your preferred tool.

## Conclusion

These techniques will help you build production-ready, high-performance sites. Experiment and find what works best for your use case!`,
        cover: {
          url: seedImageIds[1], // Golden puppy - will be updated to /uploads/ path
          alt: "Code Editor with Custom Components"
        },
        tags: ["advanced", "customization", "performance", "optimization"]
      }),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });
    console.log(`✓ Created blog post: advanced-customization-techniques (${post2Id}) - PUBLISHED`);

    // Post 3: Draft - Upcoming Features
    const post3Id = randomUUID();
    await db.insert(schema.collectionEntries).values({
      id: post3Id,
      collectionId: blogCollectionId,
      slug: "upcoming-features-2025",
      title: "Upcoming Features in 2025",
      status: "draft",
      publishedAt: null,
      author: "Emma Williams",
      excerpt: "A sneak peek at the exciting features coming to our platform this year",
      featuredImage: seedImageIds[2], // Desk workspace - will be updated to /uploads/ path
      category: "News",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    await db.insert(schema.entryContents).values({
      id: randomUUID(),
      entryId: post3Id,
      localeCode: "en",
      content: JSON.stringify({
        body: `# Upcoming Features in 2025

We're excited to share what's coming to our CMS platform this year!

## Q1 2025: Visual Editor v2

The next generation of our visual editor is coming with:

- Real-time collaboration
- Advanced component library
- Drag-and-drop layouts
- Mobile-first design tools

## Q2 2025: AI-Powered Content

Harness the power of AI to:

- Generate SEO-optimized content
- Auto-translate to 50+ languages
- Smart image suggestions
- Content quality scoring

## Q3 2025: E-commerce Suite

Launch your online store with:

- Product catalog management
- Shopping cart and checkout
- Payment gateway integrations
- Inventory tracking
- Order management

## Q4 2025: Enterprise Features

Scale your business with:

- Multi-site management
- Advanced permissions and roles
- Custom workflows
- Audit logs and compliance tools

## Beta Program

Want early access? Join our beta program to test these features before they launch!

Stay tuned for more updates! 🎉`,
        cover: {
          url: seedImageIds[2], // Desk workspace - will be updated to /uploads/ path
          alt: "Roadmap Visualization"
        },
        tags: ["news", "roadmap", "features", "2025"]
      }),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });
    console.log(`✓ Created blog post: upcoming-features-2025 (${post3Id}) - DRAFT`);

    // ========================================================================
    // 27. Create default session
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
    console.log(`\n📝 Blog Posts:`);
    console.log(`   - Getting Started with Our CMS (published)`);
    console.log(`   - Advanced Customization Techniques (published)`);
    console.log(`   - Upcoming Features in 2025 (draft)`);
    console.log(`\n🔗 Preview URLs:`);
    console.log(`   Homepage: http://localhost:4000/pages/home?locale=en`);
    console.log(`   Blog List: http://localhost:4000/posts/blog?locale=en`);
    console.log(`   Single Post: http://localhost:4000/posts/blog/getting-started-with-cms?locale=en`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
