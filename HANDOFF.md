# Handoff — Kelly's Deli storefront

Last updated 2026-07-15. (The previous version of this file described the Vercel era and was badly stale — do not trust old copies.)

## Current state: LIVE ✅

- **Live site: https://www.kellysdeli.co.uk** — self-hosted on Coolify (user's server, 178.105.58.81), NOT Vercel anymore.
- The domain is **kellysdeli.co.uk**. We do NOT own kellysdeli.com (it's someone else's, GoDaddy-parked). All SEO repointed to .co.uk on 2026-07-15.
- GoDaddy DNS: A `@` and `www` → 178.105.58.81 (already correct, don't touch).
- Deploys: push to `main` on github.com/cierankelly01-code/kellys-deli- → Coolify webhook builds from source (~3-5 min). `client/dist` is gitignored; Express serves it same-origin.
- Verified 2026-07-15 end-to-end on production: platters → basket (persists across reload) → 5-step order flow → confirmation (test order **KD-539R66**, to be deleted from admin). FAQ, referral offer, opening hours, LocalBusiness/FAQPage/Product JSON-LD all live.

## Open items

1. **Delete test order KD-539R66** from admin Orders.
2. Real board photos to replace stock (owner, via admin Menu & Pricing). Current stock images were verified-accurate on 2026-07-15 (three mismatched ones swapped via admin API with user approval).
3. Owner assets for the last conversion gaps: shop phone number, permission + text of 2–3 real Google review quotes, real ingredient lists for boards ("savoury selection" is too vague at £70).
4. Architectural (bigger job): the SPA serves an empty shell to crawlers — prerender/SSG the 5 public routes, serve images as `<img>` with alt (all are CSS backgrounds today), self-host images, return real 404 status codes.
5. Board filters on /platters (deferred — boards lack type/size tags).

## 2026-07-15 redesign (BADMAN pass, three independent review rounds)

Shipped: The Family Table design layer (tokens, reveals, view-transition card→PDP morph), rebuilt hero (H1 = selling line), how-it-works, Family Promise guarantee band, honest deadline chip, linked 4.7★ Google badge, trust chips, wide desktop layout + 3-up grid, real header nav + basket pill, designed footer (names all three shops: Bentley Heath/Henley-in-Arden/Stratford-upon-Avon), custom 404, PDP two-column buy layout, **Smart Cart drawer** (Rebuy-style: steppers, add-on upsells, deposit maths, checkout continuity via kd-cart). Apex domain kellysdeli.co.uk → www redirect live. Fixed: UA-default buttons, planner self-contradiction (client tops up suggestion by its own feeds metric), AA contrast golds, sticky-CTA/footer overlap, 375px header wrap.

## Access notes

- GoDaddy: sign in with Google (cierankelly01@gmail.com). The saved username/password (jess332211) is stale and fails.
- Coolify: user login only; not stored anywhere Claude can reach.
- Admin owner password: `server/.env` ADMIN_PASSWORD (matches live DB; the *test* DB drift is a separate known issue).
- User is non-technical, dictates via voice-to-text; wants fast execution and plain-English reports.
