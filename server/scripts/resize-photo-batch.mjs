// One-off: resize the 2026-10-27 real shop photos (repo root, untracked) to web-sized
// webp and save into client/public/images, matching server/src/lib/image.ts's own pipeline
// (rotate to apply EXIF, longest edge 1600px, webp q80, EXIF stripped by not copying metadata).
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "client", "public", "images");

const MAX_DIM = 1600;
const WEBP_QUALITY = 80;

const jobs = [
  ["cobs .jpeg", "bread-crusty-cobs.webp"],
  ["broish rolls .jpeg", "bread-brioche-buns-4.webp"],
  ["white soft cobs pack of 6 .jpeg", "bread-soft-cobs-6.webp"],
  ["quichs .jpeg", "grocery-quiche-lorraine.webp"],
  ["pies .jpeg", "grocery-pie-steak.webp"],
  ["gala pork pies .jpeg", "grocery-savoury-pork-pie-large.webp"],
  ["small pork pies .jpeg", "grocery-savoury-pork-pie-small.webp"],
  ["sctched egg .jpeg", "grocery-savoury-scotch-egg.webp"],
  ["sauage rolls .jpeg", "grocery-savoury-sausage-roll.webp"],
  ["veg pakora .jpeg", "grocery-savoury-veg-pakora.webp"],
  ["yorkshire pasty .jpeg", "grocery-savoury-pasty.webp"],
  ["cornflake cake .jpeg", "grocery-cake-cornflake.webp"],
  ["creme slice .jpeg", "grocery-cake-cream-slice.webp"],
  ["old school cake .jpeg", "grocery-cake-old-school-slice.webp"],
  ["honey roast hom .jpeg", "grocery-meat-honey-roast-ham.webp"],
  ["pork @ stuffing .jpeg", "grocery-meat-pork-stuffing.webp"],
  ["rosmary crostion crackers .jpeg", "grocery-pantry-crackers.webp"],
  ["pack of little salted chrips .jpeg", "grocery-pantry-crisps.webp"],
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [srcName, outName] of jobs) {
  const srcPath = path.join(ROOT, srcName);
  const outPath = path.join(OUT_DIR, outName);
  const input = fs.readFileSync(srcPath);
  const buffer = await sharp(input)
    .rotate()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  fs.writeFileSync(outPath, buffer);
  console.log(`${srcName} -> ${outName} (${buffer.length} bytes)`);
}
console.log(`done: ${jobs.length} images`);
