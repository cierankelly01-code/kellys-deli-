# Implementation Plan v2 — Kelly's Deli Revenue-Capture

Extends [PLAN.md](PLAN.md). Spec: [SPEC-v2.md](SPEC-v2.md). Dependency-ordered, vertical slices.

### Phase A — Schema + seed (foundation)
- A1. Migrate schema: Platter.category; new Experience + Setting models; Order gains
  type/experienceId/isGift/recipient/deliveryAddress/giftMessage, platterId→optional,
  collectionDate→collectionOrDeliveryDate; Customer.isBigSpender.
- A2. Reseed: 3 locations; tiers (Date Night In, Night In, Small Gathering [home]; The Big
  Spread, Office Lunch [events]; 2 seasonal inactive); Cheese Tasting experience; settings
  (firstOrderHook off + text); admin + demo users.
- Verify: `migrate dev` clean, `db:seed` ok, existing tests still green after code updates.

### Phase B — Choice screen + order flow (gift) + experience booking
- B1. Public API: platters filterable by `category`; experiences list; availability reused for
  experiences (per experience+location+date capacity); create-order extended for type/gift;
  create-booking endpoint (type=experience) with capacity enforcement.
- B2. Choice screen `/` + category menu pages; order flow gift toggle + delivery fields + date
  rename; experience booking flow.
- Verify: gift order + experience booking end-to-end against DB.

### Phase C — Admin: bookings, pricing editor (category + experiences), toggles
- C1. Admin order list shows type (platter/gift/experience) + gift/recipient; filters.
- C2. Pricing editor: edit platter category; manage experiences (CRUD + live margin); seasonal
  toggle screen; first-order hook setting toggle.
- Verify: edits reflect on customer site; seasonal on/off shows/hides.

### Phase D — SMS list + blast + big-spender
- D1. API: customers list (w/ lifetime spend + lastOrder), toggle isBigSpender, CSV export,
  send-blast (audience all|big_spenders, template) → log payloads.
- D2. Admin SMS screens: list/export/tag + Send a Blast.
- Verify: tag persists; blast logs N payloads to chosen audience.

### Phase E — First-order hook + prep/profit incl. new types + prove
- E1. First-order detection on order create (no prior orders for phone) → freebie note when
  setting on; surface on confirmation + prep sheet. Prep sheet includes gift/delivery orders.
- E2. Extend end-to-end proof script for gift, booking-capacity, seasonal, blast, first-order.
- Verify: full `npm test` + `node scripts/prove.mjs` green on live DB.

## Risks
| Risk | Mitigation |
|---|---|
| Migration rename loses test data | Dev-only DB; reseed after migrate |
| Order model now polymorphic (platter/gift/experience) | `type` discriminator + optional FKs; serialize per type; tests per branch |
| Booking capacity vs platter capacity confusion | Separate capacity calc for experiences (Σ partySize per session); unit-tested |
| Prep sheet must ignore experiences but include gifts | Filter by type in query; test |
