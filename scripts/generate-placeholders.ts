import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLACEHOLDERS_DIR = path.join(__dirname, "../server/templates/assets/images/placeholders");
const GRAY_BG = "#E5E7EB";
const ICON_COLOR = "#9CA3AF";

async function generatePlaceholders() {
  console.log("🎨 Generating placeholder images...");

  // Ensure directory exists
  if (!fs.existsSync(PLACEHOLDERS_DIR)) {
    fs.mkdirSync(PLACEHOLDERS_DIR, { recursive: true });
    console.log(`✓ Created directory: ${PLACEHOLDERS_DIR}`);
  }

  try {
    // 1. Hero Placeholder (1600x900px) - Mountain icon
    await generateHeroPlaceholder();

    // 2. Image-Text Placeholder (800x600px) - Image icon
    await generateImageTextPlaceholder();

    // 3. Feature Icon Placeholder (48x48px SVG) - Circle with star
    await generateFeatureIconSVG();

    // 4. Logo Placeholder (already exists as default-logo.svg, but ensure it exists)
    console.log("✓ Logo placeholder already exists at /assets/images/default-logo.svg");

    console.log("\n✅ All placeholder images generated successfully!");
    console.log(`📁 Location: ${PLACEHOLDERS_DIR}`);
  } catch (error) {
    console.error("❌ Error generating placeholders:", error);
    process.exit(1);
  }
}

async function generateHeroPlaceholder() {
  const width = 1600;
  const height = 900;

  // Create SVG with mountain icon
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${GRAY_BG}"/>
      <g transform="translate(${width / 2 - 80}, ${height / 2 - 80})">
        <!-- Mountain icon -->
        <path d="M80 140 L120 60 L140 100 L160 40 L200 140 Z"
              fill="${ICON_COLOR}" opacity="0.6"/>
        <path d="M40 140 L80 80 L100 110 L120 70 L160 140 Z"
              fill="${ICON_COLOR}" opacity="0.4"/>
      </g>
      <text x="${width / 2}" y="${height / 2 + 120}"
            font-family="system-ui, sans-serif"
            font-size="24"
            fill="${ICON_COLOR}"
            text-anchor="middle">Hero Image</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toFile(path.join(PLACEHOLDERS_DIR, "hero-placeholder.jpg"));

  console.log("✓ Generated hero-placeholder.jpg (1600x900)");
}

async function generateImageTextPlaceholder() {
  const width = 800;
  const height = 600;

  // Create SVG with image icon
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${GRAY_BG}"/>
      <g transform="translate(${width / 2 - 60}, ${height / 2 - 60})">
        <!-- Image icon (rectangle with mountain) -->
        <rect x="0" y="0" width="120" height="120"
              fill="none" stroke="${ICON_COLOR}" stroke-width="3" rx="4"/>
        <circle cx="30" cy="35" r="12" fill="${ICON_COLOR}" opacity="0.6"/>
        <path d="M10 90 L40 60 L60 80 L90 45 L110 90 Z"
              fill="${ICON_COLOR}" opacity="0.6"/>
      </g>
      <text x="${width / 2}" y="${height / 2 + 90}"
            font-family="system-ui, sans-serif"
            font-size="18"
            fill="${ICON_COLOR}"
            text-anchor="middle">Content Image</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toFile(path.join(PLACEHOLDERS_DIR, "image-text-placeholder.jpg"));

  console.log("✓ Generated image-text-placeholder.jpg (800x600)");
}

async function generateFeatureIconSVG() {
  const size = 48;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="22" fill="${GRAY_BG}" stroke="${ICON_COLOR}" stroke-width="2"/>
      <path d="M24 8 L27 18 L38 18 L29 25 L32 36 L24 29 L16 36 L19 25 L10 18 L21 18 Z"
            fill="${ICON_COLOR}"/>
    </svg>
  `;

  fs.writeFileSync(path.join(PLACEHOLDERS_DIR, "feature-icon-placeholder.svg"), svg);

  console.log("✓ Generated feature-icon-placeholder.svg (48x48)");
}

// Run the generator
generatePlaceholders();
