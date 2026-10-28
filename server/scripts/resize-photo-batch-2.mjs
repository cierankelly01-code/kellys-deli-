// One-off: resize the remaining 2026-10-26/27 real shop photos (repo root, untracked)
// to web-sized webp in client/public/images, matching server/src/lib/image.ts's pipeline
// (rotate to apply EXIF, longest edge 1600px, webp q80, EXIF stripped by not copying metadata).
// The four "pot-*" outputs are crops out of two wider counter-display photos — the pots &
// dips are sold straight from those counter bowls, so a crop of the real bowl is the
// honest product shot.
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "client", "public", "images");

const MAX_DIM = 1600;
const WEBP_QUALITY = 80;

// [source file, output name, optional crop {left, top, width, height} in raw px]
const jobs = [
  ["cherry flapjack .jpeg", "grocery-cake-cherry-flapjack.webp"],
  ["rocky road .jpeg", "grocery-cake-rocky-road.webp"],
  ["lemon tart .jpeg", "grocery-cake-lemon-tart.webp"],
  ["more pics  of pastry .jpeg", "grocery-pastries-case.webp"],
  ["white farmwhouse .jpeg", "bread-white-farmhouse.webp"],
  ["gran cottage laof .jpeg", "bread-granary-cottage.webp"],
  ["whole meal small tin .jpeg", "bread-wholemeal-tin-small.webp"],
  ["pastrimi .jpeg", "grocery-meat-pastrami.webp"],
  ["smoked slamon .jpeg", "pot-smoked-salmon.webp"],
  ["smoked salamon roll .jpeg", "grocery-sandwich-smoked-salmon-roll.webp"],
  ["foccica sandwitch .jpeg", "grocery-sandwich-focaccia.webp"],
  ["waldaf saled .jpeg", "salad-waldorf.webp"],
  ["pear blue cheese .jpeg", "salad-pear-blue-cheese.webp"],
  ["roast potato chears saled .jpeg", "salad-roast-potato-caesar.webp"],
  // Crops from counter-display shots (coordinates in post-EXIF-rotation pixels):
  ["WhatsApp Image 2026-10-26 at 7.43.20 PM (1).jpeg", "pot-cornichons.webp", { left: 235, top: 0, width: 480, height: 440 }],
  ["WhatsApp Image 2026-10-26 at 7.43.20 PM (1).jpeg", "pot-olives.webp", { left: 700, top: 90, width: 420, height: 560 }],
  ["WhatsApp Image 2026-10-26 at 7.43.19 PM (2).jpeg", "pot-hummus.webp", { left: 560, top: 520, width: 390, height: 420 }],
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [srcName, outName, crop] of jobs) {
  const srcPath = path.join(ROOT, srcName);
  const outPath = path.join(OUT_DIR, outName);
  const input = fs.readFileSync(srcPath);
  let img = sharp(input).rotate();
  if (crop) img = img.extract(crop);
  const buffer = await img
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  fs.writeFileSync(outPath, buffer);
  console.log(`${srcName} -> ${outName} (${buffer.length} bytes)`);
}
console.log(`done: ${jobs.length} images`);
