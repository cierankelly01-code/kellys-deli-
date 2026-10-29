// One-off for the 2026-10-26/27 photo drop, batch 2 (the photos the first pass flagged
// as "no catalogue row exists"). Two jobs, both idempotent:
//
//  1. CREATE draft rows for items Cieran named himself in his photo filenames —
//     active:false and price £0 (except salads: he set a flat £25/kg for the whole
//     salads range on 2026-10-26, so new salads carry that), real photo attached.
//     Nothing goes customer-visible until he prices/activates it in admin.
//  2. ATTACH photos to EXISTING rows that have none (pots & dips from the Sept seed).
//     Only rows with no photo or an Unsplash placeholder are touched — a local
//     /images/*.webp path is a real photo and is never clobbered.
//
// Run with the target DB on DATABASE_URL (local embedded postgres to test; prod only
// on Cieran's explicit go-ahead, after the static images have deployed).
import "../src/lib/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const isStockPlaceholder = (url: string | null) => !url || url.includes("images.unsplash.com");

const newGroceries: { id: string; department: string; name: string; price?: number; unitLabel?: string; image?: string }[] = [
  { id: "grocery-cake-cherry-flapjack", department: "cakes", name: "Cherry Flapjack" },
  { id: "grocery-cake-rocky-road", department: "cakes", name: "Rocky Road" },
  { id: "grocery-cake-lemon-tart", department: "cakes", name: "Lemon Tart" },
  { id: "grocery-sandwich-smoked-salmon-roll", department: "sandwiches", name: "Smoked Salmon Roll" },
  { id: "grocery-sandwich-focaccia", department: "sandwiches", name: "Focaccia Sandwich" },
  { id: "grocery-meat-pastrami", department: "meats", name: "Pastrami" },
  // Salads range is a flat £25/kg (Cieran, 2026-10-26) — still inactive until he confirms.
  { id: "grocery-salad-waldorf", department: "salads", name: "Waldorf Salad", price: 25, unitLabel: "per 1kg", image: "salad-waldorf" },
  { id: "grocery-salad-pear-blue-cheese", department: "salads", name: "Pear & Blue Cheese Salad", price: 25, unitLabel: "per 1kg", image: "salad-pear-blue-cheese" },
  { id: "grocery-salad-roast-potato-caesar", department: "salads", name: "Roast Potato Caesar Salad", price: 25, unitLabel: "per 1kg", image: "salad-roast-potato-caesar" },
];

const newBreads: { id: string; name: string }[] = [
  { id: "bread-white-farmhouse", name: "White Farmhouse" },
  { id: "bread-granary-cottage", name: "Granary Cottage Loaf" },
  { id: "bread-wholemeal-tin-small", name: "Wholemeal Tin — Small" },
];

// Existing Platter pots from the 2026-09-01 draft seed -> their new real photos.
const potPhotos: Record<string, string> = {
  "pot-hummus": "/images/pot-hummus.webp",
  "pot-olives": "/images/pot-olives.webp",
  "pot-cornichons": "/images/pot-cornichons.webp",
  "pot-smoked-salmon": "/images/pot-smoked-salmon.webp",
};

async function main() {
  const locations = await prisma.location.findMany();
  let created = 0, linked = 0, photos = 0, skipped = 0;

  const maxGrocery = await prisma.groceryProduct.aggregate({ _max: { sortOrder: true } });
  let gSort = (maxGrocery._max.sortOrder ?? 0) + 1;
  for (const g of newGroceries) {
    const existing = await prisma.groceryProduct.findUnique({ where: { id: g.id } });
    if (existing) { console.log(`SKIP grocery (exists): ${g.id}`); skipped++; }
    else {
      await prisma.groceryProduct.create({
        data: {
          id: g.id, department: g.department, name: g.name,
          description: null, unitLabel: g.unitLabel ?? null,
          price: g.price ?? 0, active: false, sortOrder: gSort++,
          imageUrl: `/images/${g.image ?? g.id}.webp`, // salad photos are named without the grocery- prefix
        },
      });
      console.log(`created grocery draft: ${g.id} (${g.department})`);
      created++;
    }
    for (const loc of locations) {
      await prisma.groceryProductLocation.upsert({
        where: { productId_locationId: { productId: g.id, locationId: loc.id } },
        update: {},
        create: { productId: g.id, locationId: loc.id },
      });
      linked++;
    }
  }

  const maxBread = await prisma.breadProduct.aggregate({ _max: { sortOrder: true } });
  let bSort = (maxBread._max.sortOrder ?? 0) + 1;
  for (const b of newBreads) {
    const existing = await prisma.breadProduct.findUnique({ where: { id: b.id } });
    if (existing) { console.log(`SKIP bread (exists): ${b.id}`); skipped++; }
    else {
      await prisma.breadProduct.create({
        data: {
          id: b.id, name: b.name, description: null, price: 0, active: false,
          sortOrder: bSort++, imageUrl: `/images/${b.id}.webp`,
        },
      });
      console.log(`created bread draft: ${b.id}`);
      created++;
    }
    for (const loc of locations) {
      await prisma.breadProductLocation.upsert({
        where: { productId_locationId: { productId: b.id, locationId: loc.id } },
        update: {},
        create: { productId: b.id, locationId: loc.id },
      });
      linked++;
    }
  }

  for (const [id, imageUrl] of Object.entries(potPhotos)) {
    const row = await prisma.platter.findUnique({ where: { id } });
    if (!row) { console.log(`MISSING platter row: ${id}`); skipped++; continue; }
    if (!isStockPlaceholder(row.imageUrl)) { console.log(`SKIP (already has a real photo): ${id} -> ${row.imageUrl}`); skipped++; continue; }
    await prisma.platter.update({ where: { id }, data: { imageUrl } });
    console.log(`updated platter photo: ${id} -> ${imageUrl}`);
    photos++;
  }

  const dbInfo: { db: string; host: string | null }[] =
    await prisma.$queryRawUnsafe(`select current_database() as db, inet_server_addr()::text as host`);
  console.log(`done: ${created} created, ${photos} photos attached, ${linked} location links, ${skipped} skipped — DB:`, dbInfo);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
