/**
 * Generates PWA icon sizes (192x192, 512x512) from public/icons/AppIcon.png.
 * Trims white edges, then composites onto a solid dark-blue (#1a1a2e) canvas
 * so there are no white borders on any device.
 * Run once: npx tsx scripts/generate-pwa-icons.ts
 */
import sharp from "sharp";
import path from "path";
import fs from "fs";

const PUBLIC_ICONS = path.join(process.cwd(), "public", "icons");
const SRC = path.join(PUBLIC_ICONS, "AppIcon.png");
const SIZES = [192, 512] as const;
const BG: sharp.RGBA = { r: 0x1a, g: 0x1a, b: 0x2e, alpha: 255 };

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source icon not found:", SRC);
    process.exit(1);
  }

  const trimmed = await sharp(SRC)
    .trim({ background: "#ffffff", threshold: 40 })
    .flatten({ background: BG })
    .toBuffer();

  for (const size of SIZES) {
    const out = path.join(PUBLIC_ICONS, `icon-${size}.png`);
    const iconBuf = await sharp(trimmed)
      .resize(size, size, { fit: "contain", background: BG })
      .png()
      .toBuffer();

    await sharp({
      create: { width: size, height: size, channels: 4, background: BG },
    })
      .composite([{ input: iconBuf }])
      .png()
      .toFile(out);

    console.log("Created", out, `(${size}x${size})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
