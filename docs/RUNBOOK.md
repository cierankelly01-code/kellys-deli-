# Kelly's Deli runbook

One page: how the site runs and what to do when it breaks. **This repo is public.** No passwords, keys, account details, open risks or other clients' information in this file, ever. Those stay in the owner's password manager and private notes.

## The parts
| Part | Where | Notes |
|---|---|---|
| Website + API | One Express app (`server/`) serving the built React app (`client/dist`) from the same origin | Live at https://www.kellysdeli.co.uk. The apex domain redirects to `www` |
| Hosting | Coolify on a VPS | Builds from GitHub `main` (repo `kellys-deli-`, note the trailing hyphen) |
| Database | Supabase Postgres | Connection string only in Coolify → app → Environment Variables → `DATABASE_URL` |
| Photos uploaded in admin | Disk, on a Coolify volume mounted at `/data/uploads` | If the volume is ever detached, a redeploy deletes every uploaded photo |
| Photos shipped in code | `client/public/images/*.webp` | Go live with a normal deploy |
| Email (order confirmations) | Resend, sending as `hello@kellysdeli.co.uk` | |
| Domain + DNS | Owner's registrar | `@` and `www` A records → the server |
| Search/AI | `server/src/lib/seo-pages.ts`, copy in `server/src/content/seo-content.json` | See `docs/AI-VISIBILITY.md` |

## Is it up?
```bash
curl -s https://www.kellysdeli.co.uk/api/health
```
Expect `"ok":true`, `"uploadDir":"/data/uploads"`, `"email":"live"`. `/api/health` skips the password gate, so it answers even when every other page returns 401.

## The "coming soon" password
If the database `Setting` row `sitePassword` isn't empty, the whole public site returns 401 with "putting the finishing touches on". That's on purpose, not an outage. Admin → Site Settings → Coming soon controls it. Exempt from the gate: `/api/health`, `/api/auth`, `/api/admin`, `/robots.txt`, `/llms.txt`, `/sitemap.xml`.

## Deploying
1. **Migrations first.** Deploys do NOT run database migrations. If `server/prisma/migrations/` has anything prod hasn't had, run `npx prisma migrate deploy` against the prod `DATABASE_URL` before pushing, or the API 500s.
2. `/ship-check kdl`.
3. Push `main`. The Coolify webhook has been unreliable, sometimes lagging 10+ minutes or not firing at all. If the live JS bundle hash (`assets/index-<hash>.js` in the page source) hasn't changed in 15 minutes, press Redeploy in Coolify.
4. The server reads `index.html` once at boot, so an HTML/meta change needs the new container to start (any deploy does that).
5. Public pages changed, and the gate is off? `node server/scripts/indexnow.mjs`.

## Local testing (never against prod)
```bash
node server/scripts/start-db.mjs
```
That starts an embedded Postgres on :5433. Then, from `server/`, with an inline `DATABASE_URL=postgresql://kelly:kelly@localhost:5433/kellysdeli` (it overrides `server/.env`, which points at PROD): `npx prisma migrate deploy`, `ADMIN_PASSWORD=changeme123 npm run db:seed`, `npx vitest run`. For a production-mode server on :4010: `node server/scripts/start-local-prod.mjs`. For e2e: `PORT=4010 npx playwright test`.

## When something breaks
| Symptom | Likely cause | Fix |
|---|---|---|
| Every page 401 "finishing touches" | Site password is on | Admin → Site Settings |
| Pages load but products/API 500 | Code expects a column prod doesn't have | Run the pending migration against prod |
| Photos 404 after a deploy | Upload volume detached | Re-attach the Coolify volume at `/data/uploads`; re-upload |
| No order emails | `email` isn't `"live"` in health | Check `RESEND_API_KEY` / `EMAIL_FROM` in Coolify |
| Pushed but nothing changed | Webhook didn't fire | Coolify → Redeploy; compare bundle hash |
| Build fails with exit 255 at env setup | Transient nixpacks/OOM | Redeploy |
| Pages show plain text without styling for a long time | JS bundle failed to load | Browser console; check the build |
| Server log `[seo] render failed` | DB blip during page render | The site still serves the plain app; check the DB |

## House rules
- Never `git add .` in the repo root: the owner's own photos and videos often sit there untracked. Add files by name.
- Open risks and account details live in the owner's private notes, not here.
