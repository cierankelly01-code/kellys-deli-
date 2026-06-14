# Deploying Kelly's Deli (Supabase + Vercel)

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

## 2. API
Set these env vars on the host (see `server/.env.production.example`):
`NODE_ENV=production`, `DATABASE_URL` (pooled), `JWT_SECRET` (`openssl rand -hex 32`),
`CLIENT_ORIGIN` (your Vercel URL), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

- **Render/Railway (simplest):** new Web Service from this repo, root `server/`,
  build `npm install && npx prisma generate && npm run build`, start `npm start`.
- **Vercel serverless:** wrap `createApp()` in an `api/` function and add rewrites. (Ask me to
  finish this adapter once the project exists — it needs verifying against the real deployment.)

> **Image uploads in production:** the dev server stores uploaded photos on local disk, which
> is **not persistent on serverless**. For prod, switch `server/src/lib/uploads.ts` to Supabase
> Storage (bucket + signed upload). Seeded platters use hosted image URLs, so the site looks
> right out of the box; wire Storage before relying on admin photo uploads. (I can do this once
> Supabase is connected.)

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
