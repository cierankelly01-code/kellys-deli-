import { asyncRouter } from "../lib/async-router";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { orderDTO, platterDTO, experienceDTO, locationDTO, boardComponentDTO, boardGroupDTO, addOnDTO, categoryDTO, corporateEnquiryDTO, subscriptionDTO, bundleDTO, giftVoucherDTO, type PlatterItem } from "../lib/serialize";
import {
  platterUpsertSchema,
  experienceUpsertSchema,
  locationUpdateSchema,
  settingSchema,
  blastSchema,
  boardComponentUpsertSchema,
  boardGroupUpdateSchema,
  addOnUpsertSchema,
  categoryUpsertSchema,
  categoryAssignSchema,
  enquiryStatusSchema,
  subscriptionStatusSchema,
  bundleUpsertSchema,
  giftVoucherStatusSchema,
} from "../lib/validation";
import { calcMargin } from "../lib/money";
import { parseDate, formatDate } from "../lib/capacity";
import { buildPrepSheet, type PrepInputOrder } from "../lib/prep-sheet";
import { summarizeOrders, rankPlattersByMargin, profitOf, type StatOrderInput } from "../lib/stats";
import { notifyReviewRequest, notifyReferralOffer, notifyBlast } from "../lib/notify";
import { imageUpload, persistUpload, MAX_UPLOAD_LABEL } from "../lib/uploads";
import { ImageRejected } from "../lib/image";

export const adminRouter = asyncRouter();

// v2 manual staff flow (build spec §1.3). "collected" is the terminal, notify-firing state
// (the old "completed"). Legacy values are tolerated when reading old rows but not offered.
const STATUSES = ["new", "deposit_requested", "confirmed", "collected", "cancelled"] as const;
const GOOGLE_REVIEW_URL = "https://g.page/r/kellys-deli/review"; // placeholder review link

/** Cost of an order's line (platter or experience). */
const orderCost = (o: any): number =>
  o.type === "experience" ? Number(o.experience?.cost ?? 0) : Number(o.platter?.cost ?? 0);

/** Map a Prisma order (+platter/experience/location) to the StatOrderInput shape. */
function toStatInput(o: any): StatOrderInput {
  const isExp = o.type === "experience";
  return {
    total: Number(o.total),
    cost: orderCost(o),
    isFixed: isExp ? false : o.platter?.fixedPrice != null,
    headcount: o.headcount,
    platterId: isExp ? o.experienceId ?? "experience" : o.platterId ?? "platter",
    platterName: isExp ? o.experience?.name ?? "Experience" : o.platter?.name ?? "Platter",
    locationId: o.locationId,
    locationName: o.location?.name ?? "",
    src: o.src,
  };
}

const ORDER_INCLUDE = {
  platter: true,
  experience: true,
  location: true,
  items: { include: { platter: true } },
  addOns: true,
} as const;

// --- Order + booking list (filterable) ---
adminRouter.get("/orders", async (req, res) => {
  const { location, date, status, type } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (location) where.locationId = location;
  if (status) where.status = status;
  if (type) where.type = type;
  if (date) where.collectionOrDeliveryDate = parseDate(date);

  const orders = await prisma.order.findMany({
    where,
    include: ORDER_INCLUDE,
    orderBy: [{ collectionOrDeliveryDate: "asc" }, { createdAt: "asc" }],
  });

  res.json(orders.map((o) => ({ ...orderDTO(o), cost: orderCost(o), profit: profitOf(toStatInput(o)) })));
});

// --- Update order status ---
const statusSchema = z.object({ status: z.enum(STATUSES) });

adminRouter.patch("/orders/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
    include: { ...ORDER_INCLUDE, customer: true },
  });

  // Collection triggers the review + referral engines exactly once. Guard on a
  // persistent timestamp (not the transient status) and flip it atomically, so a
  // status bounce (collected -> other -> collected) or two concurrent PATCHes can't
  // re-send the customer duplicate "review us" / referral messages.
  if (parsed.data.status === "collected") {
    const flip = await prisma.order.updateMany({
      where: { id: req.params.id, completedNotifiedAt: null },
      data: { completedNotifiedAt: new Date() },
    });
    if (flip.count === 1) {
      const code = order.customer?.referralCode;
      const target = { name: order.customerName, phone: order.phone, email: order.email };
      await notifyReviewRequest(target, GOOGLE_REVIEW_URL);
      if (code) await notifyReferralOffer(target, code, `${env.publicUrl}/order?referral=${code}`);
    }
  }

  res.json({ ...orderDTO(order), cost: orderCost(order), profit: profitOf(toStatInput(order)) });
});

// --- Kitchen prep sheet (platter + gift orders only; experiences aren't kitchen-prepped) ---
adminRouter.get("/prep-sheet", async (req, res) => {
  const { locationId, date } = req.query as Record<string, string | undefined>;
  if (!locationId || !date) return res.status(400).json({ error: "locationId and date are required" });

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) return res.status(404).json({ error: "Location not found" });

  const orders = await prisma.order.findMany({
    where: { locationId, collectionOrDeliveryDate: parseDate(date), status: { not: "cancelled" }, type: { in: ["platter", "gift"] } },
    include: { platter: true, items: { include: { platter: true } } },
    orderBy: { createdAt: "asc" },
  });

  // The name(s) of the board(s) on an order — the itemised line items when present,
  // otherwise the legacy single platter.
  const boardNames = (o: (typeof orders)[number]): string => {
    if (o.items.length > 0) {
      return o.items.map((i) => `${i.platter?.name ?? "—"}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ");
    }
    return o.platter?.name ?? "—";
  };

  // One prep row per ORDER (so headcount/order counts stay correct). Ingredient
  // quantities are pre-scaled by each board line's quantity and flattened across all
  // boards on the order; scale is then 1 (isFixed/quantity=1). Falls back to the legacy
  // single platter (× quantity) / build-your-own customItems for pre-v2 rows.
  const input: PrepInputOrder[] = orders
    .map((o) => {
      const items: PlatterItem[] = [];
      if (o.items.length > 0) {
        for (const line of o.items) {
          const boardItems = (line.platter?.items as unknown as PlatterItem[]) ?? [];
          for (const it of boardItems) items.push({ label: it.label, qtyPerUnit: it.qtyPerUnit * line.quantity });
        }
      } else if (o.platter) {
        const customItems = o.customItems as unknown as string[] | null;
        const base: PlatterItem[] = customItems?.length
          ? customItems.map((label) => ({ label, qtyPerUnit: 1 }))
          : ((o.platter.items as unknown as PlatterItem[]) ?? []);
        const q = o.quantity ?? 1;
        for (const it of base) items.push({ label: it.label, qtyPerUnit: it.qtyPerUnit * q });
      }
      return { ref: o.ref, platterName: boardNames(o), isFixed: true, headcount: o.headcount, quantity: 1, items };
    })
    .filter((o) => o.items.length > 0);

  res.json({
    location: { id: location.id, name: location.name },
    date,
    sheet: buildPrepSheet(input),
    orders: orders.map((o) => ({
      ref: o.ref,
      platterName: boardNames(o),
      headcount: o.headcount,
      customerName: o.customerName,
      status: o.status,
      isGift: o.isGift,
      freebie: o.freebie,
    })),
  });
});

// --- Profit + lead-source dashboard ---
adminRouter.get("/stats", async (_req, res) => {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000);
  const monthAgo = new Date(now - 30 * 86_400_000);

  const orders = await prisma.order.findMany({ where: { status: { not: "cancelled" } }, include: ORDER_INCLUDE });
  const inputs = orders.map(toStatInput);
  const within = (since: Date) => orders.filter((o) => o.createdAt >= since).map(toStatInput);

  const platters = await prisma.platter.findMany();
  const experiences = await prisma.experience.findMany();

  res.json({
    all: summarizeOrders(inputs),
    month: summarizeOrders(within(monthAgo)),
    week: summarizeOrders(within(weekAgo)),
    marginRanking: rankPlattersByMargin([
      ...platters.map((p) => ({
        id: p.id,
        name: p.name,
        pricePerHead: p.pricePerHead ? Number(p.pricePerHead) : null,
        fixedPrice: p.fixedPrice ? Number(p.fixedPrice) : null,
        cost: Number(p.cost),
      })),
      ...experiences.map((e) => ({
        id: e.id,
        name: `${e.name} (experience)`,
        pricePerHead: Number(e.pricePerHead),
        fixedPrice: null,
        cost: Number(e.cost),
      })),
    ]),
  });
});

// =====================  Menu & Pricing — platters  =====================
adminRouter.get("/platters", async (_req, res) => {
  const platters = await prisma.platter.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  res.json(platters.map((p) => platterDTO(p, { includeCost: true })));
});

interface PlatterFallback {
  active: boolean;
  sortOrder: number;
  tier?: string | null;
  feedsMin?: number | null;
  feedsMax?: number | null;
  recommendEligible?: boolean;
  recommendPriority?: number;
  variantGroup?: string | null;
  variantLabel?: string | null;
  variantOrder?: number;
}

function platterData(d: import("../lib/validation").PlatterUpsertInput, fallback?: PlatterFallback) {
  return {
    category: d.category,
    name: d.name,
    description: d.description,
    pricePerHead: d.pricePerHead ?? null,
    fixedPrice: d.fixedPrice ?? null,
    cost: d.cost,
    serves: d.serves ?? null,
    minHeadcount: d.minHeadcount,
    items: d.items,
    imageUrl: d.imageUrl ?? null,
    active: d.active ?? fallback?.active ?? true,
    sortOrder: d.sortOrder ?? fallback?.sortOrder ?? 0,
    boardType: d.boardType ?? null,
    size: d.size ?? null,
    // v2 board fields — preserve existing values on PATCH when the client omits them,
    // so a Menu editor save can't silently wipe recommender config set elsewhere.
    tier: d.tier ?? fallback?.tier ?? null,
    feedsMin: d.feedsMin ?? fallback?.feedsMin ?? null,
    feedsMax: d.feedsMax ?? fallback?.feedsMax ?? null,
    recommendEligible: d.recommendEligible ?? fallback?.recommendEligible ?? false,
    recommendPriority: d.recommendPriority ?? fallback?.recommendPriority ?? 0,
    // Sizes & options. Tested with `in` rather than `??` because an explicit null is how
    // the editor takes a board back out of a group — `??` would treat that as "unchanged"
    // and the board could never be ungrouped.
    variantGroup: "variantGroup" in d ? (d.variantGroup ?? null) : (fallback?.variantGroup ?? null),
    variantLabel: "variantLabel" in d ? (d.variantLabel ?? null) : (fallback?.variantLabel ?? null),
    variantOrder: d.variantOrder ?? fallback?.variantOrder ?? 0,
  };
}

adminRouter.post("/platters", async (req, res) => {
  const parsed = platterUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid platter", details: parsed.error.flatten() });
  const count = await prisma.platter.count();
  const created = await prisma.platter.create({ data: platterData(parsed.data, { active: true, sortOrder: count }) });
  res.status(201).json(platterDTO(created, { includeCost: true }));
});

adminRouter.patch("/platters/:id", async (req, res) => {
  const parsed = platterUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid platter", details: parsed.error.flatten() });
  const exists = await prisma.platter.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Platter not found" });
  const updated = await prisma.platter.update({
    where: { id: req.params.id },
    data: platterData(parsed.data, {
      active: exists.active,
      sortOrder: exists.sortOrder,
      tier: exists.tier,
      feedsMin: exists.feedsMin,
      feedsMax: exists.feedsMax,
      recommendEligible: exists.recommendEligible,
      recommendPriority: exists.recommendPriority,
      variantGroup: exists.variantGroup,
      variantLabel: exists.variantLabel,
      variantOrder: exists.variantOrder,
    }),
  });
  res.json(platterDTO(updated, { includeCost: true }));
});

// Past orders reference platters by FK, so those can only be hidden, never deleted.
adminRouter.delete("/platters/:id", async (req, res) => {
  const exists = await prisma.platter.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Platter not found" });
  const orderCount = await prisma.order.count({ where: { platterId: req.params.id } });
  if (orderCount > 0) {
    return res.status(409).json({ error: "This platter has past orders — hide it with the Active toggle instead of deleting" });
  }
  await prisma.platter.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// =====================  Menu & Pricing — experiences  =====================
adminRouter.get("/experiences", async (_req, res) => {
  const experiences = await prisma.experience.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  res.json(experiences.map((e) => experienceDTO(e, { includeCost: true })));
});

adminRouter.post("/experiences", async (req, res) => {
  const parsed = experienceUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid experience", details: parsed.error.flatten() });
  const d = parsed.data;
  const count = await prisma.experience.count();
  const created = await prisma.experience.create({
    data: { name: d.name, description: d.description, pricePerHead: d.pricePerHead, cost: d.cost, capacity: d.capacity, imageUrl: d.imageUrl ?? null, active: d.active ?? true, sortOrder: d.sortOrder ?? count },
  });
  res.status(201).json(experienceDTO(created, { includeCost: true }));
});

adminRouter.patch("/experiences/:id", async (req, res) => {
  const parsed = experienceUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid experience", details: parsed.error.flatten() });
  const exists = await prisma.experience.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Experience not found" });
  const d = parsed.data;
  const updated = await prisma.experience.update({
    where: { id: req.params.id },
    data: { name: d.name, description: d.description, pricePerHead: d.pricePerHead, cost: d.cost, capacity: d.capacity, imageUrl: d.imageUrl ?? null, active: d.active ?? exists.active, sortOrder: d.sortOrder ?? exists.sortOrder },
  });
  res.json(experienceDTO(updated, { includeCost: true }));
});

// =====================  Board components (build-your-own ingredients)  =====================
adminRouter.get("/board-components", async (_req, res) => {
  const rows = await prisma.boardComponent.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  res.json(rows.map(boardComponentDTO));
});

adminRouter.post("/board-components", async (req, res) => {
  const parsed = boardComponentUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid item" });
  const d = parsed.data;
  const count = await prisma.boardComponent.count();
  const created = await prisma.boardComponent.create({
    data: { category: d.category, label: d.label, imageUrl: d.imageUrl ?? null, price: d.price ?? 0, isDefault: d.isDefault ?? false, active: d.active ?? true, sortOrder: d.sortOrder ?? count },
  });
  res.status(201).json(boardComponentDTO(created));
});

adminRouter.patch("/board-components/:id", async (req, res) => {
  const parsed = boardComponentUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid item" });
  const d = parsed.data;
  const exists = await prisma.boardComponent.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Item not found" });
  const updated = await prisma.boardComponent.update({
    where: { id: req.params.id },
    data: {
      category: d.category,
      label: d.label,
      imageUrl: d.imageUrl ?? null,
      price: d.price ?? Number(exists.price),
      isDefault: d.isDefault ?? exists.isDefault,
      active: d.active ?? exists.active,
      sortOrder: d.sortOrder ?? exists.sortOrder,
    },
  });
  res.json(boardComponentDTO(updated));
});

// Safe to hard-delete: past orders store ingredient labels, not FKs.
adminRouter.delete("/board-components/:id", async (req, res) => {
  const exists = await prisma.boardComponent.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Item not found" });
  await prisma.boardComponent.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// =====================  Board configurator group rules  =====================
adminRouter.get("/board-groups", async (_req, res) => {
  const groups = await prisma.boardComponentGroup.findMany({ orderBy: { sortOrder: "asc" } });
  res.json(groups.map((g) => boardGroupDTO(g)));
});

adminRouter.patch("/board-groups/:id", async (req, res) => {
  const parsed = boardGroupUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid group" });
  const exists = await prisma.boardComponentGroup.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Group not found" });
  const updated = await prisma.boardComponentGroup.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(boardGroupDTO(updated));
});

// =====================  Add-ons (upsell items)  =====================
function addOnData(d: import("../lib/validation").AddOnUpsertInput, fallback?: { active: boolean; sortOrder: number }) {
  return {
    name: d.name,
    description: d.description ?? null,
    price: d.price,
    unitType: d.unitType,
    unitLabel: d.unitLabel ?? null,
    servesPerUnit: d.servesPerUnit ?? null,
    suggestFromHeadcount: d.suggestFromHeadcount ?? false,
    imageUrl: d.imageUrl ?? null,
    active: d.active ?? fallback?.active ?? true,
    sortOrder: d.sortOrder ?? fallback?.sortOrder ?? 0,
  };
}

adminRouter.get("/add-ons", async (_req, res) => {
  const rows = await prisma.addOn.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  res.json(rows.map(addOnDTO));
});

adminRouter.post("/add-ons", async (req, res) => {
  const parsed = addOnUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid add-on", details: parsed.error.flatten() });
  const count = await prisma.addOn.count();
  const created = await prisma.addOn.create({ data: addOnData(parsed.data, { active: true, sortOrder: count }) });
  res.status(201).json(addOnDTO(created));
});

adminRouter.patch("/add-ons/:id", async (req, res) => {
  const parsed = addOnUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid add-on", details: parsed.error.flatten() });
  const exists = await prisma.addOn.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Add-on not found" });
  const updated = await prisma.addOn.update({
    where: { id: req.params.id },
    data: addOnData(parsed.data, { active: exists.active, sortOrder: exists.sortOrder }),
  });
  res.json(addOnDTO(updated));
});

// Safe to hard-delete: past orders snapshot the add-on name + price, not an FK value.
adminRouter.delete("/add-ons/:id", async (req, res) => {
  const exists = await prisma.addOn.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Add-on not found" });
  const used = await prisma.orderAddOn.count({ where: { addOnId: req.params.id } });
  if (used > 0) {
    return res.status(409).json({ error: "This add-on is on past orders — hide it with the Active toggle instead of deleting" });
  }
  await prisma.addOn.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// =====================  Locations  =====================
adminRouter.get("/locations", async (_req, res) => {
  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
  res.json(locations.map(locationDTO));
});

adminRouter.patch("/locations/:id", async (req, res) => {
  const parsed = locationUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid location update" });
  const exists = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Location not found" });
  const updated = await prisma.location.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(locationDTO(updated));
});

adminRouter.post("/margin", (req, res) => {
  const { price, cost } = req.body ?? {};
  res.json(calcMargin(Number(price) || 0, Number(cost) || 0));
});

// Image upload — returns a URL to store as a platter/experience imageUrl.
adminRouter.post("/upload", (req, res) => {
  imageUpload.single("image")(req, res, async (err) => {
    // multer's own messages are developer-speak ("File too large"); the owner is not.
    if (err) {
      const tooBig = (err as { code?: string }).code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        error: tooBig ? `That photo is too big — please use one under ${MAX_UPLOAD_LABEL}` : err.message,
      });
    }
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    try {
      res.json({ url: await persistUpload(req.file) });
    } catch (e) {
      // A file that isn't a readable image is the owner's mistake, not a server fault.
      if (e instanceof ImageRejected) return res.status(400).json({ error: e.message });
      console.error("[upload] failed", e);
      // Admin-only endpoint: surface the underlying storage error so upload
      // misconfiguration (missing/misnamed bucket, bad key) is diagnosable.
      res.status(500).json({ error: "Upload failed", detail: e instanceof Error ? e.message : String(e) });
    }
  });
});

// =====================  Occasion categories  =====================
adminRouter.get("/categories", async (_req, res) => {
  const cats = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { platters: { include: { platter: true }, orderBy: { sortOrder: "asc" } } },
  });
  res.json(cats.map((c) => categoryDTO(c)));
});

function categoryData(d: import("../lib/validation").CategoryUpsertInput, fallback?: { active: boolean; sortOrder: number }) {
  return {
    slug: d.slug,
    name: d.name,
    tagline: d.tagline ?? null,
    description: d.description ?? null,
    heroImageUrl: d.heroImageUrl ?? null,
    seoTitle: d.seoTitle ?? null,
    seoDescription: d.seoDescription ?? null,
    isCorporate: d.isCorporate ?? false,
    promotePlanner: d.promotePlanner ?? false,
    active: d.active ?? fallback?.active ?? true,
    sortOrder: d.sortOrder ?? fallback?.sortOrder ?? 0,
  };
}

adminRouter.post("/categories", async (req, res) => {
  const parsed = categoryUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid category" });
  const dup = await prisma.category.findUnique({ where: { slug: parsed.data.slug } });
  if (dup) return res.status(409).json({ error: "A category with that web address (slug) already exists" });
  const count = await prisma.category.count();
  const created = await prisma.category.create({ data: categoryData(parsed.data, { active: true, sortOrder: count }) });
  res.status(201).json(categoryDTO(created));
});

adminRouter.patch("/categories/:id", async (req, res) => {
  const parsed = categoryUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid category" });
  const exists = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Category not found" });
  // Guard the unique slug when it's being changed.
  if (parsed.data.slug !== exists.slug) {
    const dup = await prisma.category.findUnique({ where: { slug: parsed.data.slug } });
    if (dup) return res.status(409).json({ error: "A category with that web address (slug) already exists" });
  }
  const updated = await prisma.category.update({
    where: { id: req.params.id },
    data: categoryData(parsed.data, { active: exists.active, sortOrder: exists.sortOrder }),
    include: { platters: { include: { platter: true }, orderBy: { sortOrder: "asc" } } },
  });
  res.json(categoryDTO(updated));
});

adminRouter.delete("/categories/:id", async (req, res) => {
  const exists = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Category not found" });
  // Assignments cascade-delete; boards and orders are untouched.
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Replace a category's board assignments (ordered). Idempotent: wipe then re-add.
adminRouter.put("/categories/:id/boards", async (req, res) => {
  const parsed = categoryAssignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid board list" });
  const exists = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Category not found" });
  // Keep only ids that point at real boards, preserving the requested order.
  const ids = [...new Set(parsed.data.platterIds)];
  const boards = ids.length ? await prisma.platter.findMany({ where: { id: { in: ids } }, select: { id: true } }) : [];
  const valid = new Set(boards.map((b) => b.id));
  const ordered = parsed.data.platterIds.filter((id, i, arr) => valid.has(id) && arr.indexOf(id) === i);
  await prisma.$transaction([
    prisma.platterCategory.deleteMany({ where: { categoryId: req.params.id } }),
    ...ordered.map((platterId, i) =>
      prisma.platterCategory.create({ data: { categoryId: req.params.id, platterId, sortOrder: i } }),
    ),
  ]);
  const updated = await prisma.category.findUnique({
    where: { id: req.params.id },
    include: { platters: { include: { platter: true }, orderBy: { sortOrder: "asc" } } },
  });
  res.json(categoryDTO(updated!));
});

// =====================  Corporate enquiries + reminders + subscriptions  =====================
adminRouter.get("/corporate-enquiries", async (_req, res) => {
  const rows = await prisma.corporateEnquiry.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rows.map(corporateEnquiryDTO));
});

adminRouter.patch("/corporate-enquiries/:id", async (req, res) => {
  const parsed = enquiryStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
  const exists = await prisma.corporateEnquiry.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Enquiry not found" });
  const updated = await prisma.corporateEnquiry.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
  res.json(corporateEnquiryDTO(updated));
});

adminRouter.get("/reminders", async (_req, res) => {
  const rows = await prisma.reminderSignup.findMany({ orderBy: { createdAt: "desc" } });
  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      occasion: r.occasion,
      reminderDate: r.reminderDate ? formatDate(r.reminderDate) : null,
      notified: r.notified,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

adminRouter.get("/subscriptions", async (_req, res) => {
  const rows = await prisma.subscription.findMany({ orderBy: { createdAt: "desc" }, include: { orders: true } });
  res.json(rows.map(subscriptionDTO));
});

adminRouter.patch("/subscriptions/:id", async (req, res) => {
  const parsed = subscriptionStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
  const exists = await prisma.subscription.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Subscription not found" });
  const updated = await prisma.subscription.update({ where: { id: req.params.id }, data: { status: parsed.data.status }, include: { orders: true } });
  res.json(subscriptionDTO(updated));
});

// =====================  Bundles (curated one-tap combos)  =====================
// Admin resolves items against ALL boards/add-ons (active + inactive) so a bundle's parts
// are always visible for editing, even if a component is temporarily switched off.
async function serializeBundles(bundles: Array<Parameters<typeof bundleDTO>[0]>) {
  const [boards, addOns] = await Promise.all([prisma.platter.findMany(), prisma.addOn.findMany()]);
  const boardMap = new Map(boards.map((b) => [b.id, b]));
  const addOnMap = new Map(addOns.map((a) => [a.id, a]));
  const resolve = (kind: string, refId: string) => {
    if (kind === "board") {
      const b = boardMap.get(refId);
      return b ? { name: b.name, price: Number(b.fixedPrice ?? 0), imageUrl: b.imageUrl } : null;
    }
    const a = addOnMap.get(refId);
    return a ? { name: a.name, price: Number(a.price), imageUrl: a.imageUrl } : null;
  };
  return bundles.map((b) => bundleDTO(b, resolve));
}

adminRouter.get("/bundles", async (_req, res) => {
  const bundles = await prisma.bundle.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { items: true } });
  res.json(await serializeBundles(bundles));
});

adminRouter.post("/bundles", async (req, res) => {
  const parsed = bundleUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid bundle" });
  const d = parsed.data;
  const count = await prisma.bundle.count();
  const created = await prisma.bundle.create({
    data: {
      name: d.name, tagline: d.tagline ?? null, description: d.description ?? null, imageUrl: d.imageUrl ?? null,
      active: d.active ?? true, sortOrder: d.sortOrder ?? count,
      items: { create: d.items.map((it, i) => ({ kind: it.kind, refId: it.refId, quantity: it.quantity, sortOrder: i })) },
    },
    include: { items: true },
  });
  res.status(201).json((await serializeBundles([created]))[0]);
});

adminRouter.patch("/bundles/:id", async (req, res) => {
  const parsed = bundleUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid bundle" });
  const exists = await prisma.bundle.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Bundle not found" });
  const d = parsed.data;
  // Replace items wholesale (wipe + re-add) inside a transaction so the set is always consistent.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.bundleItem.deleteMany({ where: { bundleId: req.params.id } });
    return tx.bundle.update({
      where: { id: req.params.id },
      data: {
        name: d.name, tagline: d.tagline ?? null, description: d.description ?? null, imageUrl: d.imageUrl ?? null,
        active: d.active ?? exists.active, sortOrder: d.sortOrder ?? exists.sortOrder,
        items: { create: d.items.map((it, i) => ({ kind: it.kind, refId: it.refId, quantity: it.quantity, sortOrder: i })) },
      },
      include: { items: true },
    });
  });
  res.json((await serializeBundles([updated]))[0]);
});

adminRouter.delete("/bundles/:id", async (req, res) => {
  const exists = await prisma.bundle.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Bundle not found" });
  await prisma.bundle.delete({ where: { id: req.params.id } }); // items cascade
  res.json({ ok: true });
});

// =====================  Gift voucher requests  =====================
adminRouter.get("/gift-vouchers", async (_req, res) => {
  const rows = await prisma.giftVoucherRequest.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rows.map(giftVoucherDTO));
});

adminRouter.patch("/gift-vouchers/:id", async (req, res) => {
  const parsed = giftVoucherStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
  const exists = await prisma.giftVoucherRequest.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Request not found" });
  const updated = await prisma.giftVoucherRequest.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
  res.json(giftVoucherDTO(updated));
});

// =====================  Settings (global toggles)  =====================
adminRouter.get("/settings", async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json(map);
});

adminRouter.patch("/settings/:key", async (req, res) => {
  const parsed = settingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid setting" });
  const updated = await prisma.setting.upsert({
    where: { key: req.params.key },
    update: { value: parsed.data.value },
    create: { key: req.params.key, value: parsed.data.value },
  });
  res.json({ key: updated.key, value: updated.value });
});

// Wipe all transactional/test data (orders, bookings, referrals, customers).
// Keeps platters, experiences, locations, settings and admin users. Admin-only.
// DESTRUCTIVE and irreversible: it deletes ALL orders/customers, not just test rows.
// Require an explicit typed confirmation in the body so a stray/accidental call
// (or a compromised token hitting it blindly) can't erase real customer history.
adminRouter.post("/wipe-test-data", async (req, res) => {
  if (req.body?.confirm !== "DELETE ALL DATA") {
    return res.status(400).json({ error: 'Send { "confirm": "DELETE ALL DATA" } to confirm this irreversible wipe' });
  }
  const referrals = await prisma.referral.deleteMany();
  const orders = await prisma.order.deleteMany();
  const customers = await prisma.customer.deleteMany();
  res.json({ orders: orders.count, bookings: 0, customers: customers.count, referrals: referrals.count });
});

// =====================  SMS list + blast  =====================
adminRouter.get("/customers", async (_req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
  const agg = await prisma.order.groupBy({
    by: ["customerId"],
    where: { status: { not: "cancelled" } },
    _sum: { total: true },
    _count: true,
    _max: { createdAt: true },
  });
  const byId = new Map(agg.map((a) => [a.customerId, a]));
  res.json(
    customers.map((c) => {
      const a = byId.get(c.id);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        referralCode: c.referralCode,
        isBigSpender: c.isBigSpender,
        lifetimeSpend: Number(a?._sum.total ?? 0),
        orderCount: a?._count ?? 0,
        lastOrderAt: a?._max.createdAt ?? null,
      };
    }),
  );
});

adminRouter.patch("/customers/:id", async (req, res) => {
  const isBigSpender = !!req.body?.isBigSpender;
  const exists = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Customer not found" });
  const updated = await prisma.customer.update({ where: { id: req.params.id }, data: { isBigSpender } });
  res.json({ id: updated.id, isBigSpender: updated.isBigSpender });
});

adminRouter.get("/customers/export", async (_req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
  const header = "name,phone,email,bigSpender,referralCode";
  // Neutralise CSV formula injection: a customer-supplied value starting with
  // = + - @ (or tab/CR) is treated as a formula by Excel/Sheets. Prefix with '
  // so the spreadsheet renders it as text, then quote-escape as normal.
  const csvCell = (v: unknown) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = customers.map((c) =>
    [c.name, c.phone, c.email, c.isBigSpender ? "yes" : "no", c.referralCode].map(csvCell).join(","),
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="kellys-deli-sms-list.csv"');
  res.send([header, ...rows].join("\n"));
});

adminRouter.post("/sms/blast", async (req, res) => {
  const parsed = blastSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid blast" });
  const { message, audience } = parsed.data;
  const where = audience === "big_spenders" ? { isBigSpender: true } : {};
  const recipients = await prisma.customer.findMany({ where });
  for (const c of recipients) await notifyBlast(c.phone, message);
  res.json({ sent: recipients.length, audience });
});

// =====================  Last-minute "Fill These Slots"  =====================
function humanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function promoFor(locationName: string, dateStr: string, remaining: number): string {
  return (
    `📣 Last-minute catering at Kelly's Deli ${locationName}! We've still got room for ` +
    `${remaining} order${remaining === 1 ? "" : "s"} on ${humanDate(dateStr)}. ` +
    `Platters for home, office & events — the same local produce our regulars trust. ` +
    `DM us or call the shop to grab a slot before it's gone. 🥪`
  );
}

adminRouter.get("/fill-slots", async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 21);
  const now = new Date();
  const today = formatDate(now);
  const start = parseDate(today);
  const end = new Date(start.getTime() + days * 86_400_000);

  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const orders = await prisma.order.findMany({
    where: { status: { not: "cancelled" }, type: { in: ["platter", "gift"] }, collectionOrDeliveryDate: { gte: start, lt: end } },
    select: { locationId: true, collectionOrDeliveryDate: true },
  });

  const counts = new Map<string, number>();
  for (const o of orders) {
    const key = `${o.locationId}|${formatDate(o.collectionOrDeliveryDate)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const slots: Array<Record<string, unknown>> = [];
  for (const loc of locations) {
    for (let i = 0; i < days; i++) {
      const dateStr = formatDate(new Date(start.getTime() + i * 86_400_000));
      const booked = counts.get(`${loc.id}|${dateStr}`) ?? 0;
      const remaining = loc.weeklyCapacity - booked;
      if (remaining <= 0) continue;
      const hoursAway = (parseDate(dateStr).getTime() - now.getTime()) / 3_600_000;
      slots.push({
        locationId: loc.id,
        locationName: loc.name,
        date: dateStr,
        humanDate: humanDate(dateStr),
        capacity: loc.weeklyCapacity,
        booked,
        remaining,
        withinNotice: hoursAway < 48,
        promo: promoFor(loc.name, dateStr, remaining),
      });
    }
  }
  slots.sort((a: any, b: any) => (a.date === b.date ? a.locationName.localeCompare(b.locationName) : a.date.localeCompare(b.date)));
  res.json({ days, slots });
});
