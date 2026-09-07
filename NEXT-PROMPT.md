# Prompt for next session — copy everything below the line

---

Read HANDOFF.md in this project first — it has the live-site state, deploy setup, access notes and open items. The site is LIVE at https://www.kellysdeli.co.uk (Coolify, push-to-main auto-deploys, but **the deploy does NOT run database migrations — you must run `prisma migrate deploy` against prod manually after any schema change**, see memory/HANDOFF for the workflow). Use /badman for all UI work — no AI slop, the current "Family Table" design system (tokens in client/src/styles/theme.css) is the base, keep it and extend it. Verify everything in a real browser before and after deploy, and run the fresh-eyes review loop before calling anything done.

## The job: shop categories + subscriptions groundwork

### 1. Category storefront
Reorganise the shop so customers browse by OCCASION, not one flat list:

- **Hosting** — feeding a crowd (10+ people). Click in → that plan's Small / Medium / Large with clear "feeds X" guidance and the event planner promoted alongside.
- **At Home** — smaller boards with personality names. Seed these (owner can rename in admin): "The Date Night", "The Too Hot to Cook", "The Sunday Graze", "The Movie Night", "The Just Because". Come up with 2–3 more; keep the family-deli voice, no cringe.
- **Office & Corporate** — platters for workplaces: order for a meeting, or set up a **standing weekly/monthly platter** for the office. Next-day delivery angle for corporate (the deli's normal rule is 48h collection — corporate standing orders can promise "delivered next working day" only if the owner confirms; until then copy says "delivery available for regular office orders — we'll confirm your schedule"). Include a proper corporate enquiry path (company name, headcount, frequency) that lands in admin.

Requirements:
- Categories must be a **data model** (Prisma schema + admin UI in MenuEditor), not hardcoded — the owner needs to add/rename categories and assign boards in the admin panel. Migration + seed carefully (shared dev/prod DB — use the local embedded-postgres test workflow first, then `prisma migrate deploy` on prod).
- Category landing pages need proper SEO (title/meta/canonical per category, sitemap entries, structured data) since each category is a search landing page ("office catering solihull", "date night grazing board" etc.).
- Keep every existing URL working (301/redirect or keep routes) — the site has indexed pages and live traffic.
- Don't break the existing order flow, Smart Cart drawer, or event planner — they all read the same kd-cart.

### 2. Subscribe & Save (payment-ready, not payment-live)
Add subscription options across the products WITHOUT taking card details yet:

- Every board/platter gets an optional **"Subscribe & save 10%"** purchase mode (weekly / fortnightly / monthly frequency picker). Data model: subscription intent on the order (frequency, discount applied), flows through cart → checkout → admin so the owner sees "recurring" orders distinctly.
- Corporate = the same mechanism with invoicing copy ("we'll invoice monthly").
- **Honesty rule: do not promise automated billing that doesn't exist.** Copy frames it as "we'll set your schedule up with you and confirm each delivery" until Stripe lands. No fake "manage subscription" UI.
- **Birthday / celebration pre-book**: a "book ahead" flow — pick a future date months out, pay the 25% deposit, optional gift note. Mostly exists (calendar + deposit) — surface it as its own selling point ("Birthday coming up? Book the board now, sorted.").
- Get creative beyond this where it's honest and buildable: e.g. "never miss it" reminder capture (email before Mother's Day/Christmas), gift-a-board with a printed note, loyalty nudge on the confirmation page. Propose, build the best ones.

### 3. Stripe-ready plumbing (no live payments yet)
Structure the server so dropping Stripe in later is a config change, not a rebuild:
- A payments module boundary on the server (create-payment-intent / webhook route stubs, STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET as optional env vars that no-op when absent — NEVER make them boot requirements, the site must start without them).
- Order model already has deposit/depositStatus — extend so a future webhook can mark deposits paid automatically.
- Subscription model designed to map cleanly onto Stripe Billing (price/frequency/status fields).

### Constraints & gotchas (learned the hard way)
- Shared dev/prod database; prod admin API works but the permission classifier blocks it until the user explicitly approves — ask, then retry.
- Local testing: embedded postgres on :5433 with inline DATABASE_URL; DISABLE_RATE_LIMIT=1 for E2E; ~12 server tests fail on admin login (known password drift, ignore).
- Owner is non-technical: everything customer-facing must be editable in the admin panel, and reports to them in plain English.
- Real data only — no fake reviews, counters, or urgency. The 4.7★/47 Google rating and the 48h/25% deposit rules are real; use them.
- Still outstanding from the owner (chase if relevant): real board photos, phone number, Google review quotes, real ingredient lists per board. Test order KD-539R66 may still need deleting from admin.

Work autonomously, commit in sensible increments, verify live after each deploy, and finish with the honest reviewer scorecard + a plain-English summary.
