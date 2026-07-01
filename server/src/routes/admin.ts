import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { orderDTO, platterDTO, experienceDTO, locationDTO, boardComponentDTO, type PlatterItem } from "../lib/serialize";
import {
  platterUpsertSchema,
  experienceUpsertSchema,
  locationUpdateSchema,
  settingSchema,
  blastSchema,
  boardComponentUpsertSchema,
} from "../lib/validation";
import { calcMargin } from "../lib/money";
import { parseDate, formatDate } from "../lib/capacity";
import { buildPrepSheet, type PrepInputOrder } from "../lib/prep-sheet";
import { summarizeOrders, rankPlattersByMargin, profitOf, type StatOrderInput } from "../lib/stats";
import { notifyReviewRequest, notifyReferralOffer, notifyBlast } from "../lib/notify";
import { imageUpload, persistUpload } from "../lib/uploads";

export const adminRouter = Router();

const STATUSES = ["new", "confirmed", "in_prep", "ready", "completed", "cancelled"] as const;
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

const ORDER_INCLUDE = { platter: true, experience: true, location: true } as const;

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

  // Completion triggers the review + referral engines (stubbed/logged), once.
  if (parsed.data.status === "completed" && existing.status !== "completed") {
    const code = order.customer?.referralCode;
    const target = { name: order.customerName, phone: order.phone, email: order.email };
    await notifyReviewRequest(target, GOOGLE_REVIEW_URL);
    if (code) await notifyReferralOffer(target, code, `${env.clientOrigins[0]}/order?referral=${code}`);
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
    include: { platter: true },
    orderBy: { createdAt: "asc" },
  });

  const input: PrepInputOrder[] = orders
    .filter((o) => o.platter)
    .map((o) => {
      const customItems = o.customItems as unknown as string[] | null;
      // Build-your-own boards: prep from the customer's chosen ingredients, one unit each,
      // scaled by quantity. Otherwise use the platter's own item list as normal.
      const items: PlatterItem[] = customItems?.length
        ? customItems.map((label) => ({ label, qtyPerUnit: 1 }))
        : ((o.platter!.items as unknown as PlatterItem[]) ?? []);
      return {
        ref: o.ref,
        platterName: o.platter!.name,
        isFixed: o.platter!.fixedPrice != null,
        headcount: o.headcount,
        quantity: o.quantity ?? undefined,
        items,
      };
    });

  res.json({
    location: { id: location.id, name: location.name },
    date,
    sheet: buildPrepSheet(input),
    orders: orders.map((o) => ({
      ref: o.ref,
      platterName: o.platter?.name ?? "—",
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

function platterData(d: import("../lib/validation").PlatterUpsertInput, fallback?: { active: boolean; sortOrder: number }) {
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
    data: platterData(parsed.data, { active: exists.active, sortOrder: exists.sortOrder }),
  });
  res.json(platterDTO(updated, { includeCost: true }));
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
    data: { category: d.category, label: d.label, imageUrl: d.imageUrl ?? null, active: d.active ?? true, sortOrder: d.sortOrder ?? count },
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
    data: { category: d.category, label: d.label, imageUrl: d.imageUrl ?? null, active: d.active ?? exists.active, sortOrder: d.sortOrder ?? exists.sortOrder },
  });
  res.json(boardComponentDTO(updated));
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
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    try {
      res.json({ url: await persistUpload(req.file) });
    } catch (e) {
      console.error("[upload] failed", e);
      res.status(500).json({ error: "Upload failed" });
    }
  });
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
adminRouter.post("/wipe-test-data", async (_req, res) => {
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
  const rows = customers.map((c) =>
    [c.name, c.phone, c.email, c.isBigSpender ? "yes" : "no", c.referralCode]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
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
