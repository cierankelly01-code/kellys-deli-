import "../src/lib/env"; // load server/.env so DATABASE_URL is available
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomReferralCode } from "../src/lib/ref";

const prisma = new PrismaClient();

// v2 catalogue (build spec §2/§3/§4). The owner deleted all old platters and curates the
// new catalogue in admin, so catalogue rows are CREATE-ONLY (update: {}) — a reseed fills
// gaps but never clobbers admin price/photo/feeds corrections. Descriptions carry a
// "[CHECK PRICE & DETAILS]" marker so the owner knows to review each row.
//
// The pre-v2 systems (sized boards, build-your-own configurator components/groups,
// home/events/seasonal catering platters, demo experience) are intentionally NOT seeded —
// the models remain for history but the customer UI is rebuilt around the boards below.

const CHECK = "[CHECK PRICE & DETAILS]";

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

  // --- v2 board catalogue: 5 signature + 4 gallery boards ---
  // Every board is a flat fixed-price item with a feeds range. items[] is a PLACEHOLDER
  // prep list the owner edits. cost is a placeholder (~40% of price) driving margin reporting.
  interface BoardSeed {
    id: string;
    tier: "signature" | "gallery";
    name: string;
    price: number;
    cost: number;
    feedsMin: number;
    feedsMax: number;
    priority: number; // recommender: higher = suggested first
    description: string;
    imageUrl: string;
    items: { label: string; qtyPerUnit: number }[];
  }

  const boards: BoardSeed[] = [
    // ---- Tier 1: Signature Boards (fast path, prominent on home) ----
    {
      id: "board-small-platter", tier: "signature", name: "Small Platter", price: 45, cost: 18,
      feedsMin: 4, feedsMax: 6, priority: 30,
      description: `A generous mixed platter for a small group — sandwiches, savouries and fresh bits. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1447279506476-3faec8071eee?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Gourmet sandwiches", qtyPerUnit: 12 },
        { label: "Sausage rolls", qtyPerUnit: 8 },
        { label: "Savoury selection", qtyPerUnit: 8 },
        { label: "Fresh fruit", qtyPerUnit: 1 },
      ],
    },
    {
      id: "board-medium-platter", tier: "signature", name: "Medium Platter", price: 70, cost: 28,
      feedsMin: 8, feedsMax: 10, priority: 90,
      description: `Our most popular spread — a proper mixed platter for the room. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Gourmet sandwiches", qtyPerUnit: 24 },
        { label: "Sausage rolls", qtyPerUnit: 16 },
        { label: "Savoury selection", qtyPerUnit: 16 },
        { label: "Fresh fruit", qtyPerUnit: 2 },
      ],
    },
    {
      id: "board-large-platter", tier: "signature", name: "Large Platter", price: 100, cost: 42,
      feedsMin: 12, feedsMax: 15, priority: 100,
      description: `The full spread for a bigger gathering — everything the table needs. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1672826979217-7156a305acf5?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Gourmet sandwiches", qtyPerUnit: 36 },
        { label: "Sausage rolls", qtyPerUnit: 24 },
        { label: "Savoury selection", qtyPerUnit: 24 },
        { label: "Fresh fruit", qtyPerUnit: 3 },
      ],
    },
    {
      id: "board-cheese", tier: "signature", name: "Cheese Board", price: 55, cost: 22,
      feedsMin: 8, feedsMax: 10, priority: 60,
      description: `A generous spread of local cheeses with grapes, olives and fresh fig. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1517093602195-b40af9688b46?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Selection of cheeses", qtyPerUnit: 1 },
        { label: "Grapes", qtyPerUnit: 1 },
        { label: "Mixed olives", qtyPerUnit: 1 },
        { label: "Crackers", qtyPerUnit: 1 },
      ],
    },
    {
      id: "board-charcuterie", tier: "signature", name: "Charcuterie Board", price: 60, cost: 24,
      feedsMin: 8, feedsMax: 10, priority: 70,
      description: `Local cheeses, cured meats, stuffed peppers, olives and chutney, with crackers. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1678572823447-45fc146df43c?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Cheeses", qtyPerUnit: 1 },
        { label: "Cured meats", qtyPerUnit: 1 },
        { label: "Stuffed peppers & olives", qtyPerUnit: 1 },
        { label: "Crackers & chutney", qtyPerUnit: 1 },
      ],
    },
    // ---- Tier 2: More Boards (browsable gallery) ----
    {
      id: "board-indian", tier: "gallery", name: "Indian Board", price: 65, cost: 26,
      feedsMin: 10, feedsMax: 12, priority: 80,
      description: `Samosas, pakoras, bhajis and dips — a warm-spiced sharing board. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Samosas", qtyPerUnit: 20 },
        { label: "Onion bhajis", qtyPerUnit: 16 },
        { label: "Pakoras", qtyPerUnit: 16 },
        { label: "Dips & chutneys", qtyPerUnit: 3 },
      ],
    },
    {
      id: "board-sandwich", tier: "gallery", name: "Sandwich Platter", price: 50, cost: 20,
      feedsMin: 8, feedsMax: 10, priority: 55,
      description: `A classic finger-sandwich platter on fresh local bread. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1554998171-89445e31c52b?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Assorted finger sandwiches", qtyPerUnit: 40 },
        { label: "Crisps", qtyPerUnit: 4 },
      ],
    },
    {
      id: "board-salmon", tier: "gallery", name: "Smoked Salmon Board", price: 70, cost: 30,
      feedsMin: 8, feedsMax: 10, priority: 50,
      description: `Smoked salmon with blinis and crostinis — simple, fresh and elegant. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1577906096429-f73c2c312435?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Smoked salmon", qtyPerUnit: 1 },
        { label: "Blinis", qtyPerUnit: 1 },
        { label: "Crostinis", qtyPerUnit: 1 },
      ],
    },
    {
      id: "board-breakfast", tier: "gallery", name: "Breakfast Board", price: 55, cost: 22,
      feedsMin: 6, feedsMax: 8, priority: 40,
      description: `Pastries, fruit, yoghurts and breakfast bites to start the day. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=70",
      items: [
        { label: "Pastries", qtyPerUnit: 12 },
        { label: "Fresh fruit", qtyPerUnit: 2 },
        { label: "Yoghurts", qtyPerUnit: 6 },
      ],
    },
  ];

  for (const b of boards) {
    const data = {
      category: "board",
      tier: b.tier,
      name: b.name,
      description: b.description,
      pricePerHead: null as number | null,
      fixedPrice: b.price,
      cost: b.cost,
      serves: `${b.feedsMin}-${b.feedsMax}`,
      feedsMin: b.feedsMin,
      feedsMax: b.feedsMax,
      minHeadcount: 1,
      items: b.items,
      imageUrl: b.imageUrl,
      active: true,
      sortOrder: boards.indexOf(b),
      recommendEligible: true,
      recommendPriority: b.priority,
    };
    // update: {} — create-only so admin corrections survive a reseed.
    await prisma.platter.upsert({ where: { id: b.id }, update: {}, create: { id: b.id, ...data } });
  }

  // --- Add-ons (upsell engine, build spec §3) — PLACEHOLDER prices, owner corrects in admin ---
  interface AddOnSeed {
    id: string;
    name: string;
    price: number;
    unitType: "per_person" | "per_order" | "serves";
    unitLabel: string;
    servesPerUnit?: number;
    suggestFromHeadcount: boolean;
    imageUrl?: string;
  }
  const addOns: AddOnSeed[] = [
    { id: "addon-cutlery", name: "Disposable bamboo cutlery set", price: 1.5, unitType: "per_person", unitLabel: "per person", suggestFromHeadcount: true },
    { id: "addon-plates", name: "Palm-leaf plates", price: 1.5, unitType: "per_person", unitLabel: "per person", suggestFromHeadcount: true },
    { id: "addon-napkins", name: "Napkins pack", price: 3, unitType: "serves", unitLabel: "serves 10", servesPerUnit: 10, suggestFromHeadcount: true },
    { id: "addon-drinks", name: "Sparkling elderflower / soft drinks bottle", price: 4.5, unitType: "per_order", unitLabel: "per bottle", suggestFromHeadcount: false },
    { id: "addon-dips", name: "Extra dips & crackers top-up", price: 8, unitType: "per_order", unitLabel: "per top-up", suggestFromHeadcount: false },
    { id: "addon-sweets", name: "Chocolate & sweet treats add-on board", price: 25, unitType: "per_order", unitLabel: "per board", suggestFromHeadcount: false },
    { id: "addon-setup", name: "Setup & presentation at collection", price: 10, unitType: "per_order", unitLabel: "boards arranged, ready to serve", suggestFromHeadcount: false },
  ];
  for (let i = 0; i < addOns.length; i++) {
    const a = addOns[i];
    const data = {
      name: a.name,
      description: `Placeholder price — ${CHECK}`,
      price: a.price,
      unitType: a.unitType,
      unitLabel: a.unitLabel,
      servesPerUnit: a.servesPerUnit ?? null,
      suggestFromHeadcount: a.suggestFromHeadcount,
      imageUrl: a.imageUrl ?? null,
      active: true,
      sortOrder: i,
    };
    // create-only so admin edits survive a reseed.
    await prisma.addOn.upsert({ where: { id: a.id }, update: {}, create: { id: a.id, ...data } });
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
    { key: "aboutText", value: "Proper food from the people you know — grazing boards for collection, made fresh." },
    { key: "heroImageUrl", value: "https://images.unsplash.com/photo-1695606392727-d8b959879721?auto=format&fit=crop&w=1400&q=70" },
    { key: "missionTagline", value: "The deli your grandparents would recognise — local produce, no shortcuts, boards built the same way every time." },
    { key: "founderNote", value: "We've been doing this the same way for years — proper local produce, boards built by hand, nothing rushed. Every order that goes out the door is one we'd be happy to serve our own family." },
    { key: "reviewRating", value: "4.7" }, // real, from Google — update in Site Settings as reviews come in
    { key: "reviewCount", value: "47" },
    // v2: collection lead time in hours (protects the kitchen). Admin-editable in Site Settings.
    { key: "orderLeadTimeHours", value: "48" },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  // --- Users (staff) ---
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
  // No demo account. Local dev shares the production database, so a "dev-only"
  // account here would be a real admin on the live site.
  await prisma.user.deleteMany({ where: { email: "demo@kellysdeli.co.uk" } });

  // --- Demo customer (handy for re-order / SMS testing) ---
  await prisma.customer.upsert({
    where: { phone: "07700900123" },
    update: {},
    create: { name: "Demo Customer", phone: "07700900123", email: "demo@example.com", referralCode: randomReferralCode() },
  });

  console.log(`Seeded ${locations.length} locations, ${boards.length} boards, ${addOns.length} add-ons, ${settings.length} settings, admin <${email}>.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
