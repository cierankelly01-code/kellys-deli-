# Deploying Kelly's Deli (Supabase + Vercel)

> **⚠️ v2 upgrade — run the migration before/at deploy.** The v2 release adds new
> tables (`AddOn`, `OrderItem`, `OrderAddOn`) and columns (`Platter.tier/feedsMin/
> feedsMax/recommendEligible/recommendPriority`, `Order.occasion`). The deploy does
> **not** auto-migrate (`postinstall` only runs `prisma generate`), so the API will
> 500 on `/api/add-ons`, `/api/recommend` and order creation until you apply it:
> ```bash
> cd server
> DATABASE_URL="<direct Supabase string>" npx prisma migrate deploy
> ```
> The migration is additive (new nullable columns / new tables) and safe to run on the
> live DB. After migrating, the existing rows are untouched; the new catalogue is seeded
> create-only (`npm run db:seed` fills the 9 boards + 7 add-ons + settings without
> clobbering admin edits).

Architecture: **client** (static, Vercel) → **API** (Express, Vercel serverless or a Node host) → **Postgres** (Supabase).

## 1. Database — Supabase
1. Create a project at https://supabase.com → note the DB password.
2. Project Settings → Database → **Connection string**. Copy two forms:
   - **Direct** (`...:5432/postgres`) — for migrations/seed.
   - **Pooled** (`...pooler...?pgbouncer=true`) — for serverless runtime.
3. Locally, point the server at it and set up the schema:
   ```bash
   cd server
   DATABASE_URL="<direct string>" npx prisma migrate deploy   # applies existing migrations
   DATABASE_URL="<direct string>" NODE_ENV=production ADMIN_EMAIL="you@kellysdeli.co.uk" ADMIN_PASSWORD="<strong>" npm run db:seed
   ```
   (Seed refuses a weak `ADMIN_PASSWORD` in production. No demo account is created in prod.)

## 2. API (Vercel serverless — adapter already built)
`server/api/index.ts` exports the Express app and `server/vercel.json` routes all requests to it;
`prisma generate` runs on install (postinstall) and the schema targets the Vercel Linux runtime.

1. New Vercel project from this repo, **Root Directory: `server`**.
2. Env vars (see `server/.env.production.example`): `NODE_ENV=production`,
   `DATABASE_URL` (Supabase **pooled** string), `JWT_SECRET` (`openssl rand -hex 32`),
   `CLIENT_ORIGIN` (the client's Vercel URL), `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   and the `SUPABASE_*` storage vars below.
3. Deploy. Health check: `https://<api>.vercel.app/api/health`.

*(Prefer a long-running process? Render/Railway also work: root `server/`, build
`npm install && npm run build`, start `npm start` — same env vars.)*

### Image uploads — Supabase Storage
Uploads use Supabase Storage when configured, else local disk (dev only — not persistent on serverless).
1. Supabase → Storage → create a **public** bucket named `platter-images`.
2. Set on the API host: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API), `SUPABASE_BUCKET=platter-images`.
Seeded platters use hosted image URLs, so the site looks right even before this is set.

## 3. Client — Vercel
1. Import the GitHub repo at https://vercel.com.
2. **Root Directory:** `client`. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. Env var: `VITE_API_URL = https://<your-api-host>` (the API's public origin).
4. Deploy. `client/vercel.json` already handles SPA routing (so `/admin`, `/menu/...` work on refresh).
5. Set the API's `CLIENT_ORIGIN` to the resulting Vercel URL and redeploy the API.

## 4. Go-live checklist
- [ ] `JWT_SECRET` is a fresh 32-byte random value (not the dev default).
- [ ] `ADMIN_PASSWORD` is strong; demo account absent in prod (it is — seed skips it).
- [ ] `CLIENT_ORIGIN` matches the deployed site (CORS).
- [ ] `npm test` green; `prove.mjs` green against staging.
- [ ] Stripe/Twilio still stubbed (deposit "pending", SMS logged) — wire when ready.
