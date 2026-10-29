-- When an order's confirmation was first emailed. Only orders never emailed (online
-- deposits not yet paid) are auto-cancelled after the unpaid hold, so existing orders are
-- marked as already confirmed.
--
-- Safe to run twice, at any time: it was first applied by hand in the Supabase SQL editor
-- (29 Oct 2026) before the deploy, and `prisma migrate deploy` will run it again later.
-- The backfill skips orders still waiting on an online deposit (new, pending, a cs_
-- Stripe page), so a re-run never protects an abandoned online order from release.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3);

UPDATE "Order"
SET "confirmationSentAt" = "createdAt"
WHERE "confirmationSentAt" IS NULL
  AND NOT ("status" = 'new' AND "depositStatus" = 'pending' AND LEFT(COALESCE("depositIntentId", ''), 3) = 'cs_');
