import { asyncRouter } from "../lib/async-router";
import { prisma } from "../lib/prisma";
import {
  createOrderSchema,
  createBookingSchema,
  availabilityQuerySchema,
  experienceAvailabilityQuerySchema,
  recommendQuerySchema,
  corporateEnquirySchema,
  reminderSchema,
  giftVoucherSchema,
} from "../lib/validation";
import { priceOrder, priceLineItemOrder, REFERRAL_DISCOUNT } from "../lib/money";
import { buildAvailability, canBook, getDayAvailability, meetsNotice, meetsLeadTime, parseDate, formatDate } from "../lib/capacity";
import { recommendBoards, capacity as boardCapacity, type RecBoard } from "../lib/recommender";
import { genRef, randomReferralCode } from "../lib/ref";
import { captureDepositIntent } from "../lib/payments";
import { notifyOrderReceived } from "../lib/notify";
import { platterDTO, experienceDTO, locationDTO, orderDTO, publicOrderDTO, boardComponentDTO, boardGroupDTO, addOnDTO, categoryDTO, bundleDTO } from "../lib/serialize";

export const publicRouter = asyncRouter();

class CapacityError extends Error {}

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}

/** Configured collection lead time in hours (Setting "orderLeadTimeHours"), default 48. */
async function getLeadHours(): Promise<number> {
  const raw = await getSetting("orderLeadTimeHours");
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 48;
}

// Generate a unique order ref within a transaction. Always returns a value that
// passed the existence check (never a final unchecked candidate).
async function uniqueRef(tx: { order: { findUnique: (a: any) => Promise<unknown> } }): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const ref = genRef();
    if (!(await tx.order.findUnique({ where: { ref } }))) return ref;
  }
  throw new Error("Could not generate a unique order reference");
}

// Same pattern for a customer's shareable referral code (also @unique).
async function uniqueReferralCode(tx: { customer: { findUnique: (a: any) => Promise<unknown> } }): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = randomReferralCode();
    if (!(await tx.customer.findUnique({ where: { referralCode: code } }))) return code;
  }
  throw new Error("Could not generate a unique referral code");
}

// --- Menu ---
publicRouter.get("/platters", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const tier = typeof req.query.tier === "string" ? req.query.tier : undefined;
  const platters = await prisma.platter.findMany({
    where: { active: true, ...(category ? { category } : {}), ...(tier ? { tier } : {}) },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(platters.map((p) => platterDTO(p)));
});

// --- Add-ons (upsell items shown in every order flow) ---
publicRouter.get("/add-ons", async (_req, res) => {
  const rows = await prisma.addOn.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(rows.map(addOnDTO));
});

// --- "Plan My Event" recommender: a board combination for a headcount ---
publicRouter.get("/recommend", async (req, res) => {
  const parsed = recommendQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid headcount" });
  const headcount = parsed.data.headcount;

  const boards = await prisma.platter.findMany({
    where: { active: true, category: "board", recommendEligible: true, feedsMin: { not: null }, feedsMax: { not: null } },
  });
  const recBoards: RecBoard[] = boards.map((b) => ({
    id: b.id,
    feedsMin: b.feedsMin ?? 0,
    feedsMax: b.feedsMax ?? 0,
    priority: b.recommendPriority,
    price: b.fixedPrice ? Number(b.fixedPrice) : 0,
  }));
  const lines = recommendBoards(recBoards, headcount);
  const byId = new Map(boards.map((b) => [b.id, b]));

  const items = lines.map((l) => {
    const b = byId.get(l.boardId)!;
    return {
      boardId: l.boardId,
      qty: l.qty,
      board: platterDTO(b),
      // Coverage is judged by the top of the printed range — the same number shown
      // on the board card — so the quote never pads against its own label.
      feedsEach: boardCapacity({ feedsMin: b.feedsMin ?? 0, feedsMax: b.feedsMax ?? 0 }),
    };
  });
  const totalFeeds = items.reduce((s, i) => s + i.feedsEach * i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + (i.board.fixedPrice ?? 0) * i.qty, 0);
  res.json({ headcount, items, totalFeeds, totalPrice, undercatered: totalFeeds < headcount });
});

publicRouter.get("/platters/:id", async (req, res) => {
  const platter = await prisma.platter.findUnique({ where: { id: req.params.id } });
  if (!platter || !platter.active) return res.status(404).json({ error: "Platter not found" });
  res.json(platterDTO(platter));
});

publicRouter.get("/experiences", async (_req, res) => {
  const experiences = await prisma.experience.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(experiences.map((e) => experienceDTO(e)));
});

publicRouter.get("/locations", async (_req, res) => {
  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  res.json(locations.map(locationDTO));
});

// Build-your-own board ingredients, grouped by category.
publicRouter.get("/board-components", async (_req, res) => {
  const rows = await prisma.boardComponent.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(rows.map(boardComponentDTO));
});

// Configurator groups with their options nested — rules (headings, limits, free allowance)
// plus each option's price/isDefault. The configurator UI is driven entirely by this.
publicRouter.get("/board-config", async (_req, res) => {
  const [groups, components] = await Promise.all([
    prisma.boardComponentGroup.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.boardComponent.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  res.json({
    groups: groups.map((g) => boardGroupDTO(g, components.filter((c) => c.category === g.key))),
  });
});

// Which categories should the choice screen show? (those with ≥1 active platter)
publicRouter.get("/categories", async (_req, res) => {
  const rows = await prisma.platter.groupBy({
    by: ["category"],
    where: { active: true },
    _count: true,
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.category] = r._count as unknown as number;
  const experiences = await prisma.experience.count({ where: { active: true } });
  res.json({
    home: counts.home ?? 0,
    events: counts.events ?? 0,
    seasonal: counts.seasonal ?? 0,
    platters: counts.platters ?? 0,
    experiences,
    // Tastings show as "coming soon" (not bookable) unless explicitly switched on.
    tastingsComingSoon: (await getSetting("tastingsComingSoon")) !== "off",
    // Click & Collect isn't built yet — always "coming soon" until a real toggle is added.
    clickCollectComingSoon: (await getSetting("clickCollectComingSoon")) !== "off",
    openingHours: (await getSetting("openingHours")) ?? null,
    aboutText: (await getSetting("aboutText")) ?? null,
    heroImageUrl: (await getSetting("heroImageUrl")) ?? null,
    missionTagline: (await getSetting("missionTagline")) ?? null,
    founderNote: (await getSetting("founderNote")) ?? null,
    reviewRating: (await getSetting("reviewRating")) ?? null,
    reviewCount: (await getSetting("reviewCount")) ?? null,
    // First-order incentive — surfaced up front on the storefront to win the order.
    // Actual eligibility (prior-order check) is still enforced server-side at checkout.
    firstOrderHook: (await getSetting("firstOrderHook")) === "on",
    firstOrderHookText: (await getSetting("firstOrderHookText")) ?? null,
    // Subscribe & Save (recurring boards) — drives the storefront picker + discount copy.
    subscribeSave: (await getSetting("subscribeSave")) !== "off",
    subscribeSaveDiscountPct: parseInt((await getSetting("subscribeSaveDiscountPct")) ?? "10", 10) || 10,
    // Corporate next-day delivery — OFF until the owner confirms capability (honesty rule).
    corporateNextDayDelivery: (await getSetting("corporateNextDayDelivery")) === "on",
    // "Spend £X, get a free treat" — a gift added to the order at no charge (recorded as a
    // freebie the owner includes). OFF until configured, so we never promise a gift by surprise.
    freeGift: (await getSetting("freeGift")) === "on",
    freeGiftThreshold: parseFloat((await getSetting("freeGiftThreshold")) ?? "0") || 0,
    freeGiftText: (await getSetting("freeGiftText")) ?? null,
  });
});

// Public tracking configuration. Returns the marketing-pixel / analytics IDs the owner
// has set in admin (Site Settings). These IDs are not secret — they are designed to be
// exposed to the browser — but the client still fires nothing until the visitor consents
// (see client/src/lib/consent.ts). Empty string settings collapse to null so the client
// can treat "unset" and "blank" identically.
publicRouter.get("/tracking", async (_req, res) => {
  const keys = ["metaPixelId", "tiktokPixelId", "ga4Id", "cloudflareToken"];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
  res.setHeader("Cache-Control", "public, max-age=60"); // IDs change rarely and are non-secret
  res.json({
    metaPixelId: clean(map.get("metaPixelId")),
    tiktokPixelId: clean(map.get("tiktokPixelId")),
    ga4Id: clean(map.get("ga4Id")),
    cloudflareToken: clean(map.get("cloudflareToken")),
  });
});

// --- Occasion categories (browse-by-occasion storefront) ---
// Named /categories/browse (not /categories) so the existing /categories counts endpoint
// above keeps working. Returns active categories with a live board count.
publicRouter.get("/categories/browse", async (_req, res) => {
  const cats = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { platters: true } } },
  });
  res.json(cats.map((c) => categoryDTO(c, { boardCount: c._count.platters })));
});

// One category + its assigned, active boards (in assignment order) for the landing page.
publicRouter.get("/categories/:slug", async (req, res) => {
  const cat = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    include: { platters: { include: { platter: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!cat || !cat.active) return res.status(404).json({ error: "Category not found" });
  // Drop inactive boards; keep assignment order.
  const activePlatters = cat.platters.filter((pc) => pc.platter.active);
  res.json(categoryDTO({ ...cat, platters: activePlatters }));
});

// --- Corporate / office enquiry (lands in admin) ---
publicRouter.post("/corporate-enquiry", async (req, res) => {
  const parsed = corporateEnquirySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid enquiry" });
  const d = parsed.data;
  await prisma.corporateEnquiry.create({
    data: {
      company: d.company,
      contactName: d.contactName,
      email: d.email,
      phone: d.phone ?? null,
      headcount: d.headcount ?? null,
      frequency: d.frequency ?? null,
      message: d.message ?? null,
    },
  });
  res.status(201).json({ ok: true });
});

// --- "Never miss it" occasion reminder capture ---
publicRouter.post("/reminders", async (req, res) => {
  const parsed = reminderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid reminder" });
  const d = parsed.data;
  await prisma.reminderSignup.create({
    data: {
      email: d.email,
      occasion: d.occasion,
      reminderDate: d.reminderDate ? parseDate(d.reminderDate) : null,
    },
  });
  res.status(201).json({ ok: true });
});

// --- Bundles (curated one-tap combos) ---
// Priced at the live total of the real components. A bundle is only shown if EVERY item
// still resolves to an active board/add-on, so the displayed price is never misleading.
publicRouter.get("/bundles", async (_req, res) => {
  const bundles = await prisma.bundle.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { items: true },
  });
  const boardIds = [...new Set(bundles.flatMap((b) => b.items.filter((i) => i.kind === "board").map((i) => i.refId)))];
  const addOnIds = [...new Set(bundles.flatMap((b) => b.items.filter((i) => i.kind === "addon").map((i) => i.refId)))];
  const boards = boardIds.length ? await prisma.platter.findMany({ where: { id: { in: boardIds } } }) : [];
  const addOns = addOnIds.length ? await prisma.addOn.findMany({ where: { id: { in: addOnIds } } }) : [];
  const boardMap = new Map(boards.map((b) => [b.id, b]));
  const addOnMap = new Map(addOns.map((a) => [a.id, a]));
  const resolve = (kind: string, refId: string) => {
    if (kind === "board") {
      const b = boardMap.get(refId);
      return b && b.active && b.fixedPrice != null ? { name: b.name, price: Number(b.fixedPrice), imageUrl: b.imageUrl } : null;
    }
    const a = addOnMap.get(refId);
    return a && a.active ? { name: a.name, price: Number(a.price), imageUrl: a.imageUrl } : null;
  };
  const dtos = bundles
    .map((b) => ({ b, dto: bundleDTO(b, resolve) }))
    .filter(({ b, dto }) => dto.items.length > 0 && dto.items.length === b.items.length)
    .map(({ dto }) => dto);
  res.json(dtos);
});

// --- Gift voucher request (lands in admin; owner arranges payment until Stripe lands) ---
publicRouter.post("/gift-voucher", async (req, res) => {
  const parsed = giftVoucherSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  const d = parsed.data;
  await prisma.giftVoucherRequest.create({
    data: {
      amount: d.amount,
      buyerName: d.buyerName,
      buyerEmail: d.buyerEmail,
      buyerPhone: d.buyerPhone ?? null,
      recipientName: d.recipientName ?? null,
      message: d.message ?? null,
    },
  });
  res.status(201).json({ ok: true });
});

// --- Availability (platters: per-day order count vs location capacity) ---
publicRouter.get("/availability", async (req, res) => {
  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  const { locationId, from, days } = parsed.data;
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || !location.active) return res.status(404).json({ error: "Location not available" });

  const now = new Date();
  const fromDate = from ?? formatDate(now);
  const span = days ?? 21;
  const start = parseDate(fromDate);
  const end = new Date(start.getTime() + span * 86_400_000);

  const orders = await prisma.order.findMany({
    where: { locationId, status: { not: "cancelled" }, type: { in: ["platter", "gift"] }, collectionOrDeliveryDate: { gte: start, lt: end } },
    select: { collectionOrDeliveryDate: true },
  });
  const bookedByDate: Record<string, number> = {};
  for (const o of orders) {
    const key = formatDate(o.collectionOrDeliveryDate);
    bookedByDate[key] = (bookedByDate[key] ?? 0) + 1;
  }
  res.json({ locationId, capacity: location.weeklyCapacity, days: buildAvailability(fromDate, span, location.weeklyCapacity, bookedByDate, now) });
});

// --- Availability (experiences: Σ party size per (experience,location,date) vs session capacity) ---
publicRouter.get("/experiences/availability", async (req, res) => {
  const parsed = experienceAvailabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  const { experienceId, locationId, from, days } = parsed.data;
  const experience = await prisma.experience.findUnique({ where: { id: experienceId } });
  if (!experience || !experience.active) return res.status(404).json({ error: "Experience not available" });

  const now = new Date();
  const fromDate = from ?? formatDate(now);
  const span = days ?? 21;
  const start = parseDate(fromDate);
  const end = new Date(start.getTime() + span * 86_400_000);

  const bookings = await prisma.order.findMany({
    where: { type: "experience", experienceId, locationId, status: { not: "cancelled" }, collectionOrDeliveryDate: { gte: start, lt: end } },
    select: { collectionOrDeliveryDate: true, headcount: true },
  });
  const guestsByDate: Record<string, number> = {};
  for (const b of bookings) {
    const key = formatDate(b.collectionOrDeliveryDate);
    guestsByDate[key] = (guestsByDate[key] ?? 0) + b.headcount;
  }
  res.json({ experienceId, locationId, capacity: experience.capacity, days: buildAvailability(fromDate, span, experience.capacity, guestsByDate, now) });
});

// --- Order lookup ---
publicRouter.get("/orders/:ref", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { ref: req.params.ref },
    include: { platter: true, experience: true, location: true, customer: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(publicOrderDTO(order));
});

// --- Re-order ---
publicRouter.get("/reorder", async (req, res) => {
  const contact = String(req.query.contact ?? "").trim();
  if (!contact) return res.status(400).json({ error: "Enter your phone or email" });
  const order = await prisma.order.findFirst({
    where: { OR: [{ phone: contact }, { email: contact }], type: { in: ["platter", "gift"] }, platter: { active: true } },
    orderBy: { createdAt: "desc" },
    include: { platter: true, location: true },
  });
  if (!order) return res.status(404).json({ error: "We couldn't find a previous order for that" });
  // Return only the order *selection* to pre-fill the basket — never echo back the
  // contact details (name/phone/email), so a known email can't be used to harvest PII.
  // notes is withheld too: it's free-text that may hold addresses/event details, and
  // this endpoint is keyed on a guessable email/phone. The customer re-enters notes.
  res.json({
    platterId: order.platterId,
    platterName: order.platter?.name ?? null,
    headcount: order.headcount,
    locationId: order.locationId,
    locationName: order.location.name,
    notes: null,
  });
});

// --- Validate a referral code against the buyer's contact ---
// The checkout uses this so it only shows the £15 discount when the server will
// actually honour it (real code, and not a self-referral) — otherwise the review
// total wouldn't match the amount charged. Mirrors the rule in POST /orders.
publicRouter.get("/referral/check", async (req, res) => {
  const code = String(req.query.code ?? "").trim();
  const phone = String(req.query.phone ?? "").trim();
  const email = String(req.query.email ?? "").trim();
  if (!code) return res.json({ valid: false, discount: 0 });
  const referrer = await prisma.customer.findUnique({ where: { referralCode: code } });
  const isSelf = !!referrer && (referrer.phone === phone || referrer.email === email);
  const valid = !!referrer && !isSelf;
  res.json({ valid, discount: valid ? REFERRAL_DISCOUNT : 0 });
});

// --- Create a v2 line-item order (1+ boards + optional add-ons, collection) ---
publicRouter.post("/orders", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid order", details: parsed.error.flatten() });
  const input = parsed.data;
  const now = new Date();

  // Normalise the legacy single-board shape ({ platterId, quantity }) to items[].
  const itemInputs =
    input.items && input.items.length > 0
      ? input.items
      : input.platterId
        ? [{ platterId: input.platterId, quantity: input.quantity ?? 1 }]
        : [];
  if (itemInputs.length === 0) return res.status(400).json({ error: "Add at least one board" });

  if (Number.isNaN(parseDate(input.collectionOrDeliveryDate).getTime())) {
    return res.status(400).json({ error: "Invalid date" });
  }

  // Load + validate the chosen boards (must all exist, be active, and be fixed-price).
  const boardIds = [...new Set(itemInputs.map((i) => i.platterId))];
  const boards = await prisma.platter.findMany({ where: { id: { in: boardIds }, active: true } });
  const boardById = new Map(boards.map((b) => [b.id, b]));
  for (const it of itemInputs) {
    const b = boardById.get(it.platterId);
    if (!b) return res.status(404).json({ error: "A selected board is no longer available" });
    if (b.fixedPrice == null) return res.status(400).json({ error: `${b.name} can't be ordered directly` });
    if (input.headcount < b.minHeadcount) {
      return res.status(400).json({ error: `Minimum headcount for ${b.name} is ${b.minHeadcount}` });
    }
  }

  const location = await prisma.location.findUnique({ where: { id: input.locationId } });
  if (!location || !location.active) return res.status(404).json({ error: "Location not available" });

  const leadHours = await getLeadHours();
  if (!meetsLeadTime(input.collectionOrDeliveryDate, now, leadHours)) {
    return res.status(400).json({ error: `Orders need at least ${leadHours} hours notice` });
  }

  // Load + validate any add-ons.
  const addOnInputs = input.addOns ?? [];
  const addOnIds = [...new Set(addOnInputs.map((a) => a.addOnId))];
  const addOnRows = addOnIds.length ? await prisma.addOn.findMany({ where: { id: { in: addOnIds }, active: true } }) : [];
  const addOnById = new Map(addOnRows.map((a) => [a.id, a]));
  for (const a of addOnInputs) {
    if (!addOnById.get(a.addOnId)) return res.status(404).json({ error: "A selected add-on is no longer available" });
  }

  // referral validity (no self-referral)
  let referrerCode: string | null = null;
  if (input.referralCodeUsed) {
    const referrer = await prisma.customer.findUnique({ where: { referralCode: input.referralCodeUsed } });
    const isSelf = referrer && (referrer.phone === input.phone || referrer.email === input.email);
    if (referrer && !isSelf) referrerCode = input.referralCodeUsed;
  }

  // Build authoritative line items (unitPrice snapshots taken server-side).
  const boardLines = itemInputs.map((it) => ({
    platterId: it.platterId,
    quantity: it.quantity,
    unitPrice: Number(boardById.get(it.platterId)!.fixedPrice),
  }));
  const addOnLines = addOnInputs.map((a) => ({
    addOnId: a.addOnId,
    name: addOnById.get(a.addOnId)!.name,
    quantity: a.quantity,
    unitPrice: Number(addOnById.get(a.addOnId)!.price),
  }));

  // Subscribe & Save: apply the % discount only when the customer opted in AND the feature
  // is switched on in Site Settings. No card is taken here (payment-ready, not payment-live).
  const wantsSub = !!input.isSubscription && !!input.subscriptionFrequency;
  const subOn = (await getSetting("subscribeSave")) !== "off";
  const subPctRaw = parseInt((await getSetting("subscribeSaveDiscountPct")) ?? "10", 10);
  const subPct = wantsSub && subOn && Number.isFinite(subPctRaw) ? Math.max(0, Math.min(100, subPctRaw)) : 0;

  const pricing = priceLineItemOrder(
    boardLines.map((b) => ({ unitPrice: b.unitPrice, quantity: b.quantity })),
    addOnLines.map((a) => ({ unitPrice: a.unitPrice, quantity: a.quantity })),
    referrerCode != null,
    subPct,
  );

  // Freebies added to the order at no charge (recorded on the order so the owner includes them).
  // Two independent hooks: a first-order treat, and a "spend £X, get a free gift" threshold that
  // compares against the boards+add-ons subtotal (pricing.base — same number the cart shows).
  const freebies: string[] = [];
  const priorOrders = await prisma.order.count({ where: { phone: input.phone, type: { in: ["platter", "gift"] } } });
  if (priorOrders === 0 && (await getSetting("firstOrderHook")) === "on") {
    freebies.push((await getSetting("firstOrderHookText")) || "FREE first-order treat");
  }
  if ((await getSetting("freeGift")) === "on") {
    const giftThreshold = parseFloat((await getSetting("freeGiftThreshold")) ?? "0") || 0;
    const giftText = ((await getSetting("freeGiftText")) ?? "").trim();
    if (giftThreshold > 0 && giftText && pricing.base >= giftThreshold) freebies.push(giftText);
  }
  const freebie: string | null = freebies.length ? freebies.join(" + ") : null;

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Lock the location row so racing orders can't both take the last slot.
      await tx.$queryRaw`SELECT 1 FROM "Location" WHERE id = ${input.locationId} FOR UPDATE`;
      const booked = await tx.order.count({
        where: { locationId: input.locationId, collectionOrDeliveryDate: parseDate(input.collectionOrDeliveryDate), type: { in: ["platter", "gift"] }, status: { not: "cancelled" } },
      });
      if (!canBook(input.collectionOrDeliveryDate, location.weeklyCapacity, booked, now, leadHours)) throw new CapacityError();

      const ref = await uniqueRef(tx);
      const referralCode = await uniqueReferralCode(tx);
      const customer = await tx.customer.upsert({
        where: { phone: input.phone },
        update: { name: input.customerName, email: input.email },
        create: { name: input.customerName, phone: input.phone, email: input.email, referralCode },
      });

      // Subscribe & Save: record the recurring plan so the owner sees the intent and can
      // set the schedule up manually. Corporate occasions are invoiced monthly. This maps
      // cleanly onto a Stripe subscription when Stripe lands.
      const subscription =
        subPct > 0
          ? await tx.subscription.create({
              data: {
                status: "pending",
                frequency: input.subscriptionFrequency!,
                discountPct: subPct,
                customerName: input.customerName,
                email: input.email,
                phone: input.phone,
                invoiced: input.occasion === "Corporate",
              },
            })
          : null;

      const created = await tx.order.create({
        data: {
          ref,
          type: "platter",
          platterId: boardLines[0].platterId, // primary/first board (back-compat)
          headcount: input.headcount,
          occasion: input.occasion ?? null,
          total: pricing.total,
          deposit: pricing.deposit,
          depositStatus: "pending",
          collectionOrDeliveryDate: parseDate(input.collectionOrDeliveryDate),
          locationId: input.locationId,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          notes: input.notes ?? null,
          freebie,
          src: input.src ?? "direct",
          referralCodeUsed: referrerCode,
          customerId: customer.id,
          // Subscribe & Save snapshot on the order.
          isSubscription: subPct > 0,
          subscriptionFrequency: subPct > 0 ? input.subscriptionFrequency : null,
          subscriptionDiscount: subPct > 0 ? pricing.subscriptionDiscount : null,
          subscriptionId: subscription?.id ?? null,
          // Gift-a-board.
          isGift: input.isGift ?? false,
          recipientName: input.recipientName?.trim() || null,
          giftMessage: input.giftMessage?.trim() || null,
          items: { create: boardLines.map((b) => ({ platterId: b.platterId, quantity: b.quantity, unitPrice: b.unitPrice })) },
          addOns: { create: addOnLines.map((a) => ({ addOnId: a.addOnId, name: a.name, quantity: a.quantity, unitPrice: a.unitPrice })) },
        },
        include: { platter: true, location: true, items: { include: { platter: true } }, addOns: true },
      });
      await tx.customer.update({ where: { id: customer.id }, data: { lastOrderId: created.id } });
      if (referrerCode) await tx.referral.create({ data: { code: referrerCode, orderId: created.id, discount: pricing.discount } });
      return created;
    });

    // Record the (stub) deposit-intent id so a future Stripe webhook can reconcile it to
    // this order and flip depositStatus -> paid.
    const intent = await captureDepositIntent(pricing.deposit, order.ref);
    await prisma.order.update({ where: { id: order.id }, data: { depositIntentId: intent.intentId } });
    await notifyOrderReceived(
      { name: order.customerName, phone: order.phone, email: order.email },
      {
        ref: order.ref,
        total: pricing.total,
        deposit: pricing.deposit,
        collectionDate: formatDate(order.collectionOrDeliveryDate),
        locationName: order.location.name,
        // The confirmation shows what they actually ordered, photos and all.
        boards: order.items.map((i) => ({
          name: i.platter.name,
          qty: i.quantity,
          lineTotal: Number(i.unitPrice) * i.quantity,
          imageUrl: i.platter.imageUrl,
          meta: i.platter.serves ? `Feeds ${i.platter.serves}` : null,
        })),
        addOns: order.addOns.map((a) => ({
          name: a.name,
          qty: a.quantity,
          lineTotal: Number(a.unitPrice) * a.quantity,
        })),
      },
    );
    res.status(201).json({ order: orderDTO(order), pricing, freebie });
  } catch (err) {
    if (err instanceof CapacityError) return res.status(409).json({ error: "That date is fully booked at this location" });
    console.error("[orders] create failed", err);
    res.status(500).json({ error: "Could not place order" });
  }
});

// --- Create an experience booking ---
publicRouter.post("/bookings", async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid booking", details: parsed.error.flatten() });
  const input = parsed.data;
  const now = new Date();

  // Tastings aren't open for booking yet (admin toggle) — block at the API too.
  if ((await getSetting("tastingsComingSoon")) !== "off") {
    return res.status(403).json({ error: "Tastings aren't open for booking yet — coming soon!" });
  }

  if (Number.isNaN(parseDate(input.date).getTime())) return res.status(400).json({ error: "Invalid date" });
  const experience = await prisma.experience.findUnique({ where: { id: input.experienceId } });
  if (!experience || !experience.active) return res.status(404).json({ error: "Experience not available" });
  const location = await prisma.location.findUnique({ where: { id: input.locationId } });
  if (!location || !location.active) return res.status(404).json({ error: "Location not available" });
  if (!meetsNotice(input.date, now)) return res.status(400).json({ error: "Bookings need at least 48 hours notice" });

  const pricing = priceOrder({ pricePerHead: Number(experience.pricePerHead), fixedPrice: null }, input.partySize, false);

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Serialize concurrent bookings for this location so two parties can't both
      // pass the session-capacity check for the last seats (see /orders for detail).
      await tx.$queryRaw`SELECT 1 FROM "Location" WHERE id = ${input.locationId} FOR UPDATE`;
      const agg = await tx.order.aggregate({
        where: { type: "experience", experienceId: input.experienceId, locationId: input.locationId, collectionOrDeliveryDate: parseDate(input.date), status: { not: "cancelled" } },
        _sum: { headcount: true },
      });
      const bookedGuests = agg._sum.headcount ?? 0;
      const avail = getDayAvailability(input.date, experience.capacity, bookedGuests, now);
      if (!avail.bookable || avail.remaining < input.partySize) throw new CapacityError();

      const ref = await uniqueRef(tx);
      const referralCode = await uniqueReferralCode(tx);
      const customer = await tx.customer.upsert({
        where: { phone: input.phone },
        update: { name: input.customerName, email: input.email },
        create: { name: input.customerName, phone: input.phone, email: input.email, referralCode },
      });
      const created = await tx.order.create({
        data: {
          ref,
          type: "experience",
          experienceId: input.experienceId,
          headcount: input.partySize,
          total: pricing.total,
          deposit: pricing.deposit,
          depositStatus: "pending",
          collectionOrDeliveryDate: parseDate(input.date),
          locationId: input.locationId,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          notes: input.notes ?? null,
          src: input.src ?? "direct",
          customerId: customer.id,
        },
        include: { experience: true, location: true },
      });
      await tx.customer.update({ where: { id: customer.id }, data: { lastOrderId: created.id } });
      return created;
    });

    await captureDepositIntent(pricing.deposit, order.ref);
    await notifyOrderReceived(
      { name: order.customerName, phone: order.phone, email: order.email },
      {
        ref: order.ref,
        total: pricing.total,
        deposit: pricing.deposit,
        collectionDate: formatDate(order.collectionOrDeliveryDate),
        locationName: order.location.name,
        boards: order.experience
          ? [{ name: order.experience.name, qty: 1, lineTotal: pricing.total, imageUrl: order.experience.imageUrl }]
          : [],
      },
    );
    res.status(201).json({ order: orderDTO(order), pricing });
  } catch (err) {
    if (err instanceof CapacityError) return res.status(409).json({ error: "That session is fully booked — try another date" });
    console.error("[bookings] create failed", err);
    res.status(500).json({ error: "Could not place booking" });
  }
});
