# Kelly's Deli — Catering Ordering & Growth App

Multi-location catering ordering + growth engine for Kelly's Deli (Bentley Heath,
Henley-in-Arden, Stratford-upon-Avon). Customers order platters in under 60 seconds and
pay a deposit; staff manage orders, auto-generate kitchen prep sheets, edit pricing live,
and see profit per order.

See [docs/SPEC.md](docs/SPEC.md) and [docs/PLAN.md](docs/PLAN.md).

## Stack

- **client/** — React 18 + Vite + TypeScript (mobile-first)
- **server/** — Node + Express + Prisma + TypeScript
- **DB** — PostgreSQL (Supabase in prod; any Postgres locally)
- Auth: JWT (staff only). Payments + SMS/email are stubbed behind clean interfaces.

## Quickstart

```bash
npm install                 # installs client + server (workspaces)

# 1. Point the server at a Postgres database
cp server/.env.example server/.env
#   - Supabase: paste your connection string into DATABASE_URL
#   - or local Docker:  docker compose up -d   (uses docker-compose.yml)

# 2. Create the schema + seed 3 locations, 3 platters, an admin user
npm run db:migrate          # prisma migrate dev
npm run db:seed

# 3. Run both apps (API on :4000, web on :5173)
npm run dev
```

Open <http://localhost:5173>. The QR / walk-in landing is `/order?src=counter`.
Admin login uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env`.

## Useful commands

| Command | What |
|---|---|
| `npm run dev` | API + client together |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed locations/platters/admin (idempotent) |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm test` | Run server + client tests (Vitest) |
| `npm run build` | Build both packages |

## Notes

- **Payments** are stubbed (`server/src/lib/payments.ts`) — a deposit intent is captured and
  the order is marked `deposit pending`. Swap in Stripe behind the same interface.
- **SMS/email** are stubbed (`server/src/lib/notify.ts`) — payloads are logged. Swap in
  Twilio/Resend behind the same interface.
- **Deploy:** the client deploys to Vercel as-is. The Express API runs standalone for the MVP;
  a Vercel serverless adapter is a documented follow-up.
