# Implementation Plan: Kelly's Deli Catering App

Spec: [SPEC.md](SPEC.md). Built in vertical slices, dependency-ordered, following the 5 priorities.

## Architecture Decisions
- **Monorepo / npm workspaces:** `client/` (Vite) + `server/` (Express+Prisma). One `npm run dev` boots both.
- **Business logic in `server/src/lib/`** (money, capacity, prep-sheet, ref, referral) — pure, Express-free, unit-tested. Routes stay thin.
- **Shared types:** order/platter/location DTOs defined server-side; client has a typed `api.ts` mirror (small surface, no shared package for MVP).
- **Stubs behind interfaces:** `payments.ts` (capture intent → pending) and `notify.ts` (log payload) so Stripe/Twilio/Resend drop in later.
- **Capacity = per-day** (settled). Availability computed from non-cancelled order counts per (location, date).

## Dependency graph
```
schema + seed ──> lib (money/capacity/prep/ref) ──> API (public + admin) ──> client api.ts ──> UI
                                                  └─> auth (JWT) ──────────┘
```

## Task List

### Phase 1 — Foundation (Priority 1)
- **T1. Scaffold monorepo.** Root workspaces + scripts (`dev`, `dev:server`, `dev:client`), `.gitignore`, `.env.example`, docker-compose Postgres snippet, README quickstart.
  - Accept: `npm install` works; `npm run dev` starts both (API health route + Vite page).
  - Verify: hit `GET /api/health` → 200; Vite dev page loads. Files: root `package.json`, `client/`, `server/` scaffolds.
- **T2. Prisma schema + migrate.** All 6 models per spec (Location, Platter, Order, Customer, User, Referral).
  - Accept: `prisma migrate dev` applies clean; client generated. Verify: `prisma studio` shows tables. Files: `server/prisma/schema.prisma`.
- **T3. Seed.** 3 locations (Bentley Heath, Henley-in-Arden, Stratford-upon-Avon), 3 platters (Office Lunch £8.50/head min 10; Gathering £175 serves 15–20; Big One £350) with cost + item lists, 1 admin user (hashed pw).
  - Accept: `npm run db:seed` populates; re-runnable (upsert). Verify: query counts. Files: `server/prisma/seed.ts`.

**Checkpoint A:** migrate + seed clean; health route green.

### Phase 2 — Core libs + customer order flow (Priority 2)
- **T4. Money + ref libs + tests.** `calcTotal` (fixed vs per-head), `calcDeposit` (25%), `calcMargin`, `genRef` (KD-xxxxxx).
  - Accept: Vitest covers fixed/per-head/referral-discount/margin edge cases. Verify: `npm test`. Files: `server/src/lib/money.ts`, `ref.ts`, tests.
- **T5. Capacity lib + tests.** `getAvailability(locationId, dateRange)` → per-date remaining; `isDateBookable` (≥48h + under capacity, cancelled excluded).
  - Accept: tests cover at-capacity, over, <48h, cancelled-excluded. Verify: `npm test`. Files: `server/src/lib/capacity.ts`, test.
- **T6. Public API.** `GET /api/platters` (active only), `GET /api/locations`, `GET /api/availability?locationId&from&to`, `POST /api/orders` (server-side validate 48h + capacity + minHeadcount + deposit; create/match Customer by phone/email; capture deposit intent stub; trigger order-received notify stub; return ref), `GET /api/orders/:ref`.
  - Accept: order creation rejects <48h, over-capacity, below-min; returns ref + deposit. supertest covers happy + each rejection. Verify: `npm test`. Files: `server/src/routes/public.ts`, `lib/payments.ts`, `lib/notify.ts`.
- **T7. Client shell + landing.** Router, mobile-first theme (warm deli aesthetic), `api.ts`, landing page with 3 platter cards from DB (photo/desc/items/price).
  - Accept: landing renders live platters on mobile viewport. Verify: manual. Files: `client/src/lib/api.ts`, `pages/Landing.tsx`, theme.
- **T8. Order flow UI.** Stepper: platter → headcount/headcount-or-fixed → capacity calendar (urgency + blocks) → location → name/phone/email/notes → review (total + 25% deposit) → deposit stub → confirmation (ref + logged notify). Carries `src` from query string.
  - Accept: full happy path completes <60s on mobile; calendar reflects availability + blocks full/<48h dates. Verify: manual e2e. Files: `pages/Order.tsx`, `Confirm.tsx`, `components/CapacityCalendar.tsx`.

**Checkpoint B:** customer can place a real order end-to-end; order appears in DB with correct total/deposit/ref/src.

### Phase 3 — Admin + prep sheet + profit (Priority 3)
- **T9. Auth.** `POST /api/auth/login` (bcrypt + JWT), `requireAdmin` middleware. Client login page + token storage + protected routes.
  - Accept: bad creds 401; valid → token; admin routes 401 without token. supertest covers. Files: `routes/auth.ts`, `lib/auth.ts`, `pages/admin/Login.tsx`.
- **T10. Admin order list + status.** `GET /api/admin/orders?location&date&status`, `PATCH /api/admin/orders/:id/status` (new→confirmed→in_prep→ready→completed). Completing triggers review+referral notify stubs.
  - Accept: filters work; status transitions persist; completion logs review+referral payloads + creates customer referral code. Files: `routes/admin.ts`, `pages/admin/Orders.tsx`.
- **T11. Prep sheet (KILLER).** `prep-sheet.ts` aggregates (location,date) non-cancelled orders → summed item list scaled by headcount (per-head) / unit (fixed). `GET /api/admin/prep-sheet?locationId&date`. Printable admin page.
  - Accept: unit tests prove aggregation across mixed platters/headcounts; worked example matches by hand. Printable layout. Verify: `npm test` + manual print preview. Files: `lib/prep-sheet.ts` + test, `routes/admin.ts`, `pages/admin/PrepSheet.tsx`.
- **T12. Profit + lead-source views.** `GET /api/admin/stats` → per-order profit, per-platter profit ranked by margin, weekly/monthly revenue+profit+count per location & combined, and `src` breakdown.
  - Accept: numbers reconcile with seeded/test orders. Files: `routes/admin.ts`, `pages/admin/Dashboard.tsx`.

**Checkpoint C:** owner logs in, manages orders, prints a correct prep sheet, sees profit + lead sources.

### Phase 4 — Live pricing editor (Priority 4)
- **T13. Menu/pricing CRUD API.** `POST/PATCH /api/admin/platters` (name/desc/pricePerHead/fixedPrice/cost/serves/minHeadcount/items add-remove-reorder/active toggle), `PATCH /api/admin/locations/:id` (weeklyCapacity, active). Deactivate hides from customers, preserves orders.
  - Accept: edits persist + reflect on `GET /api/platters` immediately; deactivated platter hidden from customers but historical orders intact. supertest. Files: `routes/admin.ts`.
- **T14. Pricing editor UI (KILLER).** Mobile-friendly editor: big inputs, live "Profit £X / Y% margin" as you type price/cost, item add/remove/reorder, active toggle, add platter, per-location capacity edit, clear Save.
  - Accept: margin recomputes live; save → customer landing updates with no redeploy. Verify: manual. Files: `pages/admin/MenuEditor.tsx`, `components/MarginMeter.tsx`.

**Checkpoint D:** owner edits a price on mobile; customer site reflects it.

### Phase 5 — Growth engine (Priority 5)
- **T15. QR src tracking.** `/order?src=...` captured through flow → stored on order; documented QR target `/order?src=counter`. Admin lead-source breakdown (from T12) verified.
  - Accept: order from `?src=counter` shows under QR in breakdown. Files: order flow + dashboard (mostly wiring).
- **T16. Re-order.** `GET /api/reorder?phone=|email=` → last order summary; landing/order shows "Re-order your usual?" pre-fill.
  - Accept: returning phone/email pre-fills platter/headcount/location/notes. supertest + manual. Files: `routes/public.ts`, order UI.
- **T17. Referral codes + redemption.** Code per customer (on first order/completion); `POST /api/orders` accepts `referralCodeUsed` → £15 off (recompute deposit), record `Referral`; referral offer text on completion + confirmation share link.
  - Accept: valid code discounts total + logs redemption; invalid ignored. tests cover discount math. Files: `lib/referral.ts` + test, `routes/public.ts`.
- **T18. Last-minute slots panel.** `GET /api/admin/fill-slots` → per-location dates within 48h under capacity + copy-paste promo string. Admin panel with copy button.
  - Accept: sub-capacity near dates listed with promo text. Files: `routes/admin.ts`, `pages/admin/FillSlots.tsx`.

**Checkpoint E (Complete):** all success criteria in SPEC met; money/capacity/prep-sheet/referral tests green; build clean.

## Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Money float drift | High | `Decimal` in DB, single `money.ts` helper, 2dp, unit tests |
| Prep-sheet wrong aggregation | High (killer feature) | Pure function + exhaustive unit tests + worked example before UI |
| Capacity race / off-by-one | Med | Centralized `capacity.ts`, server-enforced, cancelled excluded, tests |
| No DATABASE_URL locally | Med (blocks run) | `.env.example` + docker compose Postgres; code complete regardless |
| Vercel full-stack split | Low (MVP) | Standalone Express now; serverless adapter documented as follow-up |

## Parallelizable later
Once API contracts exist (after T6/T9): admin UI screens (T10–T14 UIs) and growth panels (T18) are independent slices.
