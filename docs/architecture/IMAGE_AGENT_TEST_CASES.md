# Image Agent Test Cases

**System:** ReAct CMS Agent with Image Handling
**Last Updated:** 2025-11-22

This document provides comprehensive test cases demonstrating the agent's image handling capabilities through natural language interactions.

---

## Table of Contents

1. [Basic Upload & Discovery](#basic-upload--discovery)
2. [Semantic Search](#semantic-search)
3. [Adding Images to Sections](#adding-images-to-sections)
4. [Replacing Images](#replacing-images)
5. [Image Management](#image-management)
6. [Multi-Step Workflows](#multi-step-workflows)
7. [Error Handling](#error-handling)
8. [Advanced Use Cases](#advanced-use-cases)

---

## Basic Upload & Discovery

### Test Case 1.0: List All System Images

**User Action:**

```
Show me all images in the system
```

or

```
What images do we have?
```

**Expected Agent Behavior:**

```
Thought: User wants to see ALL images in the database, not just this conversation.
Action: cms_listAllImages
Action Input: { limit: 50 }
Observation: {
  success: true,
  count: 3,
  images: [
    {
      id: "img-abc123",
      filename: "puppy.jpg",
      originalFilename: "golden_retriever.jpg",
      status: "completed",
      uploadedAt: "2025-11-20T15:30:00Z",
      description: "Golden retriever puppy playing in park",
      tags: ["dog", "puppy", "outdoor"],
      categories: ["animals"]
    },
    {
      id: "img-def456",
      filename: "sunset.jpg",
      originalFilename: "beach_sunset.jpg",
      status: "completed",
      uploadedAt: "2025-11-19T08:00:00Z",
      description: "Ocean sunset with vibrant colors",
      tags: ["nature", "sunset", "ocean"],
      categories: ["landscapes"]
    },
    {
      id: "img-ghi789",
      filename: "product-mockup.png",
      originalFilename: "mockup_v2.png",
      status: "completed",
      uploadedAt: "2025-11-18T12:00:00Z",
      description: "Product mockup for homepage hero section",
      tags: ["product", "mockup", "design"],
      categories: ["marketing"]
    }
  ]
}

FINAL_ANSWER: I found 3 images in the system:

1. **puppy.jpg** (Golden retriever puppy)
   - Description: Golden retriever puppy playing in park
   - Tags: dog, puppy, outdoor
   - Uploaded: Nov 20, 2025

2. **sunset.jpg** (Ocean sunset)
   - Description: Ocean sunset with vibrant colors
   - Tags: nature, sunset, ocean
   - Uploaded: Nov 19, 2025

3. **product-mockup.png** (Product mockup)
   - Description: Product mockup for homepage hero section
   - Tags: product, mockup, design
   - Uploaded: Nov 18, 2025
```

**Follow-up Test:** "Do we have an image of a puppy?"

**Expected:** Agent uses `cms_searchImages` to search for "puppy" and finds puppy.jpg.

---

### Test Case 1.1: List Conversation Images

**User Action:** Uploads 3 images (puppy.jpg, sunset.jpg, product.jpg) then asks:

```
What images did I upload in this conversation?
```

**Expected Agent Behavior:**

```
Thought: User wants to see images from this conversation.
Action: cms_listConversationImages
Action Input: { sessionId: "current-session-id" }
Observation: {
  success: true,
  images: [
    {
      id: "img-abc123",
      filename: "puppy.jpg",
      status: "completed",
      uploadedAt: "2025-11-22T10:00:00Z",
      description: "Golden retriever puppy playing in green grass"
    },
    {
      id: "img-def456",
      filename: "sunset.jpg",
      status: "completed",
      uploadedAt: "2025-11-22T10:01:00Z",
      description: "Sunset over ocean with orange and purple sky"
    },
    {
      id: "img-ghi789",
      filename: "product.jpg",
      status: "processing",
      uploadedAt: "2025-11-22T10:02:00Z",
      description: null
    }
  ]
}

FINAL_ANSWER: You've uploaded 3 images:

1. **puppy.jpg** (Ready)
   - Golden retriever puppy playing in green grass
   - Uploaded at 10:00 AM

2. **sunset.jpg** (Ready)
   - Sunset over ocean with orange and purple sky
   - Uploaded at 10:01 AM

3. **product.jpg** (Still processing)
   - Metadata generation in progress
   - Uploaded at 10:02 AM

The first two images are ready to use. The third is still being processed (usually takes 2-4 seconds).
```

---

### Test Case 1.2: Check Processing Status

**User Action:**

```
Is the product image ready yet?
```

**Expected Agent Behavior:**

```
Thought: User wants to check if a specific image finished processing.
Action: cms_findImage
Action Input: { description: "product image" }
Observation: {
  success: true,
  image: {
    id: "img-ghi789",
    filename: "product.jpg",
    description: "White wireless headphones on blue background",
    status: "completed",
    metadata: {
      tags: ["headphones", "product", "white", "blue", "wireless"],
      categories: ["electronics", "audio"],
      colors: ["white", "blue"],
      mood: "clean",
      style: "product photography"
    }
  }
}

FINAL_ANSWER: Yes! The product image is ready. Here's what our AI found:

**Description:** White wireless headphones on blue background

**Tags:** headphones, product, white, blue, wireless
**Categories:** electronics, audio
**Style:** Product photography
**Mood:** Clean

The image is now fully indexed and searchable. You can use it anywhere in the CMS.
```

---

## Semantic Search

### Test Case 2.1: Find by Color

**User Action:**

```
Show me all images with blue in them
```

**Expected Agent Behavior:**

```
Thought: User wants images containing blue colors.
Action: cms_searchImages
Action Input: { query: "blue color", limit: 10 }
Observation: {
  success: true,
  count: 3,
  images: [
    {
      id: "img-ghi789",
      filename: "product.jpg",
      description: "White wireless headphones on blue background",
      score: 0.94
    },
    {
      id: "img-def456",
      filename: "sunset.jpg",
      description: "Sunset over ocean with orange and purple sky",
      score: 0.78
    },
    {
      id: "img-jkl012",
      filename: "sky.jpg",
      description: "Clear blue sky with white clouds",
      score: 0.96
    }
  ]
}

FINAL_ANSWER: Found 3 images with blue in them:

1. **sky.jpg** (96% match)
   - Clear blue sky with white clouds

2. **product.jpg** (94% match)
   - White wireless headphones on blue background

3. **sunset.jpg** (78% match)
   - Sunset over ocean (has blue ocean water)

The first two have blue as a primary color, the sunset has some blue from the ocean.
```

---

### Test Case 2.2: Find by Subject

**User Action:**

```
Find images of animals
```

**Expected Agent Behavior:**

```
Thought: User wants animal images.
Action: cms_searchImages
Action Input: { query: "animals pets dogs cats wildlife", limit: 10 }
Observation: {
  success: true,
  count: 2,
  images: [
    {
      id: "img-abc123",
      filename: "puppy.jpg",
      description: "Golden retriever puppy playing in green grass",
      score: 0.92,
      metadata: {
        tags: ["puppy", "dog", "golden retriever", "animals", "pets"],
        categories: ["animals", "pets"]
      }
    },
    {
      id: "img-mno345",
      filename: "bird.jpg",
      description: "Colorful parrot perched on branch",
      score: 0.88,
      metadata: {
        tags: ["bird", "parrot", "wildlife", "colorful"],
        categories: ["animals", "wildlife"]
      }
    }
  ]
}

FINAL_ANSWER: Found 2 animal images:

1. **puppy.jpg** (92% match)
   - Golden retriever puppy playing in green grass
   - Tags: puppy, dog, golden retriever, animals, pets

2. **bird.jpg** (88% match)
   - Colorful parrot perched on branch
   - Tags: bird, parrot, wildlife, colorful

Would you like to use any of these in your pages?
```

---

### Test Case 2.3: Find by Mood/Style

**User Action:**

```
I need a professional-looking image
```

**Expected Agent Behavior:**

```
Thought: User wants images with professional style/mood.
Action: cms_searchImages
Action Input: { query: "professional business clean corporate", limit: 5 }
Observation: {
  success: true,
  count: 3,
  images: [
    {
      id: "img-pqr678",
      filename: "office.jpg",
      description: "Modern office workspace with laptop and coffee",
      score: 0.91,
      metadata: {
        style: "professional photography",
        mood: "focused"
      }
    },
    {
      id: "img-ghi789",
      filename: "product.jpg",
      description: "White wireless headphones on blue background",
      score: 0.89,
      metadata: {
        style: "product photography",
        mood: "clean"
      }
    },
    {
      id: "img-stu901",
      filename: "team.jpg",
      description: "Business team meeting in conference room",
      score: 0.87,
      metadata: {
        style: "corporate photography",
        mood: "collaborative"
      }
    }
  ]
}

FINAL_ANSWER: Found 3 professional images:

1. **office.jpg** (91% match)
   - Modern office workspace with laptop and coffee
   - Style: Professional photography
   - Mood: Focused

2. **product.jpg** (89% match)
   - White wireless headphones on blue background
   - Style: Product photography
   - Mood: Clean

3. **team.jpg** (87% match)
   - Business team meeting in conference room
   - Style: Corporate photography
   - Mood: Collaborative

Which style fits your needs best?
```

---

## Adding Images to Sections

### Test Case 3.1: Add to Hero Section

**User Action:** [Uploads hero-image.jpg] then says:

```
Use this as the hero image on the About page
```

**Expected Agent Behavior:**

```
Thought: User wants to add uploaded image to About page hero section.
Step 1: Get the image ID from conversation.

Action: cms_listConversationImages
Observation: {
  images: [
    { id: "img-hero123", filename: "hero-image.jpg", status: "completed" }
  ]
}

Thought: Now I need to find the About page and its hero section.
Action: cms_findResource
Action Input: { query: "About page", resourceType: "page" }
Observation: {
  results: [
    { id: "page-about", type: "page", name: "About", slug: "about" }
  ]
}

Thought: Get the page with its sections.
Action: cms_getPage
Action Input: { pageId: "page-about" }
Observation: {
  id: "page-about",
  name: "About",
  sections: [
    {
      id: "section-abc",
      sectionKey: "hero",
      templateKey: "default",
      sortOrder: 0
    }
  ]
}

Thought: Found the hero section. Now attach the image.
Action: cms_addImageToSection
Action Input: {
  imageId: "img-hero123",
  pageSectionId: "section-abc",
  fieldName: "heroImage"
}
Observation: {
  success: true,
  message: "Image attached to heroImage"
}

FINAL_ANSWER: ✅ Done! I've added the hero image to the About page.

**Image:** hero-image.jpg
**Page:** About
**Section:** Hero (top of page)
**Field:** heroImage

The image is now live on the About page. You can preview it at `/preview/about`.
```

---

### Test Case 3.2: Add to Multiple Sections

**User Action:**

```
Add the sunset photo to both the Home hero and the Contact page background
```

**Expected Agent Behavior:**

```
Thought: User wants to add sunset image to two different page sections.
Step 1: Find the sunset image.

Action: cms_findImage
Action Input: { description: "sunset photo" }
Observation: {
  image: { id: "img-sunset456", filename: "sunset.jpg" }
}

Thought: Now find Home page hero section.
Action: cms_getPage
Action Input: { slug: "home" }
Observation: {
  id: "page-home",
  sections: [
    { id: "section-home-hero", sectionKey: "hero", sortOrder: 0 }
  ]
}

Thought: Attach to Home hero.
Action: cms_addImageToSection
Action Input: {
  imageId: "img-sunset456",
  pageSectionId: "section-home-hero",
  fieldName: "heroImage"
}
Observation: { success: true }

Thought: Now find Contact page.
Action: cms_getPage
Action Input: { slug: "contact" }
Observation: {
  id: "page-contact",
  sections: [
    { id: "section-contact-cta", sectionKey: "cta", sortOrder: 0 }
  ]
}

Thought: Attach as background to Contact CTA section.
Action: cms_addImageToSection
Action Input: {
  imageId: "img-sunset456",
  pageSectionId: "section-contact-cta",
  fieldName: "backgroundImage"
}
Observation: { success: true }

FINAL_ANSWER: ✅ Done! I've added the sunset photo to both locations:

1. **Home Page - Hero Section**
   - Field: heroImage (main hero image)
   - Preview: `/preview/home`

2. **Contact Page - CTA Section**
   - Field: backgroundImage (background for call-to-action)
   - Preview: `/preview/contact`

The same sunset image is now being reused in both places (efficient!).
```

---

## Replacing Images

### Test Case 4.1: Replace Specific Image

**User Action:**

```
Replace the puppy image with the new dog photo I just uploaded
```

**Expected Agent Behavior:**

```
Thought: User wants to replace old puppy image with new one.
Step 1: Find the old puppy image.

Action: cms_findImage
Action Input: { description: "puppy image" }
Observation: {
  image: { id: "img-old-puppy", filename: "puppy.jpg" }
}

Thought: Find the new dog image from conversation.
Action: cms_listConversationImages
Observation: {
  images: [
    { id: "img-new-dog", filename: "dog-photo.jpg", uploadedAt: "2025-11-22T11:00:00Z" }
  ]
}

Thought: Replace everywhere the old puppy appears.
Action: cms_replaceImage
Action Input: {
  oldImageDescription: "puppy image",
  newImageId: "img-new-dog"
}
Observation: {
  success: true,
  message: "Replaced image in all locations",
  updatedSections: 3
}

FINAL_ANSWER: ✅ Replaced the puppy image with your new dog photo.

**Old Image:** puppy.jpg (removed from all pages)
**New Image:** dog-photo.jpg

**Updated Locations (3 total):**
- Home page hero section
- About page team section
- Gallery section

The new image is now live everywhere the old puppy photo was used.
```

---

### Test Case 4.2: Replace by Description

**User Action:**

```
The sunset looks too orange, replace it with something more purple
```

**Expected Agent Behavior:**

```
Thought: User wants to replace sunset image with one that has more purple tones.
Step 1: Search for images with purple sunset.

Action: cms_searchImages
Action Input: { query: "purple sunset twilight dusk", limit: 5 }
Observation: {
  images: [
    {
      id: "img-purple-sunset",
      filename: "twilight.jpg",
      description: "Purple and pink sunset over mountains",
      score: 0.93,
      metadata: { colors: ["purple", "pink", "blue"] }
    },
    {
      id: "img-dusk",
      filename: "evening-sky.jpg",
      description: "Deep purple evening sky",
      score: 0.88
    }
  ]
}

FINAL_ANSWER: I found 2 images with more purple tones:

1. **twilight.jpg** (93% match)
   - Purple and pink sunset over mountains
   - Colors: purple, pink, blue

2. **evening-sky.jpg** (88% match)
   - Deep purple evening sky

Would you like me to replace the current orange sunset with either of these? Just say "use option 1" or "use option 2".

Alternatively, you can upload a new image and I'll use that instead.
```

**User Follow-up:**

```
Use option 1
```

**Agent Continues:**

```
Thought: User chose twilight.jpg. Now replace the sunset.
Action: cms_replaceImage
Action Input: {
  oldImageDescription: "orange sunset",
  newImageId: "img-purple-sunset"
}
Observation: { success: true, updatedSections: 2 }

FINAL_ANSWER: ✅ Done! Replaced the orange sunset with the purple twilight image.

**Updated Pages:**
- Home page hero
- Contact page background

The purple sunset is now live in both locations.
```

---

## Image Management

### Test Case 5.1: Delete Unused Image

**User Action:**

```
Delete the old team photo, we're not using it anymore
```

**Expected Agent Behavior:**

```
Thought: User wants to delete an image. I should confirm first.
Action: cms_findImage
Action Input: { description: "old team photo" }
Observation: {
  image: {
    id: "img-team-old",
    filename: "team-2023.jpg",
    description: "Team photo from 2023 office party"
  }
}

FINAL_ANSWER: ⚠️ I found the image: **team-2023.jpg** (Team photo from 2023 office party)

Before I delete it, let me confirm:
- This will **permanently remove** the image from storage
- It will be **removed from all pages** where it's currently used
- This action **cannot be undone**

Are you sure you want to delete this image? Reply with "yes, delete it" to confirm.
```

**User Confirms:**

```
yes, delete it
```

**Agent Continues:**

```
Thought: User confirmed deletion.
Action: cms_deleteImage
Action Input: { description: "old team photo" }
Observation: {
  success: true,
  message: "Deleted image: team-2023.jpg",
  removedFrom: ["About page", "Team page"]
}

FINAL_ANSWER: ✅ Deleted team-2023.jpg

**Removed from:**
- About page
- Team page

The image file has been permanently deleted from storage.
```

---

### Test Case 5.2: Organize by Category

**User Action:**

```
Show me all product images
```

**Expected Agent Behavior:**

```
Thought: User wants to see images categorized as products.
Action: cms_searchImages
Action Input: { query: "product photography products merchandise items", limit: 20 }
Observation: {
  count: 5,
  images: [
    {
      id: "img-headphones",
      filename: "headphones.jpg",
      description: "White wireless headphones",
      metadata: { categories: ["electronics", "products"] }
    },
    {
      id: "img-watch",
      filename: "smartwatch.jpg",
      description: "Black smartwatch with fitness display",
      metadata: { categories: ["electronics", "products", "wearables"] }
    },
    {
      id: "img-laptop",
      filename: "laptop.jpg",
      description: "Silver laptop on desk",
      metadata: { categories: ["electronics", "products", "computers"] }
    },
    {
      id: "img-shoes",
      filename: "running-shoes.jpg",
      description: "Blue running shoes",
      metadata: { categories: ["products", "footwear", "sports"] }
    },
    {
      id: "img-bottle",
      filename: "water-bottle.jpg",
      description: "Stainless steel water bottle",
      metadata: { categories: ["products", "fitness"] }
    }
  ]
}

FINAL_ANSWER: Found 5 product images:

**Electronics:**
1. headphones.jpg - White wireless headphones
2. smartwatch.jpg - Black smartwatch with fitness display
3. laptop.jpg - Silver laptop on desk

**Sports & Fitness:**
4. running-shoes.jpg - Blue running shoes
5. water-bottle.jpg - Stainless steel water bottle

Would you like me to create a product gallery section with these images?
```

---

## Multi-Step Workflows

### Test Case 6.1: Create Product Showcase

**User Action:** [Uploads 3 product images] then says:

```
Create a new "Products" page with a hero and a gallery of these three products
```

**Expected Agent Behavior:**

```
Thought: Multi-step task:
1. Create Products page
2. Add hero section
3. Add gallery section
4. Attach uploaded images

Step 1: Create page.
Action: cms_createPage
Action Input: { name: "Products", slug: "products" }
Observation: { id: "page-products" }

Step 2: Add hero section.
Action: cms_addSection
Action Input: {
  pageId: "page-products",
  sectionDefKey: "hero",
  sortOrder: 0
}
Observation: { id: "section-products-hero" }

Step 3: Add content to hero.
Action: cms_syncPageContent
Action Input: {
  pageSectionId: "section-products-hero",
  content: {
    title: "Our Products",
    subtitle: "Discover our latest collection"
  }
}
Observation: { success: true }

Step 4: Get uploaded images.
Action: cms_listConversationImages
Observation: {
  images: [
    { id: "img-prod1", filename: "product-1.jpg" },
    { id: "img-prod2", filename: "product-2.jpg" },
    { id: "img-prod3", filename: "product-3.jpg" }
  ]
}

Step 5: Add first product as hero image.
Action: cms_addImageToSection
Action Input: {
  imageId: "img-prod1",
  pageSectionId: "section-products-hero",
  fieldName: "heroImage"
}
Observation: { success: true }

Step 6: Create gallery section.
Action: cms_addSection
Action Input: {
  pageId: "page-products",
  sectionDefKey: "gallery",
  sortOrder: 1
}
Observation: { id: "section-products-gallery" }

Step 7: Add all three images to gallery.
Action: cms_addImageToSection
Action Input: {
  imageId: "img-prod1",
  pageSectionId: "section-products-gallery",
  fieldName: "images",
  sortOrder: 0
}
Observation: { success: true }

Action: cms_addImageToSection
Action Input: {
  imageId: "img-prod2",
  pageSectionId: "section-products-gallery",
  fieldName: "images",
  sortOrder: 1
}
Observation: { success: true }

Action: cms_addImageToSection
Action Input: {
  imageId: "img-prod3",
  pageSectionId: "section-products-gallery",
  fieldName: "images",
  sortOrder: 2
}
Observation: { success: true }

FINAL_ANSWER: ✅ Created your Products page!

**Page Structure:**
1. **Hero Section**
   - Title: "Our Products"
   - Subtitle: "Discover our latest collection"
   - Hero Image: product-1.jpg

2. **Gallery Section**
   - 3 product images in order:
     - product-1.jpg
     - product-2.jpg
     - product-3.jpg

**Preview:** `/preview/products`

The page is ready to view. Would you like me to add any descriptions or customize the layout?
```

---

### Test Case 6.2: Batch Update Images

**User Action:**

```
Update all hero sections to use the new brand colors - replace any blue backgrounds with purple ones
```

**Expected Agent Behavior:**

```
Thought: Multi-step: find pages with blue hero images, find purple alternatives, replace.

Step 1: Search for images with blue backgrounds.
Action: cms_searchImages
Action Input: { query: "blue background hero", limit: 10 }
Observation: {
  images: [
    { id: "img-blue1", filename: "blue-hero.jpg" },
    { id: "img-blue2", filename: "sky-background.jpg" }
  ]
}

Step 2: Search for purple alternatives.
Action: cms_searchImages
Action Input: { query: "purple background hero gradient", limit: 10 }
Observation: {
  images: [
    { id: "img-purple1", filename: "purple-gradient.jpg", score: 0.95 },
    { id: "img-purple2", filename: "lavender-bg.jpg", score: 0.89 }
  ]
}

Step 3: Replace first blue image.
Action: cms_replaceImage
Action Input: {
  oldImageDescription: "blue background hero",
  newImageId: "img-purple1"
}
Observation: { success: true, updatedSections: 3 }

FINAL_ANSWER: ✅ Updated hero sections with new purple brand colors!

**Replaced:**
- blue-hero.jpg → purple-gradient.jpg

**Updated Pages (3 total):**
- Home page
- About page
- Services page

All hero sections now use the new purple brand color. The blue backgrounds have been replaced with a matching purple gradient.

Note: I found another blue image (sky-background.jpg) used in 1 section. Would you like me to replace that one too?
```

---

## Error Handling

### Test Case 7.1: Image Not Found

**User Action:**

```
Add the logo image to the header
```

**Expected Agent Behavior:**

```
Thought: User mentions "logo image" but I need to find it first.
Action: cms_findImage
Action Input: { description: "logo image" }
Observation: {
  success: false,
  error: "No images found matching: 'logo image'"
}

FINAL_ANSWER: ❌ I couldn't find a logo image in the system.

**Options:**
1. **Upload a logo**: Drag and drop your logo file here
2. **Use existing image**: Tell me which image to use (e.g., "use the blue icon")
3. **Search differently**: Try describing it differently (e.g., "company icon" or "brand mark")

What would you like to do?
```

---

### Test Case 7.2: Image Still Processing

**User Action:**

```
Add the product photo to the shop page
```

**Expected Agent Behavior:**

```
Thought: Find the product photo.
Action: cms_findImage
Action Input: { description: "product photo" }
Observation: {
  success: true,
  image: {
    id: "img-product",
    filename: "product-new.jpg",
    status: "processing",
    description: null
  }
}

FINAL_ANSWER: ⏳ The product photo is still being processed.

**Status:** Processing (usually takes 2-4 seconds)
**Filename:** product-new.jpg

I'm generating AI metadata for this image (description, tags, searchable content). This happens automatically in the background.

I can:
1. **Wait for it**: I'll check again in a moment
2. **Use it anyway**: Add it now (metadata will be available soon)
3. **Use different image**: Choose another image instead

What would you prefer? (I recommend waiting a moment - usually very quick!)
```

---

### Test Case 7.3: Ambiguous Request

**User Action:**

```
Add the photo to the page
```

**Expected Agent Behavior:**

```
FINAL_ANSWER: I need a bit more information:

**Which photo?**
You have several uploaded images:
- puppy.jpg
- sunset.jpg
- product.jpg
- team.jpg

**Which page?**
You have multiple pages:
- Home
- About
- Contact
- Products

Please specify, for example:
- "Add the puppy photo to the About page"
- "Use sunset.jpg on the Home hero"
- "Put the product image in the gallery"
```

---

## Advanced Use Cases

### Test Case 8.1: Smart Replacement Based on Context

**User Action:**

```
The homepage looks too dark, make it brighter
```

**Expected Agent Behavior:**

```
Thought: User wants brighter homepage. Check current images.
Action: cms_getPage
Action Input: { slug: "home" }
Observation: {
  sections: [
    {
      id: "section-home-hero",
      sectionKey: "hero",
      images: [
        {
          id: "img-dark-city",
          filename: "night-city.jpg",
          metadata: { mood: "moody", colors: ["dark blue", "black"] }
        }
      ]
    }
  ]
}

Thought: Homepage hero has dark image. Search for bright alternatives.
Action: cms_searchImages
Action Input: { query: "bright light cheerful sunny white", limit: 5 }
Observation: {
  images: [
    {
      id: "img-sunny-day",
      filename: "sunny-beach.jpg",
      description: "Bright sunny beach with blue sky",
      metadata: { mood: "cheerful", colors: ["white", "light blue", "yellow"] }
    }
  ]
}

Thought: Found brighter alternative. Replace.
Action: cms_replaceImage
Action Input: {
  oldImageDescription: "dark city night",
  newImageId: "img-sunny-day"
}
Observation: { success: true }

FINAL_ANSWER: ✅ Made the homepage brighter!

**Before:** Dark night city scene (moody, dark colors)
**After:** Bright sunny beach (cheerful, light colors)

The homepage hero now has a much brighter, more welcoming feel with the sunny beach image.
```

---

### Test Case 8.2: Find and Fill Missing Images

**User Action:**

```
Which pages don't have hero images yet?
```

**Expected Agent Behavior:**

```
Thought: Check all pages and their hero sections for missing images.
Action: cms_listPages
Observation: {
  pages: [
    { id: "page-home", slug: "home" },
    { id: "page-about", slug: "about" },
    { id: "page-contact", slug: "contact" },
    { id: "page-services", slug: "services" }
  ]
}

[Agent checks each page...]

FINAL_ANSWER: Found 2 pages without hero images:

1. **Contact Page**
   - Has hero section but no image assigned
   - Recommend: Use sunset or office image

2. **Services Page**
   - Has hero section but no image assigned
   - Recommend: Use professional/team image

**Pages with hero images:**
- ✅ Home (has sunny-beach.jpg)
- ✅ About (has team-photo.jpg)

Would you like me to:
1. Suggest specific images for each missing hero?
2. Auto-assign appropriate images based on page content?
3. Wait for you to upload new images?
```

---

### Test Case 8.3: Bulk Image Import Workflow

**User Action:** [Uploads 10 product images] then says:

```
Organize these product images and create a gallery
```

**Expected Agent Behavior:**

```
Thought: User uploaded multiple products. List them, categorize, create gallery.

Action: cms_listConversationImages
Observation: {
  images: [
    { id: "img1", filename: "headphones-black.jpg", description: "Black wireless headphones" },
    { id: "img2", filename: "headphones-white.jpg", description: "White wireless headphones" },
    { id: "img3", filename: "laptop-silver.jpg", description: "Silver laptop computer" },
    { id: "img4", filename: "laptop-black.jpg", description: "Black laptop computer" },
    { id: "img5", filename: "mouse-wireless.jpg", description: "Wireless computer mouse" },
    { id: "img6", filename: "keyboard-mech.jpg", description: "Mechanical keyboard" },
    { id: "img7", filename: "monitor-27.jpg", description: "27-inch monitor" },
    { id: "img8", filename: "webcam-hd.jpg", description: "HD webcam" },
    { id: "img9", filename: "desk-lamp.jpg", description: "LED desk lamp" },
    { id: "img10", filename: "chair-ergonomic.jpg", description: "Ergonomic office chair" }
  ]
}

FINAL_ANSWER: I've analyzed your 10 product images. Here's how I can organize them:

**By Category:**

**Audio (2 images)**
- Black wireless headphones
- White wireless headphones

**Computers (4 images)**
- Silver laptop
- Black laptop
- Wireless mouse
- Mechanical keyboard

**Displays (2 images)**
- 27-inch monitor
- HD webcam

**Office (2 images)**
- LED desk lamp
- Ergonomic office chair

**Recommended Actions:**
1. Create separate gallery sections by category?
2. Create single gallery with all 10 products?
3. Create product pages for each with dedicated images?

What would work best for you?
```

---

## Summary of Agent Capabilities

The agent can handle images through natural language by:

### ✅ Discovery & Search

-   List uploaded images in conversation
-   Search by color, subject, mood, style
-   Find specific images by description
-   Check processing status

### ✅ Page Management

gre

-   Add images to hero sections
-   Add images to galleries
-   Add background images to CTAs
-   Attach images to any custom field

### ✅ Bulk Operations

-   Replace images across multiple pages
-   Update all images of a certain type
-   Find and fill missing images
-   Organize imported image batches

### ✅ Smart Assistance

-   Suggest appropriate images for pages
-   Replace based on visual characteristics
-   Categorize and organize images
-   Confirm destructive operations

### ✅ Error Recovery

-   Handle missing images gracefully
-   Wait for processing to complete
-   Ask for clarification when ambiguous
-   Provide helpful error messages

---

**All interactions use natural language - no technical knowledge required!** 🎉
