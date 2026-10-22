# Kelly's Deli storefront — DESIGN BRIEF ONLY (no code changes)

You are acting as a senior product designer + UX lead. Your ONLY deliverable is a written
design plan. Do NOT edit, create, or delete any source files, do NOT run migrations, seeds,
installs, builds, or tests, and do NOT touch the database. Another engineer will implement
your plan from the document you write. Write the plan to exactly one file:

    docs/2026-09-storefront-plan.md

If you find yourself about to change anything else, stop — that is out of scope.

## The business

Kelly's Deli is a real, live, family-run deli in the UK selling sharing boards / platters
(grazing boards, sandwich platters, etc.), bread pre-orders, and catering. The shop is
https://www.kellysdeli.co.uk (public, no password). The owner is not a developer.

Core facts about the customers (design for THESE people, not for a tech audience):
- Most are 40+, many 50s–60s.
- Most order on a PHONE. Mobile is the primary device, desktop secondary.
- They are ordering for something that matters (a birthday, a wake, a christening, an
  office lunch). They want reassurance, clear prices, clear delivery info, and few
  decisions. They do not want clever UI.

## What the owner wants

1. **Business / office / corporate catering as a proper, findable area.**
   The site currently has a "corporate enquiry" form buried inside one shop category
   (`client/src/pages/ShopCategory.tsx` → `client/src/components/CorporateEnquiryForm.tsx`,
   backed by the `CorporateEnquiry` Prisma model and an admin Enquiries page). The owner
   wants office/business catering to be an obvious, first-class destination: clear
   entry point from the home page and nav, its own landing page, plain-English positioning
   (decide the right label — "Office catering", "Business catering", "Corporate catering" —
   and justify it for a 40+ UK audience), what a PA / office manager needs to see in the
   first 10 seconds (headcount guidance, lead time, delivery, dietary, invoicing/repeat
   orders), and a clear path to either order boards directly or send an enquiry.

2. **Boards stay in their normal categories** — the existing category structure
   (`/shop` → `/shop/:slug` → `/platter/:id`) is right and should be kept. Improve it,
   don't replace it. Note: one shop tile per product; size variants share
   `Platter.variantGroup` and are chosen on the product page.

3. **Up to date.** It should feel like a current, premium food brand in 2026 — not a
   template, not "AI-generated", not cluttered. Product photography first, generous
   whitespace, one accent colour, real typography hierarchy.

4. **Nice and easy to navigate.** Fewer, clearer choices. Obvious "where am I / what next".
   Sticky, thumb-reachable primary action on mobile. Large tap targets, readable type
   (assume reading glasses), high contrast, no hover-only interactions.

5. **Mobile-optimised throughout.** Audit the real site at 375px and 390px widths as
   the primary case, then tablet, then desktop.

## The codebase (read, don't touch)

- Monorepo: `client/` (React + Vite + react-router SPA, TypeScript) and `server/`
  (Express + Prisma + Postgres). Client and API are served from the same origin.
- Storefront routes are in `client/src/App.tsx` (`/`, `/shop`, `/shop/:slug`,
  `/platter/:id`, `/plan`, `/order`, `/confirm/:ref`, `/bread`). Pages in
  `client/src/pages/`, components in `client/src/components/`.
- Design tokens: `client/src/styles/tokens.css`; editorial layouts `client/src/styles/editorial.css`.
  A navy-based redesign already landed — see `docs/2026-09-redesign.md` for what exists
  (home page signature groups, bundles, basket extras, videos, reminders, sticky CTA).
- Data model: `server/prisma/schema.prisma` (Platter, Category, PlatterCategory, AddOn,
  Bundle, CorporateEnquiry, BreadProduct, Order…). Product content is admin-managed, so
  prefer designs that work with existing admin-editable fields; if you need a new field,
  say so explicitly and keep it minimal.
- Existing components worth knowing: `Header.tsx`, `StickyCta.tsx`, `CartDrawer.tsx`,
  `Trust.tsx`, `Faq.tsx`, `CorporateEnquiryForm.tsx`, `SubscribeSave.tsx`, `GiftVoucher.tsx`.

## How to work

1. Open the live site in a 375px-wide viewport and walk the full journey as a 55-year-old
   on a phone: home → find office catering → find a board → pick size → basket → checkout.
   Also walk it as someone ordering a birthday board. Record every point of friction with
   the page/route and the specific problem.
2. Read the storefront pages and components listed above so your recommendations name
   real files and real components.
3. Look at 3–4 current best-in-class UK food/catering sites for reference (e.g. premium
   grazing/platter companies, an office-catering specialist, a strong independent deli).
   Cite them by name and say specifically what to borrow — no vague "make it premium".
4. Then write the plan.

## What the plan must contain (use these headings)

1. **Summary** — 5 bullets max: what's wrong today, what we're going to do.
2. **Audit findings** — table: route/page, device, problem, severity (blocker / major / minor).
3. **Information architecture** — the proposed nav and page map (mobile nav first). Where
   business catering sits, where boards sit, where bread sits. Exact labels.
4. **Business catering** — the landing page, section by section, with the actual copy
   direction, what data it needs, the CTA(s), and how it links to the existing enquiry
   form and to ordering boards directly. Say which admin-editable fields it uses.
5. **Home page** — proposed section order for mobile, with what each section is for.
6. **Shop, category and product pages** — what changes, keeping the category structure.
   Include the size-variant picker and the "will this feed everyone?" guidance.
7. **Basket and checkout on mobile** — friction fixes only; no new payment flows.
8. **Visual system** — type scale (with minimum sizes for 40+ readers), spacing, colour
   usage, image ratios, button/tap-target sizes, contrast targets. Reference `tokens.css`.
9. **Accessibility & readability** — concrete rules (min 16px body, 44px targets, focus
   states, no hover-only, reduced-motion, etc.).
10. **Implementation plan for the engineer** — ordered list of small, independently
    shippable tasks. For each: title, files likely touched, acceptance criteria written
    as things you can check in a browser, and a rough size (S/M/L). Put the highest
    customer-impact items first. Aim for 8–15 tasks.
11. **Out of scope / do not do** — anything you considered and rejected, and why.

## Rules

- Be specific and opinionated. "Consider improving the hero" is useless; "Replace the
  two-line hero headline with a single line + one CTA 'Order a board', move the office
  catering tile to position 2 on mobile" is useful.
- Every recommendation must be doable inside this React/Express app by one engineer.
  No CMS migration, no Shopify, no framework changes, no new payment providers.
- Do not invent reviews, awards, or offers. Do not write fake testimonials.
- British English. Plain language. This document will be read by the owner too.
- Do not modify any file except the one plan file. Do not run anything that writes.
