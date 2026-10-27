// One-off: point the 2026-10-27 real shop photos (already resized into
// client/public/images by resize-photo-batch.mjs) at their matching catalogue rows.
// Only existing rows that had no imageUrl yet are touched.
import "../src/lib/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const breadUpdates: Record<string, string> = {
  "bread-crusty-cobs": "/images/bread-crusty-cobs.webp",
  "bread-brioche-buns-4": "/images/bread-brioche-buns-4.webp",
  "bread-soft-cobs-6": "/images/bread-soft-cobs-6.webp",
};

const groceryUpdates: Record<string, string> = {
  "grocery-quiche-lorraine": "/images/grocery-quiche-lorraine.webp",
  "grocery-pie-steak": "/images/grocery-pie-steak.webp",
  "grocery-savoury-pork-pie-large": "/images/grocery-savoury-pork-pie-large.webp",
  "grocery-savoury-pork-pie-small": "/images/grocery-savoury-pork-pie-small.webp",
  "grocery-savoury-scotch-egg": "/images/grocery-savoury-scotch-egg.webp",
  "grocery-savoury-sausage-roll": "/images/grocery-savoury-sausage-roll.webp",
  "grocery-savoury-veg-pakora": "/images/grocery-savoury-veg-pakora.webp",
  "grocery-savoury-pasty": "/images/grocery-savoury-pasty.webp",
  "grocery-cake-cornflake": "/images/grocery-cake-cornflake.webp",
  "grocery-cake-cream-slice": "/images/grocery-cake-cream-slice.webp",
  "grocery-cake-old-school-slice": "/images/grocery-cake-old-school-slice.webp",
  "grocery-meat-honey-roast-ham": "/images/grocery-meat-honey-roast-ham.webp",
  "grocery-meat-pork-stuffing": "/images/grocery-meat-pork-stuffing.webp",
  "grocery-pantry-crackers": "/images/grocery-pantry-crackers.webp",
  "grocery-pantry-crisps": "/images/grocery-pantry-crisps.webp",
};

// Interim stock photos from the 2026-10 Unsplash pass (see kdl-multi-location-rollout-2026-10
// memory) — these are fine to overwrite with a real shop photo. A URL that is already a local
// /images/*.webp path is a real photo from this project and must not be clobbered.
const isStockPlaceholder = (url: string | null) => !url || url.includes("images.unsplash.com");

async function main() {
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const [id, imageUrl] of Object.entries(breadUpdates)) {
    const row = await prisma.breadProduct.findUnique({ where: { id } });
    if (!row) { console.log(`MISSING bread row: ${id}`); missing++; continue; }
    if (!isStockPlaceholder(row.imageUrl)) { console.log(`SKIP (already has a real photo) bread: ${id} -> ${row.imageUrl}`); skipped++; continue; }
    await prisma.breadProduct.update({ where: { id }, data: { imageUrl } });
    console.log(`updated bread: ${id} -> ${imageUrl}`);
    updated++;
  }

  for (const [id, imageUrl] of Object.entries(groceryUpdates)) {
    const row = await prisma.groceryProduct.findUnique({ where: { id } });
    if (!row) { console.log(`MISSING grocery row: ${id}`); missing++; continue; }
    if (!isStockPlaceholder(row.imageUrl)) { console.log(`SKIP (already has a real photo) grocery: ${id} -> ${row.imageUrl}`); skipped++; continue; }
    await prisma.groceryProduct.update({ where: { id }, data: { imageUrl } });
    console.log(`updated grocery: ${id} -> ${imageUrl}`);
    updated++;
  }

  console.log(`\ndone: ${updated} updated, ${skipped} already had an image, ${missing} row(s) not found`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
