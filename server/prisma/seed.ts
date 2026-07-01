import "../src/lib/env"; // load server/.env so DATABASE_URL is available
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomReferralCode } from "../src/lib/ref";

const prisma = new PrismaClient();

async function main() {
  // --- Locations (multi-site from day one) ---
  // weeklyCapacity = max catering orders per DAY at this location (see SPEC decision #2).
  const locations = [
    { id: "loc-bentley-heath", name: "Bentley Heath", slug: "bentley-heath", weeklyCapacity: 5, active: true },
    { id: "loc-henley", name: "Henley-in-Arden", slug: "henley-in-arden", weeklyCapacity: 4, active: true },
    { id: "loc-stratford", name: "Stratford-upon-Avon", slug: "stratford-upon-avon", weeklyCapacity: 3, active: true },
  ];
  for (const loc of locations) {
    await prisma.location.upsert({ where: { id: loc.id }, update: loc, create: loc });
  }

  // --- Platters (PLACEHOLDER prices/costs/items — edit in the Menu & Pricing editor) ---
  // items: ordered array of { label, qtyPerUnit }.
  //   per-head platter (pricePerHead set): prep qty = qtyPerUnit * headcount
  //   fixed platter   (fixedPrice set):    prep qty = qtyPerUnit * 1 (per order)
  const platters = [
    // ---- At Home ----
    {
      id: "platter-date-night", category: "home", name: "Date Night In", sortOrder: 1, active: true,
      description: "Dinner for two, sorted — the same local produce our regulars have trusted for years.",
      pricePerHead: null as number | null, fixedPrice: 35, cost: 14, serves: "2", minHeadcount: 1,
      imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=60",
      items: [
        { label: "Gourmet sandwiches", qtyPerUnit: 6 },
        { label: "Sausage rolls", qtyPerUnit: 4 },
        { label: "Veg & lamb samosas", qtyPerUnit: 4 },
        { label: "Crusty cobs", qtyPerUnit: 2 },
        { label: "Local cheese & produce", qtyPerUnit: 1 },
        { label: "Fruit pots", qtyPerUnit: 2 },
      ],
    },
    {
      id: "platter-night-in", category: "home", name: "Night In", sortOrder: 2, active: true,
      description: "For family & friends round the table — generous, fresh, no fuss.",
      pricePerHead: null, fixedPrice: 65, cost: 27, serves: "4-6", minHeadcount: 1,
      imageUrl: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=60",
      items: [
        { label: "Gourmet sandwiches", qtyPerUnit: 14 },
        { label: "Sausage rolls", qtyPerUnit: 10 },
        { label: "Veg & lamb samosas", qtyPerUnit: 8 },
        { label: "Crusty cobs", qtyPerUnit: 6 },
        { label: "Local cheese & produce", qtyPerUnit: 2 },
        { label: "Fruit pots", qtyPerUnit: 4 },
      ],
    },
    {
      id: "platter-small-gathering", category: "home", name: "Small Gathering", sortOrder: 3, active: true,
      description: "Birthdays, get-togethers, the good afternoons — a proper spread for the room.",
      pricePerHead: null, fixedPrice: 140, cost: 62, serves: "10-15", minHeadcount: 1,
      imageUrl: "https://images.unsplash.com/photo-1447279506476-3faec8071eee?auto=format&fit=crop&w=800&q=60",
      items: [
        { label: "Gourmet sandwiches", qtyPerUnit: 30 },
        { label: "Sausage rolls", qtyPerUnit: 22 },
        { label: "Veg & lamb samosas", qtyPerUnit: 18 },
        { label: "Crusty cobs", qtyPerUnit: 12 },
        { label: "Local cheese & produce", qtyPerUnit: 4 },
        { label: "Fruit platters", qtyPerUnit: 2 },
      ],
    },
    // ---- Events & Office ----
    {
      id: "platter-big-spread", category: "events", name: "The Big Spread", sortOrder: 1, active: true,
      description: "The full event spread for up to 20 — everything the table needs.",
      pricePerHead: null, fixedPrice: 195, cost: 88, serves: "up to 20", minHeadcount: 1,
      imageUrl: "https://images.unsplash.com/photo-1672826979217-7156a305acf5?auto=format&fit=crop&w=800&q=60",
      items: [
        { label: "Gourmet sandwiches", qtyPerUnit: 45 },
        { label: "Sausage rolls", qtyPerUnit: 30 },
        { label: "Veg & lamb samosas", qtyPerUnit: 24 },
        { label: "Crusty cobs", qtyPerUnit: 18 },
        { label: "Local cheese & produce", qtyPerUnit: 6 },
        { label: "Fruit platters", qtyPerUnit: 3 },
      ],
    },
    {
      id: "platter-office-lunch", category: "events", name: "Office Lunch", sortOrder: 2, active: true,
      description: "Sorted lunch for the team — priced per head, 10 person minimum.",
      pricePerHead: 8.5, fixedPrice: null, cost: 3.4, serves: "10+", minHeadcount: 10,
      imageUrl: "https://images.unsplash.com/photo-1554998171-89445e31c52b?auto=format&fit=crop&w=800&q=60",
      items: [
        { label: "Gourmet sandwiches", qtyPerUnit: 1.5 },
        { label: "Sausage rolls", qtyPerUnit: 1 },
        { label: "Veg & lamb samosas", qtyPerUnit: 1 },
        { label: "Crusty cobs", qtyPerUnit: 1 },
        { label: "Fruit portions", qtyPerUnit: 1 },
      ],
    },
    // ---- Seasonal (off by default — owner switches on by season) ----
    {
      id: "platter-xmas", category: "seasonal", name: "Christmas Spread", sortOrder: 1, active: false,
      description: "Festive favourites for the season — switch on from admin when it's time.",
      pricePerHead: null, fixedPrice: 165, cost: 72, serves: "10-15", minHeadcount: 1,
      imageUrl: "https://images.unsplash.com/photo-1543258103-a62bdc069871?auto=format&fit=crop&w=800&q=60",
      items: [
        { label: "Festive sandwiches", qtyPerUnit: 30 },
        { label: "Pigs in blankets", qtyPerUnit: 24 },
        { label: "Veg & lamb samosas", qtyPerUnit: 16 },
        { label: "Crusty cobs", qtyPerUnit: 12 },
        { label: "Cheese & chutney", qtyPerUnit: 4 },
        { label: "Mince pies", qtyPerUnit: 12 },
      ],
    },
    {
      id: "platter-bbq", category: "seasonal", name: "Summer BBQ Platter", sortOrder: 2, active: false,
      description: "Sunshine spread for gardens & gatherings — switch on for summer.",
      pricePerHead: null, fixedPrice: 150, cost: 66, serves: "10-15", minHeadcount: 1,
      imageUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=60",
      items: [
        { label: "BBQ pulled rolls", qtyPerUnit: 30 },
        { label: "Sausage rolls", qtyPerUnit: 20 },
        { label: "Veg & lamb samosas", qtyPerUnit: 16 },
        { label: "Salads", qtyPerUnit: 6 },
        { label: "Fruit platters", qtyPerUnit: 3 },
      ],
    },
  ];

  for (const p of platters) {
    const data = {
      category: p.category, name: p.name, description: p.description,
      pricePerHead: p.pricePerHead, fixedPrice: p.fixedPrice, cost: p.cost,
      serves: p.serves, minHeadcount: p.minHeadcount, sortOrder: p.sortOrder,
      imageUrl: p.imageUrl, items: p.items, active: p.active,
    };
    await prisma.platter.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } });
  }

  // --- Board configurator (category "platters") — PLACEHOLDER prices/costs/images ---
  // Each boardType has a Small/Medium/Large fixedPrice tile. "Charcuterie" also gets a
  // "build your own" variant (same sizes) that the customer customises with BoardComponent picks.
  type BoardSize = "small" | "medium" | "large";
  const SIZES: Array<{ size: BoardSize; label: string; serves: string }> = [
    { size: "small", label: "Small", serves: "4-6" },
    { size: "medium", label: "Medium", serves: "8-10" },
    { size: "large", label: "Large", serves: "12-15" },
  ];

  interface BoardDef {
    boardType: string;
    name: string;
    description: string;
    image: string;
    items: { label: string; qtyPerUnit: number }[];
    prices: Record<BoardSize, { price: number; cost: number }>;
    buildYourOwn?: boolean;
  }

  const boards: BoardDef[] = [
    {
      boardType: "charcuterie",
      name: "Charcuterie Board",
      image: "https://images.unsplash.com/photo-1678572823447-45fc146df43c?auto=format&fit=crop&w=900&q=70",
      description: "Three local cheeses, salami, stuffed peppers, olives & balsamic onions, with crackers and a jar of chutney.",
      items: [
        { label: "Three cheeses", qtyPerUnit: 1 },
        { label: "Salami", qtyPerUnit: 1 },
        { label: "Stuffed peppers", qtyPerUnit: 1 },
        { label: "Mixed olives", qtyPerUnit: 1 },
        { label: "Balsamic onions", qtyPerUnit: 1 },
        { label: "Crackers", qtyPerUnit: 1 },
        { label: "Chutney", qtyPerUnit: 1 },
      ],
      prices: { small: { price: 28, cost: 11 }, medium: { price: 48, cost: 19 }, large: { price: 75, cost: 30 } },
      buildYourOwn: true,
    },
    {
      boardType: "savoury",
      name: "Savoury Board",
      image: "https://images.unsplash.com/photo-1673960782730-ab13fc062d6d?auto=format&fit=crop&w=900&q=70",
      description: "Sausage rolls, scotch eggs, quiches, samosas, vegetable & chicken kievs — all the hot favourites, served cold.",
      items: [
        { label: "Sausage rolls", qtyPerUnit: 1 },
        { label: "Scotch eggs", qtyPerUnit: 1 },
        { label: "Mini quiches", qtyPerUnit: 1 },
        { label: "Samosas", qtyPerUnit: 1 },
        { label: "Vegetable kievs", qtyPerUnit: 1 },
        { label: "Chicken kievs", qtyPerUnit: 1 },
      ],
      prices: { small: { price: 22, cost: 9 }, medium: { price: 38, cost: 15 }, large: { price: 60, cost: 24 } },
    },
    {
      boardType: "cheese",
      name: "Cheese Board",
      image: "https://images.unsplash.com/photo-1517093602195-b40af9688b46?auto=format&fit=crop&w=900&q=70",
      description: "A generous spread of local cheeses with grapes, olives and fresh fig.",
      items: [
        { label: "Selection of cheeses", qtyPerUnit: 1 },
        { label: "Grapes", qtyPerUnit: 1 },
        { label: "Mixed olives", qtyPerUnit: 1 },
        { label: "Fresh fig", qtyPerUnit: 1 },
      ],
      prices: { small: { price: 26, cost: 10 }, medium: { price: 45, cost: 18 }, large: { price: 70, cost: 28 } },
    },
    {
      boardType: "salmon",
      name: "Smoked Salmon Board",
      image: "https://images.unsplash.com/photo-1577906096429-f73c2c312435?auto=format&fit=crop&w=900&q=70",
      description: "Smoked salmon with blinis and crostinis — simple, fresh and always a favourite.",
      items: [
        { label: "Smoked salmon", qtyPerUnit: 1 },
        { label: "Blinis", qtyPerUnit: 1 },
        { label: "Crostinis", qtyPerUnit: 1 },
      ],
      prices: { small: { price: 30, cost: 13 }, medium: { price: 52, cost: 22 }, large: { price: 80, cost: 34 } },
    },
  ];

  let boardCount = 0;
  for (const b of boards) {
    for (const s of SIZES) {
      const { price, cost } = b.prices[s.size];
      const id = `platter-${b.boardType}-${s.size}`;
      const data = {
        category: "platters", name: `${b.name} — ${s.label}`, description: b.description,
        pricePerHead: null, fixedPrice: price, cost, serves: s.serves, minHeadcount: 1,
        items: b.items, imageUrl: b.image, active: true, sortOrder: boardCount,
        boardType: b.boardType, size: s.size,
      };
      await prisma.platter.upsert({ where: { id }, update: data, create: { id, ...data } });
      boardCount++;

      if (b.buildYourOwn) {
        const customId = `platter-${b.boardType}-${s.size}-custom`;
        const customData = { ...data, name: `${b.name} — ${s.label} (Build Your Own)`, sortOrder: boardCount };
        // (customItems chosen by the customer at order time; this row just carries size/price/image)
        await prisma.platter.upsert({ where: { id: customId }, update: customData, create: { id: customId, ...customData } });
        boardCount++;
      }
    }
  }

  // --- Build-your-own board ingredients (BoardComponent) ---
  const boardComponents = [
    { id: "bc-brie", category: "cheese", label: "Brie", sortOrder: 1 },
    { id: "bc-cheddar", category: "cheese", label: "Mature Cheddar", sortOrder: 2 },
    { id: "bc-red-leicester", category: "cheese", label: "Red Leicester", sortOrder: 3 },
    { id: "bc-stilton", category: "cheese", label: "Blue Stilton", sortOrder: 4 },
    { id: "bc-goats", category: "cheese", label: "Goats Cheese", sortOrder: 5 },
    { id: "bc-ham", category: "meat", label: "Sliced Ham", sortOrder: 1 },
    { id: "bc-turkey", category: "meat", label: "Sliced Turkey", sortOrder: 2 },
    { id: "bc-salami", category: "savoury", label: "Salami", sortOrder: 1 },
    { id: "bc-peppers", category: "savoury", label: "Stuffed Peppers", sortOrder: 2 },
    { id: "bc-olives", category: "savoury", label: "Mixed Olives", sortOrder: 3 },
    { id: "bc-onions", category: "savoury", label: "Balsamic Onions", sortOrder: 4 },
    { id: "bc-crackers", category: "extra", label: "Crackers", sortOrder: 1 },
    { id: "bc-chutney", category: "extra", label: "Chutney / Jam", sortOrder: 2 },
  ];
  for (const c of boardComponents) {
    await prisma.boardComponent.upsert({ where: { id: c.id }, update: c, create: { ...c, active: true } });
  }

  // --- Experiences (bookable tastings) — PLACEHOLDER price/cost ---
  const experiences = [
    {
      id: "exp-cheese-tasting", name: "Cheese Tasting Evening", sortOrder: 1, active: true,
      description: "A guided evening through our finest local cheeses, with cobs, chutneys and a glass to match.",
      pricePerHead: 45, cost: 16, capacity: 12,
      imageUrl: "https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=800&q=60",
    },
  ];
  for (const e of experiences) {
    await prisma.experience.upsert({ where: { id: e.id }, update: e, create: e });
  }

  // --- Settings (global admin toggles) ---
  const defaultHours = JSON.stringify({
    mon: "9:00 - 17:00", tue: "9:00 - 17:00", wed: "9:00 - 17:00", thu: "9:00 - 17:00",
    fri: "9:00 - 17:00", sat: "9:00 - 16:00", sun: "Closed",
  });
  const settings = [
    { key: "firstOrderHook", value: "off" },
    { key: "firstOrderHookText", value: "FREE: box of sausage rolls" },
    { key: "tastingsComingSoon", value: "on" }, // not set up for bookings yet
    { key: "clickCollectComingSoon", value: "on" }, // click & collect isn't built yet
    { key: "openingHours", value: defaultHours }, // PLACEHOLDER — edit in Site Settings
    { key: "aboutText", value: "Proper food from the people you know — local produce, made fresh, the same way we've always done it." },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  // --- Users (staff + demo) ---
  const isProd = process.env.NODE_ENV === "production";
  const email = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";
  // Never seed a weak admin password in production.
  if (isProd && (password === "changeme123" || password.length < 10)) {
    throw new Error("Refusing to seed in production with a weak ADMIN_PASSWORD — set a strong ADMIN_PASSWORD env var (>= 10 chars).");
  }
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 10), role: "admin" },
    create: { email, passwordHash: await bcrypt.hash(password, 10), role: "admin" },
  });
  // Demo account is for local/staging only — never created in production.
  if (!isProd) {
    const demoHash = await bcrypt.hash("demo1234", 10);
    await prisma.user.upsert({
      where: { email: "demo@kellysdeli.co.uk" },
      update: { passwordHash: demoHash, role: "admin" },
      create: { email: "demo@kellysdeli.co.uk", passwordHash: demoHash, role: "admin" },
    });
  }

  // --- Demo customer (handy for re-order / SMS testing) ---
  await prisma.customer.upsert({
    where: { phone: "07700900123" },
    update: {},
    create: { name: "Demo Customer", phone: "07700900123", email: "demo@example.com", referralCode: randomReferralCode() },
  });

  console.log(`Seeded ${locations.length} locations, ${platters.length} platters, ${boardCount} board tiles, ${boardComponents.length} board components, ${experiences.length} experience(s), ${settings.length} settings, admin <${email}> + demo.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
