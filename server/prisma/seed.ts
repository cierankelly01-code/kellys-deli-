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
    // Sizes & options: boards sharing a group show as ONE tile, size chosen on the product page.
    variantGroup?: string;
    variantLabel?: string;
    variantOrder?: number;
  }

  // The three plain platters are one product in three sizes, not three products — grouping
  // them means the shop shows a single tile and the customer picks the size on the page.
  const PLATTER_SIZES = "board-large-platter";

  const boards: BoardSeed[] = [
    // ---- Tier 1: Signature Boards (fast path, prominent on home) ----
    {
      id: "board-small-platter", tier: "signature", variantGroup: PLATTER_SIZES, variantLabel: "Small — feeds 4-6", variantOrder: 2, name: "Small Platter", price: 45, cost: 18,
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
      id: "board-medium-platter", tier: "signature", variantGroup: PLATTER_SIZES, variantLabel: "Medium — feeds 8-10", variantOrder: 1, name: "Medium Platter", price: 70, cost: 28,
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
      id: "board-large-platter", tier: "signature", variantGroup: PLATTER_SIZES, variantLabel: "Large — feeds 12-15", variantOrder: 0, name: "Large Platter", price: 100, cost: 42,
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
      variantGroup: b.variantGroup ?? null,
      variantLabel: b.variantLabel ?? null,
      variantOrder: b.variantOrder ?? 0,
    };
    // update: {} — create-only so admin corrections survive a reseed.
    await prisma.platter.upsert({ where: { id: b.id }, update: {}, create: { id: b.id, ...data } });
  }

  // --- "At Home" personality boards (smaller, occasion-named). Real orderable boards
  // (category "board", gallery tier) whose curated home is the At Home category page.
  // Not recommender-eligible (they're intimate, not crowd-feeders). Owner renames/prices
  // in admin — create-only so those edits survive a reseed. ---
  interface AtHomeSeed {
    id: string;
    name: string;
    price: number;
    cost: number;
    feedsMin: number;
    feedsMax: number;
    description: string;
    imageUrl: string;
    items: { label: string; qtyPerUnit: number }[];
  }
  const atHomeBoards: AtHomeSeed[] = [
    {
      id: "board-date-night", name: "The Date Night", price: 28, cost: 11, feedsMin: 2, feedsMax: 2,
      description: `Cheese, charcuterie and all the nice little extras for two — dim the lights, we did the shopping. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=900&q=70",
      items: [{ label: "Cheese selection", qtyPerUnit: 1 }, { label: "Cured meats", qtyPerUnit: 1 }, { label: "Crackers, olives & chutney", qtyPerUnit: 1 }, { label: "Fresh fruit & nibbles", qtyPerUnit: 1 }],
    },
    {
      id: "board-too-hot-to-cook", name: "The Too Hot to Cook", price: 32, cost: 13, feedsMin: 2, feedsMax: 3,
      description: `Everything cold, everything sorted. When it's too warm to face the hob, dinner's a board. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?auto=format&fit=crop&w=900&q=70",
      items: [{ label: "Cold cuts & cheese", qtyPerUnit: 1 }, { label: "Fresh bread & crackers", qtyPerUnit: 1 }, { label: "Salad bits & pickles", qtyPerUnit: 1 }, { label: "Fruit", qtyPerUnit: 1 }],
    },
    {
      id: "board-sunday-graze", name: "The Sunday Graze", price: 38, cost: 15, feedsMin: 3, feedsMax: 4,
      description: `A lazy Sunday spread to pick at all afternoon — no cooking, no washing up. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=70",
      items: [{ label: "Cheeses & meats", qtyPerUnit: 1 }, { label: "Savoury pastries", qtyPerUnit: 1 }, { label: "Dips & crackers", qtyPerUnit: 1 }, { label: "Fresh fruit", qtyPerUnit: 1 }],
    },
    {
      id: "board-movie-night", name: "The Movie Night", price: 26, cost: 10, feedsMin: 2, feedsMax: 4,
      description: `Sweet and savoury nibbles built for the sofa — press play, we've got the snacks. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1499195333224-3ce974eecb47?auto=format&fit=crop&w=900&q=70",
      items: [{ label: "Savoury snacks", qtyPerUnit: 1 }, { label: "Sweet treats", qtyPerUnit: 1 }, { label: "Popcorn & crisps", qtyPerUnit: 1 }, { label: "Chocolate", qtyPerUnit: 1 }],
    },
    {
      id: "board-just-because", name: "The Just Because", price: 30, cost: 12, feedsMin: 2, feedsMax: 3,
      description: `No occasion needed. A proper little treat board for a normal Tuesday. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1526234362653-3b75a0c07438?auto=format&fit=crop&w=900&q=70",
      items: [{ label: "Cheese & charcuterie", qtyPerUnit: 1 }, { label: "Crackers & chutney", qtyPerUnit: 1 }, { label: "Olives & nibbles", qtyPerUnit: 1 }, { label: "Fruit", qtyPerUnit: 1 }],
    },
    {
      id: "board-payday-treat", name: "The Payday Treat", price: 35, cost: 14, feedsMin: 2, feedsMax: 3,
      description: `You've earned it. A step-up board of the good stuff to mark the month. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1464195244916-405fa0a82545?auto=format&fit=crop&w=900&q=70",
      items: [{ label: "Premium cheeses", qtyPerUnit: 1 }, { label: "Charcuterie", qtyPerUnit: 1 }, { label: "Antipasti & dips", qtyPerUnit: 1 }, { label: "Fresh fruit", qtyPerUnit: 1 }],
    },
    {
      id: "board-new-neighbours", name: "The New Neighbours", price: 30, cost: 12, feedsMin: 2, feedsMax: 4,
      description: `A warm welcome on a board — the kind thing to leave on a new doorstep. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=900&q=70",
      items: [{ label: "Cheese & crackers", qtyPerUnit: 1 }, { label: "Savoury selection", qtyPerUnit: 1 }, { label: "Sweet treats", qtyPerUnit: 1 }, { label: "Fruit", qtyPerUnit: 1 }],
    },
    {
      id: "board-duvet-day", name: "The Duvet Day", price: 24, cost: 9, feedsMin: 1, feedsMax: 2,
      description: `Comfort food on a board for a slow day in — everything nice, nothing that needs the oven. ${CHECK}`,
      imageUrl: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=900&q=70",
      items: [{ label: "Comfort nibbles", qtyPerUnit: 1 }, { label: "Fresh bread & cheese", qtyPerUnit: 1 }, { label: "Sweet treats", qtyPerUnit: 1 }, { label: "Fruit", qtyPerUnit: 1 }],
    },
  ];
  for (let i = 0; i < atHomeBoards.length; i++) {
    const b = atHomeBoards[i];
    const data = {
      category: "board",
      tier: "gallery" as const,
      name: b.name,
      description: b.description,
      pricePerHead: null as number | null,
      fixedPrice: b.price,
      cost: b.cost,
      serves: b.feedsMin === b.feedsMax ? `${b.feedsMin}` : `${b.feedsMin}-${b.feedsMax}`,
      feedsMin: b.feedsMin,
      feedsMax: b.feedsMax,
      minHeadcount: 1,
      items: b.items,
      imageUrl: b.imageUrl,
      active: true,
      sortOrder: 100 + i, // after the catering gallery boards
      recommendEligible: false,
      recommendPriority: 0,
    };
    await prisma.platter.upsert({ where: { id: b.id }, update: {}, create: { id: b.id, ...data } });
  }

  // --- 2026-09 catalogue restructure: new boards, pots & dips, desserts, office sandwiches.
  // Seeded INACTIVE with no price/description/photo — never invent customer-facing price or
  // copy. The owner adds a real photo, description and price in admin (Menu & Pricing) and
  // flips each one active, exactly like every other draft product on this site. `cost` is a
  // placeholder for margin reporting only. create-only so admin edits survive a reseed.
  interface DraftPlatterSeed {
    id: string;
    category: "board" | "pot" | "dessert" | "sandwich";
    name: string;
    variantGroup?: string;
    variantLabel?: string;
    variantOrder?: number;
  }
  const draftPlatters: DraftPlatterSeed[] = [
    // Boards — Small/Large pairs share a variantGroup (one shop tile, size picked on the
    // product page), same pattern as the existing signature platters.
    { id: "board-antipasti-small", category: "board", name: "Antipasti Board", variantGroup: "board-antipasti", variantLabel: "Small", variantOrder: 1 },
    { id: "board-antipasti-large", category: "board", name: "Antipasti Board", variantGroup: "board-antipasti", variantLabel: "Large", variantOrder: 0 },
    { id: "board-ploughmans-small", category: "board", name: "Ploughman's Board", variantGroup: "board-ploughmans", variantLabel: "Small", variantOrder: 1 },
    { id: "board-ploughmans-large", category: "board", name: "Ploughman's Board", variantGroup: "board-ploughmans", variantLabel: "Large", variantOrder: 0 },
    { id: "board-mezze-small", category: "board", name: "Mezze & Dips Board", variantGroup: "board-mezze", variantLabel: "Small", variantOrder: 1 },
    { id: "board-mezze-large", category: "board", name: "Mezze & Dips Board", variantGroup: "board-mezze", variantLabel: "Large", variantOrder: 0 },
    { id: "board-loaded-crisps-ploughmans", category: "board", name: "Loaded Crisps — Ploughman's" },
    { id: "board-loaded-crisps-second", category: "board", name: "Loaded Crisps — Second Flavour" }, // owner renames to the real second flavour
    { id: "board-ultimate", category: "board", name: "The Ultimate Board" },
    { id: "board-grazing-table", category: "board", name: "Grazing Table" }, // large/enquiry-scale — price with the owner before activating
    // Pots & dips — single size each.
    { id: "pot-hummus", category: "pot", name: "Hummus" },
    { id: "pot-tzatziki", category: "pot", name: "Tzatziki" },
    { id: "pot-sour-cream-chive", category: "pot", name: "Sour Cream & Chive" },
    { id: "pot-coleslaw", category: "pot", name: "Coleslaw" },
    { id: "pot-potato-salad", category: "pot", name: "Potato Salad" },
    { id: "pot-three-bean-salad", category: "pot", name: "Three-Bean Salad" },
    { id: "pot-olives", category: "pot", name: "Olives" },
    { id: "pot-cornichons", category: "pot", name: "Cornichons" },
    { id: "pot-sun-dried-tomatoes", category: "pot", name: "Sun-Dried Tomatoes" },
    { id: "pot-smoked-salmon", category: "pot", name: "Smoked Salmon" },
    // Desserts
    { id: "dessert-brownie-board", category: "dessert", name: "Brownie Board" },
    { id: "dessert-mini-selection", category: "dessert", name: "Mini Dessert Selection" },
    { id: "dessert-cheesecake-pots", category: "dessert", name: "Cheesecake Pots" },
    { id: "dessert-fruit-platter", category: "dessert", name: "Fruit Platter" },
    { id: "dessert-chocolate-dipping", category: "dessert", name: "Chocolate Dipping Board" },
    { id: "dessert-cake-slice-selection", category: "dessert", name: "Cake Slice Selection" },
    // Office
    { id: "office-working-lunch-box", category: "sandwich", name: "Working Lunch Box" },
    { id: "office-boxed-lunch-bulk", category: "sandwich", name: "Boxed Lunch — Bulk" }, // enquiry-scale — price with the owner before activating
  ];
  for (let i = 0; i < draftPlatters.length; i++) {
    const d = draftPlatters[i];
    const data = {
      category: d.category,
      tier: d.category === "board" ? ("gallery" as const) : null,
      name: d.name,
      description: "",
      pricePerHead: null as number | null,
      fixedPrice: null as number | null,
      cost: 0,
      serves: null as string | null,
      minHeadcount: 1,
      items: [] as { label: string; qtyPerUnit: number }[],
      imageUrl: null as string | null,
      active: false,
      sortOrder: 200 + i,
      recommendEligible: false,
      recommendPriority: 0,
      variantGroup: d.variantGroup ?? null,
      variantLabel: d.variantLabel ?? null,
      variantOrder: d.variantOrder ?? 0,
    };
    // create-only so admin edits (and the eventual active:true flip) survive a reseed.
    await prisma.platter.upsert({ where: { id: d.id }, update: {}, create: { id: d.id, ...data } });
  }

  // --- Occasion categories (browse-by-occasion storefront). Admin renames / reassigns;
  // create-only upsert so those edits survive a reseed. Board assignments below are also
  // create-only. ---
  interface CategorySeed {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    description: string;
    heroImageUrl: string;
    seoTitle: string;
    seoDescription: string;
    isCorporate?: boolean;
    promotePlanner?: boolean;
    active?: boolean; // default true — set false for a shell page with nothing to show yet
    boardIds: string[];
  }
  const categories: CategorySeed[] = [
    {
      id: "cat-hosting", slug: "hosting", name: "Hosting",
      tagline: "Feeding a crowd? Start here.",
      description: "Boards and platters built to feed a room — 10 people and up. Pick a size, add the extras, and we'll have it ready to collect. Not sure how much you need? Plan your event and we'll suggest the spread.",
      heroImageUrl: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1400&q=70",
      seoTitle: "Party & Event Catering Boards, Solihull — Kelly's Deli",
      seoDescription: "Grazing boards and catering platters for parties and events in Solihull. Feeds 10+, made fresh for collection, 25% deposit. Tell us your numbers and we'll plan the spread.",
      promotePlanner: true,
      boardIds: [
        "board-medium-platter", "board-large-platter", "board-small-platter", "board-sandwich", "board-indian", "board-charcuterie",
        "board-antipasti-small", "board-antipasti-large", "board-mezze-small", "board-mezze-large", "board-ultimate", "board-grazing-table",
        "pot-hummus", "pot-tzatziki", "pot-sour-cream-chive", "pot-coleslaw", "pot-potato-salad", "pot-three-bean-salad", "pot-olives", "pot-cornichons", "pot-sun-dried-tomatoes", "pot-smoked-salmon",
        "dessert-brownie-board", "dessert-mini-selection", "dessert-cheesecake-pots", "dessert-fruit-platter", "dessert-chocolate-dipping", "dessert-cake-slice-selection",
      ],
    },
    {
      id: "cat-at-home", slug: "at-home", name: "At Home",
      tagline: "Smaller boards for a night in.",
      description: "Proper little boards for two, three or four — date nights, lazy Sundays, or just because it's Tuesday. No cooking, no washing up, all the good bits.",
      heroImageUrl: "https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=1400&q=70",
      seoTitle: "Date Night & Grazing Boards for Two, Solihull — Kelly's Deli",
      seoDescription: "Small grazing boards for a night in — date nights, movie nights, Sunday grazing. Made fresh in Bentley Heath for collection. Feeds two to four.",
      boardIds: [
        "board-date-night", "board-too-hot-to-cook", "board-sunday-graze", "board-movie-night", "board-just-because", "board-payday-treat", "board-new-neighbours", "board-duvet-day", "board-cheese", "board-charcuterie", "board-salmon",
        "board-antipasti-small", "board-antipasti-large", "board-ploughmans-small", "board-ploughmans-large", "board-mezze-small", "board-mezze-large", "board-loaded-crisps-ploughmans", "board-loaded-crisps-second",
        "pot-hummus", "pot-tzatziki", "pot-sour-cream-chive", "pot-coleslaw", "pot-potato-salad", "pot-three-bean-salad", "pot-olives", "pot-cornichons", "pot-sun-dried-tomatoes", "pot-smoked-salmon",
        "dessert-brownie-board", "dessert-mini-selection", "dessert-cheesecake-pots", "dessert-fruit-platter", "dessert-chocolate-dipping", "dessert-cake-slice-selection",
      ],
    },
    {
      id: "cat-office", slug: "office-corporate", name: "Office & Corporate",
      tagline: "Platters for the workplace.",
      description: "Feed the meeting or set up a standing platter for the office. One-off orders or a regular weekly or monthly delivery — tell us your numbers and how often, and we'll confirm a schedule that suits you.",
      heroImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=70",
      seoTitle: "Office Catering & Corporate Platters, Solihull — Kelly's Deli",
      seoDescription: "Office catering and corporate platters in Solihull. One-off meeting orders or a standing weekly/monthly office platter — delivery available for regular orders, we'll confirm your schedule.",
      isCorporate: true,
      boardIds: [
        "board-sandwich", "board-breakfast", "board-medium-platter", "board-large-platter", "board-small-platter", "board-grazing-table",
        "office-working-lunch-box", "office-boxed-lunch-bulk",
        "pot-hummus", "pot-tzatziki", "pot-sour-cream-chive", "pot-coleslaw", "pot-potato-salad", "pot-three-bean-salad", "pot-olives", "pot-cornichons", "pot-sun-dried-tomatoes", "pot-smoked-salmon",
        "dessert-brownie-board", "dessert-mini-selection", "dessert-cheesecake-pots", "dessert-fruit-platter", "dessert-chocolate-dipping", "dessert-cake-slice-selection",
      ],
    },
    {
      // No canapé products exist yet to assign — the prior catalogue prompt assumed a
      // canapés section that was never built. Shell only, left INACTIVE so an empty page
      // never goes live; the owner activates it once canapé products are seeded.
      id: "cat-canapes", slug: "canapes", name: "Canapés",
      tagline: "Bite-sized catering for a standing crowd.",
      description: "Canapé menus for events and receptions — coming soon.",
      heroImageUrl: "https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=1400&q=70",
      seoTitle: "Canapés, Solihull — Kelly's Deli",
      seoDescription: "Canapé catering for events in Solihull — coming soon.",
      active: false,
      boardIds: [],
    },
  ];
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    // Upsert by slug, not id: slug is the real unique business key (URL + SEO), and a
    // category can already exist with a different id than this file's fixture id — e.g.
    // created through admin before this row was added here, or by an earlier seed run
    // that predates fixed ids. Upserting by id in that case would try to CREATE a second
    // row and fail on the slug's unique constraint instead of finding the existing one.
    const saved = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        id: c.id, slug: c.slug, name: c.name, tagline: c.tagline, description: c.description,
        heroImageUrl: c.heroImageUrl, seoTitle: c.seoTitle, seoDescription: c.seoDescription,
        isCorporate: c.isCorporate ?? false, promotePlanner: c.promotePlanner ?? false,
        active: c.active ?? true, sortOrder: i,
      },
    });
    // Assign boards (create-only per pair so admin reassignments survive a reseed).
    // Use the row's real id (saved.id), not c.id — they can differ, see above.
    for (let j = 0; j < c.boardIds.length; j++) {
      const platterId = c.boardIds[j];
      await prisma.platterCategory.upsert({
        where: { categoryId_platterId: { categoryId: saved.id, platterId } },
        update: {},
        create: { categoryId: saved.id, platterId, sortOrder: j },
      });
    }
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
    // Subscribe & Save (recurring boards). Payment-ready, not payment-live — the owner
    // sets each schedule up manually until Stripe lands. Discount is a whole-number %.
    { key: "subscribeSave", value: "on" },
    { key: "subscribeSaveDiscountPct", value: "10" },
    // Corporate next-day delivery: OFF until the owner confirms next-day capability. While
    // off, corporate copy says "delivery available for regular orders — we'll confirm your
    // schedule" rather than promising next-working-day.
    { key: "corporateNextDayDelivery", value: "off" },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  // --- Bread pre-ordering (sensible defaults; all editable in /admin/bread/settings) ---
  // Bread catalogue (2026-09 restructure). Seeded INACTIVE, price 0 placeholder, no
  // description/photo — never invent a customer-facing price. The owner sets a real price,
  // description and photo in admin (Bread Settings) and flips each item active. Available
  // at every shop by default; the owner narrows that per-shop in admin if needed.
  const breadProducts = [
    { id: "bread-crusty-cobs", name: "Crusty Cobs" },
    { id: "bread-bloomer", name: "Bloomer" },
    { id: "bread-sourdough", name: "Sourdough" },
    { id: "bread-seeded-loaf", name: "Seeded Loaf" },
    { id: "bread-baguette", name: "Baguette" },
    { id: "bread-rolls", name: "Bread Rolls" },
  ];
  // Guarded: the bread tables ship via their own migrations (bread_preordering,
  // bread_shop_notify_email), which may not be deployed everywhere the rest of this
  // catalogue is seeded from. Skip cleanly rather than crash the whole seed run when
  // they're not there yet — a reseed later picks this section up once they are.
  const breadTablesReady = await prisma.$queryRaw<{ ready: boolean }[]>`SELECT to_regclass('public."BreadProduct"') IS NOT NULL AS ready`;
  if (!breadTablesReady[0]?.ready) {
    console.log("Skipping bread catalogue seed — BreadProduct table not found (pending migration).");
  } else {
    await prisma.breadSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" }, // leadTimeHours 48, cutoffMode "rolling", minOrderQty 1, maxItemQty 20
    });
    for (const loc of locations) {
      await prisma.breadShopSetting.upsert({
        where: { locationId: loc.id },
        update: {},
        create: { locationId: loc.id, dailyCapacity: null, closedWeekdays: [] }, // unlimited, no recurring closures
      });
    }
    for (let i = 0; i < breadProducts.length; i++) {
      const b = breadProducts[i];
      await prisma.breadProduct.upsert({
        where: { id: b.id },
        update: {},
        create: { id: b.id, name: b.name, description: null, price: 0, active: false, sortOrder: i },
      });
      for (const loc of locations) {
        await prisma.breadProductLocation.upsert({
          where: { productId_locationId: { productId: b.id, locationId: loc.id } },
          update: {},
          create: { productId: b.id, locationId: loc.id },
        });
      }
    }
  }

  // --- Users (staff) ---
  const target = process.env.DATABASE_URL ?? "";
  // Gate on the DATABASE we're pointed at, NOT on NODE_ENV. A dev shell routinely
  // runs with NODE_ENV unset while its DATABASE_URL points at the live Supabase DB
  // (local dev shares the production database), so a NODE_ENV-only check never fires
  // where it matters. Treat a hosted Postgres (Supabase / a connection pooler) as prod.
  const looksProd = process.env.NODE_ENV === "production" || /supabase\.com|pooler\./i.test(target);
  const email = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";
  // Never seed a weak admin password against a production database.
  if (looksProd && (password === "changeme123" || password.length < 10)) {
    throw new Error("Refusing to seed against a production database with a weak ADMIN_PASSWORD — set a strong ADMIN_PASSWORD env var (>= 10 chars).");
  }
  // Create-only: a reseed must NEVER overwrite an already-rotated admin password.
  // Password rotation has its own dedicated path (scripts/rotate-admin.ts).
  await prisma.user.upsert({
    where: { email },
    update: {},
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

  console.log(`Seeded ${locations.length} locations, ${boards.length + atHomeBoards.length + draftPlatters.length} boards/pots/desserts/sandwiches (${draftPlatters.length} draft, inactive), ${categories.length} categories, ${addOns.length} add-ons, ${breadProducts.length} bread products (draft, inactive), ${settings.length} settings, admin <${email}>.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
