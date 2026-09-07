# Pre-go-live audit prompt — copy everything below the line into Claude Code

---

Read HANDOFF.md first for the live-site state and access notes. This is the Kelly's Deli shop, LIVE at https://www.kellysdeli.co.uk (Coolify on the owner's server, push-to-main auto-deploys, deploys do NOT run DB migrations). Today's job is a full pre-launch audit: the owner wants to start sending real customers here today, so the site must be checked properly for code correctness, secret leaks, and security holes — then fixed.

Start by invoking /cso for the security audit protocol, and follow this brief on top of it.

## Scope — check ALL of it, in this order

### A. Secret & leak sweep (do this first — highest stakes)
1. Scan the ENTIRE repo AND full git history (`git log -p`, all branches) for: passwords, API keys, tokens, connection strings, JWT secrets, email/SMS credentials. The DB password and admin password have been pasted around in past sessions — confirm whether anything sensitive is committed, and if so treat it as burned: rotate it (flag to owner), don't just delete the file.
2. Check what the production BUILD ships to browsers: grep client/dist for secrets, internal URLs, admin hints. Check source maps aren't exposing server code.
3. Check the live site doesn't leak: error responses (stack traces?), verbose headers, /uploads directory listing, .env or .git accessible over HTTP (test https://www.kellysdeli.co.uk/.env, /.git/config, /server/.env etc.).

### B. Security audit (server)
1. Auth: JWT handling (secret strength, expiry, algorithm), the WEAK_SECRET fallback in server/src/lib/env.ts — confirm production can never silently run on the fallback secret; if it can, fix so prod REFUSES weak secrets (but never break boot on missing optional vars — CLIENT_ORIGIN must stay optional).
2. Admin routes: every /api/admin route behind requireAdmin, no IDOR (can one object's ID access another's?), login rate-limited, no user enumeration in error messages.
3. Input validation: every route body/query/param through zod; file/image URL fields can't be abused (SSRF via imageUrl? script injection via stored strings rendered in the client?).
4. Injection: Prisma parameterisation everywhere (no raw queries), XSS in any place user/admin-entered text renders (descriptions, notes, names — check dangerouslySetInnerHTML anywhere, and the JSON-LD injection on the platter page).
5. Rate limiting & DoS: order creation, enquiry, login, and the public endpoints — limits sane? Body size capped? The 1mb JSON cap is there — confirm it covers all routes.
6. CORS config, security headers (helmet or equivalent: CSP, X-Frame-Options, HSTS), cookie flags if any.
7. Orders: can prices be tampered client-side? (Server must reprice authoritatively — verify it actually does, including add-ons and subscription discounts if present.) Can someone else's order be read via ref guessing? (Check the /confirm/:ref endpoint's exposure of personal data.)
8. Dependency audit: `npm audit` both workspaces, flag critical/high with actual exploitability assessment, patch what's safe to patch today.

### C. Code correctness
1. `tsc --noEmit` both workspaces — zero errors.
2. Full build passes. Run the server test suite (note: ~12 admin-login tests fail from a known env/DB password drift — ignore those specific failures, but NO other failures are acceptable; use the embedded-postgres :5433 local test workflow from HANDOFF, never test against prod).
3. Walk the money paths end-to-end in a real browser (deposit maths, order flow, Smart Cart drawer, event planner, admin order management) — verify totals server-side match client display.
4. Check recent features for edge cases: empty cart states, deleted-platter-in-cart, stale localStorage carts, double-submit on order creation (idempotency).

### D. Ops readiness
1. Confirm HTTPS everywhere (apex redirect, HSTS), valid cert, no mixed content.
2. Error pages: API 500s don't leak internals; client has designed error states.
3. Backups: confirm whether the database has ANY backup story — if not, that's a launch blocker to flag loudly (it's Supabase — check what the plan includes).
4. robots.txt/sitemap sane, admin pages not indexed.

## The self-check rulebook (you must follow this — it's how we don't miss things)

1. **Evidence or it didn't happen.** Every "checked ✓" in your report must name the file/command/URL and what you observed. No vibes-based sign-offs.
2. **Verify, then re-verify after fixing.** Every fix gets re-tested the same way the problem was found.
3. **Severity honestly:** Critical (fix before more traffic) / High (fix today) / Medium (this week) / Low (noted). No inflating, no burying.
4. **Adversarial second pass:** after your own audit, spawn a fresh-context reviewer agent with ONLY the codebase and this checklist, instructed to find what you missed. Reconcile its findings with yours — anything it finds that you didn't, say so plainly.
5. **Checklist sign-off:** finish with the full A–D checklist, each item marked PASS / FIXED / DEFERRED(reason) / BLOCKED(needs owner). Nothing left unmarked.
6. **Don't break the live shop:** it's taking real orders. No schema migrations today unless critical. Anything risky gets tested locally first (embedded postgres workflow). Site must always boot with current env — never add new required env vars.
7. **Prod access rule:** the permission system blocks prod-admin actions on first attempt — explain what you need and ask me, then retry after I approve.
8. **Fixes ship in small commits** with clear messages, verified live after deploy (push to main auto-deploys, wait and confirm the bundle changed).

## Deliverable
A plain-English report for a non-technical owner: what was checked, what was found (worst first), what you fixed and proved fixed, what's deferred and why, anything that needs ME to act (rotations, Coolify settings, Supabase plan), and a final **GO / NO-GO for sending traffic today** with the honest reasoning.
