-- When an order's confirmation was first emailed. Only orders never emailed (online
-- deposits not yet paid) are auto-cancelled after the unpaid hold, so every existing
-- order is marked as already confirmed. Written to be safe to run twice: it was first
-- applied by hand in the Supabase SQL editor (29 Oct 2026), before the deploy.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3);

UPDATE "Order"
SET "confirmationSentAt" = "createdAt"
WHERE "confirmationSentAt" IS NULL AND "createdAt" < '2026-10-31T00:00:00Z';
