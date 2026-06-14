# Spec v2: Kelly's Deli — Revenue-Capture Evolution

Extends [SPEC.md](SPEC.md) (v1, shipped + tested). This doc covers only the **deltas**.
Approach: **extend** the existing codebase. Prices/costs/items seed as **editable placeholders**
(set real numbers in the Menu & Pricing editor; nothing is hard-coded).

## Objective (what's new)
Turn the catering ordering app into a full revenue-capture system for a loyal, repeat,
higher-spend customer base: a self-select **choice screen**, **gift delivery**, bookable
**tastings/experiences**, **seasonal** spreads, a **first-order hook**, and an **SMS list +
blast** engine. Warm, premium, local family-deli tone throughout.

Three features that must be bulletproof (carry over + extend): **kitchen prep sheet**, the
**Menu & Pricing editor**, and the **Tastings/Experiences booking**.

## Data model changes (Prisma)

```prisma
model Platter {
  // + category: which world it belongs to
  category String @default("home") // home | events | seasonal
  // (existing: name, description, pricePerHead?, fixedPrice?, cost, serves?, minHeadcount, items, imageUrl, active, sortOrder)
}

model Experience {            // NEW — bookable tastings/experiences
  id           String  @id @default(cuid())
  name         String
  description  String
  pricePerHead Decimal @db.Decimal(10,2)
  cost         Decimal @db.Decimal(10,2) @default(0) // for margin parity with platters
  capacity     Int     @default(12)  // max guests per session = one (location,date)
  imageUrl     String?
  active       Boolean @default(true)
  sortOrder    Int     @default(0)
  orders       Order[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Order {
  // type of line
  type                     String   @default("platter") // platter | gift | experience
  // platter now OPTIONAL (experience bookings have no platter)
  platterId                String?
  experienceId             String?
  experience               Experience? @relation(fields:[experienceId], references:[id])
  // gift
  isGift                   Boolean  @default(false)
  recipientName            String?
  deliveryAddress          String?
  giftMessage              String?
  // renamed from collectionDate
  collectionOrDeliveryDate DateTime @db.Date
  // (existing fields unchanged: ref, headcount, total, deposit, depositStatus, locationId,
  //  customerName, phone, email, notes, status, src, referralCodeUsed, customerId, timestamps)
}

model Customer {
  isBigSpender Boolean @default(false) // manual admin tag (lifetime spend shown to help decide)
}

model Setting {               // NEW — global admin toggles (key/value)
  key   String @id           // e.g. "firstOrderHook", "firstOrderHookText"
  value String
}
```

## Tiers to seed (placeholder numbers, all editable)

**At Home** (`category: home`)
- Date Night In — fixed, serves 2
- Night In — fixed, serves 4–6
- Small Gathering — fixed, serves 10–15

**Events & Office** (`category: events`)
- The Big Spread — fixed, up to 20
- Office Lunch — per-head, min 10

**Seasonal** (`category: seasonal`, seeded `active:false` so owner switches on)
- A couple of examples (Christmas Spread, Summer BBQ) toggled from admin.

**Experiences**
- Cheese Tasting — per-head, capacity ~12/session.

Item pool (per the brief): sandwiches, sausage rolls, veg & lamb samosas, crusty cobs, local
produce, fruit. Each platter gets a sensible per-unit item list driving the prep sheet.

## Feature deltas

- **Choice screen** (`/`): two big buttons — 🏠 At Home, 🏢 Events & Office — + a smaller
  🧀 Tastings & Experiences entry. Categories editable/toggleable from admin (driven by which
  categories have active platters + a Setting for visibility). Routes to a filtered menu.
- **Order flow**: category → platter → qty/headcount → **collection OR gift delivery** toggle
  → date (48h min) → location → contact → notes → deposit → confirm. Gift toggle reveals
  recipient name, delivery address, gift message.
- **Experiences booking**: pick experience → date → party size → location → contact → deposit →
  confirm. Capacity enforced per (experience, location, date): Σ party size ≤ `capacity`.
  Every booking captures phone into the customer/SMS list (same upsert path as orders).
- **Seasonal toggle** (admin): list `category=seasonal` platters with active on/off.
- **First-order hook** (admin Setting): when ON, a customer's *first* catering order is flagged
  with a free-item note ("FREE: box of sausage rolls") shown on confirmation + prep sheet.
- **SMS list** (admin): view all customers (the list), CSV export, toggle **big spender** tag,
  see lifetime spend + last order. **Send a Blast**: pick a template (or write one) + audience
  (all / big spenders), stub logs the payload per recipient (Twilio hook later).
- **Profit/prep/lead-source/re-order/referral/QR**: carry over; prep sheet stays platter+gift
  (delivery) orders; dashboard gains booking counts + revenue from experiences.

## Decisions (settled at build start)
1. **Extend** existing app. ✅
2. **Editable placeholder** prices/costs/items; real numbers via the pricing editor. ✅
3. **Experience capacity** = max guests per (experience, location, date) session. Same cap
   across locations (field lives on Experience). Revisit to per-location later if needed.
4. **Gift delivery** date obeys the same 48h + per-day location capacity as collection.
5. **Big spender** = manual admin tag (not auto-threshold) for v1.
6. **collectionDate → collectionOrDeliveryDate** rename; dev DB is test-only, so migrate + reseed.

## Boundaries (delta)
- **Always:** keep money in Decimal/2dp; server-enforce 48h + capacity + deposit for orders AND
  bookings; keep prep-sheet/capacity/money/stats logic unit-tested; deactivate (never delete)
  platters/experiences to preserve order history.
- **Ask first:** further schema renames after this migration; real Stripe/Twilio.
- **Never:** charge real cards or send real SMS in v1; commit secrets; remove failing tests.

## Success criteria (delta — all testable)
- [ ] Choice screen routes to At Home / Events / Tastings; categories reflect admin toggles.
- [ ] Platter order with **gift delivery** captures recipient/address/message; appears in admin.
- [ ] **Experience booking** enforces capacity per (experience, location, date) + 48h + deposit;
      phone captured to SMS list.
- [ ] Seasonal platters toggle on/off from admin and show/hide on the customer site instantly.
- [ ] First-order hook flags a first-time customer's order with the freebie when enabled.
- [ ] SMS list viewable + CSV export; big-spender tag persists; blast logs payloads to audience.
- [ ] Prep sheet still correct (incl. gift/delivery orders); pricing editor edits platters by
      category AND experiences with live margins.
- [ ] All existing v1 tests still green; new logic (booking capacity, blast audience, first-order
      detection) unit-tested. Full app runs on the embedded Postgres and an end-to-end proof passes.
```
