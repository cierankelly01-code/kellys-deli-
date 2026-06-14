# Spec: Kelly's Deli — Catering Ordering & Growth App

## Objective

A mobile-first, full-stack web app for a multi-location deli (Kelly's Deli) that does three jobs:

1. **Order** — customers browse 3 platter tiers, order in under 60s, and pay a 25% deposit (stubbed).
2. **Grow** — every walk-in becomes a tracked catering lead (QR `src`), completed orders trigger review + referral prompts, and idle kitchen capacity gets surfaced for fill.
3. **Run** — staff manage orders, auto-generate kitchen prep sheets, edit menu/pricing live, and see profit (not just revenue) per order and per platter.

**Users**
- **Customer** — anonymous (no login). Identified by phone/email. Places orders, re-orders, redeems referral codes.
- **Admin/Staff** — authenticated (JWT). Manages orders, prep sheets, pricing, capacity, and growth panels.

**Success looks like:** a deli owner can take a real catering order on a phone end-to-end, print a correct kitchen prep sheet for a given day+location, and change a platter price from their phone with the customer site reflecting it immediately — with no redeploy.

The three features that must be bulletproof: **kitchen prep sheet**, **walk-in QR capture/tracking**, **live pricing editor**.

## Tech Stack

- **Frontend:** React 18 + Vite, **TypeScript**, React Router, mobile-first CSS (lightweight — CSS modules / utility classes, no heavy UI kit).
- **Backend:** Node + Express, **TypeScript**, Prisma ORM.
- **Database:** PostgreSQL (Supabase in prod; any Postgres locally via `DATABASE_URL`).
- **Auth:** JWT, role-based (`admin` only; customers are anonymous).
- **Hosting:** Vercel (frontend). API runs as standalone Express for the MVP; Vercel serverless adapter is a documented follow-up.
- **Payments:** stubbed — capture intent, mark `deposit pending`. Clean `PaymentProvider` interface so Stripe drops in later.
- **Notifications:** SMS/email stubbed — `notify()` logs the payload. Clean interface for Twilio/Resend later.

## Commands

```
# from repo root (npm workspaces)
npm install                  # install client + server
npm run dev                  # run API + client together (concurrently)
npm run dev:server           # API only
npm run dev:client           # Vite only

# server/
npm run db:migrate           # prisma migrate dev
npm run db:seed              # seed 3 locations + 3 platters + admin user
npm run db:reset             # reset + migrate + seed
npm run build                # tsc build
npm test                     # vitest (unit) + supertest (api)

# client/
npm run build                # vite build
npm test                     # vitest
npm run lint
```

## Project Structure

```
ai2/
  client/                     React + Vite (deploys to Vercel)
    src/
      pages/                  Route-level screens (Landing, Order, Confirm, Admin/*)
      components/             Reusable UI (PlatterCard, CapacityCalendar, MarginMeter…)
      lib/                    api client, formatting, money helpers
  server/
    src/
      routes/                 express routers (platters, orders, auth, admin, locations)
      lib/                    auth (jwt), payments (stub), notify (stub), capacity, prep-sheet, money
      index.ts                express app entry
    prisma/
      schema.prisma
      seed.ts
    tests/                    vitest + supertest
  docs/
    SPEC.md                   this file
  package.json                root workspaces + dev scripts
```

## Data Model (Prisma)

Honoring the required model. Money stored as `Decimal` (Postgres `Decimal`, 2dp) to avoid float errors.

```prisma
model Location {
  id            String  @id @default(cuid())
  name          String
  slug          String  @unique
  weeklyCapacity Int     // SEE DECISION #2: operative meaning = max catering orders per DAY
  active        Boolean @default(true)
  orders        Order[]
}

model Platter {
  id           String   @id @default(cuid())
  name         String
  description  String
  pricePerHead Decimal? @db.Decimal(10,2)   // null for fixed-price platters
  fixedPrice   Decimal? @db.Decimal(10,2)   // null for per-head platters
  cost         Decimal  @db.Decimal(10,2)   // owner's cost to produce — drives margin
  serves       String?  // e.g. "15-20" (display); minHeadcount drives validation
  minHeadcount Int      @default(1)
  items        Json     // ordered list of {label, qtyPerUnit?} for prep aggregation
  imageUrl     String?
  active       Boolean  @default(true)
  orders       Order[]
}

model Order {
  id              String   @id @default(cuid())
  ref             String   @unique           // e.g. KD-7F3K9Q
  platterId       String
  platter         Platter  @relation(fields:[platterId], references:[id])
  headcount       Int
  total           Decimal  @db.Decimal(10,2)
  deposit         Decimal  @db.Decimal(10,2)
  depositStatus   String   @default("pending") // pending | paid | refunded
  collectionDate  DateTime @db.Date
  locationId      String
  location        Location @relation(fields:[locationId], references:[id])
  customerName    String
  phone           String
  email           String
  notes           String?
  status          String   @default("new")  // new|confirmed|in_prep|ready|completed|cancelled
  src             String   @default("direct")// direct|qr|instagram|referral
  referralCodeUsed String?
  customerId      String?
  customer        Customer? @relation(fields:[customerId], references:[id])
  createdAt       DateTime @default(now())
  @@index([locationId, collectionDate])
  @@index([src])
}

model Customer {
  id           String  @id @default(cuid())
  name         String
  phone        String  @unique
  email        String
  referralCode String  @unique     // their own code to share
  lastOrderId  String?
  orders       Order[]
}

model User {            // staff/admin login
  id           String  @id @default(cuid())
  email        String  @unique
  passwordHash String
  role         String  @default("admin")
  createdAt    DateTime @default(now())
}

model Referral {        // tracks redemptions of a customer's code
  id           String   @id @default(cuid())
  code         String
  orderId      String   @unique
  discount     Decimal  @db.Decimal(10,2)
  createdAt    DateTime @default(now())
}
```

## Core Logic / Business Rules

- **Total:** per-head platter = `pricePerHead * headcount`; fixed platter = `fixedPrice`. Headcount must be ≥ `minHeadcount`.
- **Deposit:** `round(total * 0.25, 2)`. No order confirms without a captured (stubbed) deposit intent.
- **Referral discount:** valid code → £15 off `total` (recompute deposit on discounted total). Both parties get £15 (referrer credit tracked; redemption recorded in `Referral`).
- **48hr rule:** `collectionDate` must be ≥ 48h from now. Enforced client + server.
- **Capacity / availability** (DECISION #2): a date is available at a location if `count(active orders for that location+date) < location.weeklyCapacity`. Remaining = `capacity − count`. UI shows urgency when remaining ≤ 2 ("Only N slots left").
- **Prep sheet:** for a (location, date), aggregate all non-cancelled orders → sum each platter's `items` scaled by headcount (per-head) or by 1 unit (fixed) → one picking list. Bulletproofed with unit tests.
- **Order ref:** `KD-` + 6 base32 chars, collision-checked.
- **Last-minute slots:** for each location, any date within next 48h that is below capacity → flagged on admin panel with a copy-paste promo string.

## Code Style

TypeScript throughout. Money via a single `money.ts` helper (Prisma Decimal ↔ number, always 2dp). Example:

```ts
// server/src/lib/money.ts
export const toMoney = (n: number) => Number(n.toFixed(2));
export const calcTotal = (p: PlatterPricing, headcount: number): number =>
  p.fixedPrice != null ? toMoney(p.fixedPrice) : toMoney(p.pricePerHead! * headcount);
export const calcDeposit = (total: number) => toMoney(total * 0.25);
export const calcMargin = (price: number, cost: number) => ({
  profit: toMoney(price - cost),
  marginPct: price > 0 ? Math.round(((price - cost) / price) * 100) : 0,
});
```

Conventions: named exports, `camelCase` vars, `PascalCase` components, route handlers thin (validation + lib call), business logic in `lib/` (unit-testable, no Express coupling).

## Testing Strategy

- **Framework:** Vitest (both packages) + supertest (API).
- **Focus the tests where correctness bites** (don't chase coverage on UI glue):
  - `money` — total, deposit, margin calc (incl. fixed vs per-head, referral discount).
  - `capacity` — availability + remaining-slots edge cases (at capacity, over, cancelled excluded).
  - `prep-sheet` — aggregation across mixed orders/platters (the killer feature).
  - API: order creation enforces 48h + capacity + deposit; admin routes require JWT.
- Tests live in `server/tests/` and co-located `*.test.ts` for client logic.

## Boundaries

- **Always:** validate inputs server-side (never trust client), enforce 48h + capacity + deposit on the server, keep money in `Decimal`/2dp, run prep-sheet + capacity + money tests before declaring those features done.
- **Ask first:** adding heavy dependencies (UI kits, state libs), changing the required data-model field names, introducing real Stripe/Twilio/Resend, schema-breaking migrations after data exists.
- **Never:** commit secrets (`.env` gitignored), process real card payments in v1, hide a platter by deleting it (use `active=false` to preserve order history), remove failing tests to go green.

## Success Criteria

- [ ] `npm run dev` boots client + API; `npm run db:reset` seeds 3 locations + 3 platters + 1 admin.
- [ ] Customer can complete an order on mobile in <60s: platter → headcount/date → location → details → deposit stub → confirmation with `KD-` ref. Confirmation logs a stubbed SMS/email payload.
- [ ] Calendar blocks dates <48h out and dates at capacity; shows "Only N slots left" urgency.
- [ ] `/order?src=counter` (or `?src=qr`) records `src` on the order; admin lead-source breakdown reflects it.
- [ ] Returning phone/email → "Re-order your usual?" pre-fills last order.
- [ ] Admin (JWT) sees filterable order list with the 5-stage status flow.
- [ ] **Prep sheet:** for a chosen location+date, produces a correct aggregated picking list (verified by unit tests + a worked example).
- [ ] **Profit view:** per-order profit, per-platter profit ranked by margin, weekly/monthly revenue+profit+count per location and combined.
- [ ] **Pricing editor:** owner edits name/description/prices/cost/items/minHeadcount + location capacity; live "Profit £X / Y% margin" updates as they type; toggle active; saves to DB and customer site reflects immediately.
- [ ] Marking an order Completed triggers (stubbed/logged) review request + referral offer; referral code generated per customer; redemptions tracked.
- [ ] Admin "Fill These Slots" panel lists sub-capacity dates within 48h with copy-paste promo text.

## Decisions (settled at build start)

1. **TypeScript** end-to-end across Prisma+Express+React. ✅ confirmed (default).
2. **Capacity semantics:** ✅ **per-day**. `weeklyCapacity` field kept per the required data model; operative meaning = **max catering orders per DAY per location**. A date is full when that day's non-cancelled order count reaches it. Remaining = `capacity − count`; urgency shown when remaining ≤ 2.
3. **Customers don't log in** — anonymous, matched by phone/email (data model has no customer password). Only staff authenticate. ✅ confirmed.
4. **Operating days:** calendar offers the next 21 days, every day selectable subject to 48h + capacity. (Can restrict to Mon–Sat later.)
5. **Local Postgres:** user provides `DATABASE_URL` (Supabase or local Docker Postgres). Repo ships `.env.example` + a docker compose snippet so it runs without Supabase creds.
6. **Platter images:** seed with placeholder image URLs; real photos dropped in via the pricing editor later.
```
