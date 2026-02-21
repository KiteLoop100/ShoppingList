/**
 * Generates PWA icon sizes (192x192, 512x512) from public/icons/AppIcon.png.
 * Run once: npx tsx scripts/generate-pwa-icons.ts
 */
import sharp from "sharp";
import path from "path";
import fs from "fs";

const PUBLIC_ICONS = path.join(process.cwd(), "public", "icons");
const SRC = path.join(PUBLIC_ICONS, "AppIcon.png");
const SIZES = [192, 512] as const;

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source icon not found:", SRC);
    process.exit(1);
  }
  for (const size of SIZES) {
    const out = path.join(PUBLIC_ICONS, `icon-${size}.png`);
    await sharp(SRC)
      .resize(size, size)
      .png()
      .toFile(out);
    console.log("Created", out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
