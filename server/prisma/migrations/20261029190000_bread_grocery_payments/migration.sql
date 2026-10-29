-- Bread and deli counter orders are paid in full online (Stripe Checkout), like boards.
-- Existing orders keep paymentStatus 'none' (pay on collection) and are marked as already
-- emailed, so the unpaid-order release never touches them.
--
-- Safe to run twice: first applied by hand in the Supabase SQL editor before the deploy,
-- then again later by `prisma migrate deploy`. The backfill skips orders still waiting on
-- an online payment, so a re-run never protects an abandoned online order from release.
ALTER TABLE "BreadOrder" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "BreadOrder" ADD COLUMN IF NOT EXISTS "paymentIntentId" TEXT;
ALTER TABLE "BreadOrder" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "BreadOrder" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3);

ALTER TABLE "GroceryOrder" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "GroceryOrder" ADD COLUMN IF NOT EXISTS "paymentIntentId" TEXT;
ALTER TABLE "GroceryOrder" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "GroceryOrder" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3);

UPDATE "BreadOrder" SET "confirmationSentAt" = "createdAt"
WHERE "confirmationSentAt" IS NULL AND "paymentStatus" <> 'pending' AND "createdAt" < NOW() - INTERVAL '10 minutes';

UPDATE "GroceryOrder" SET "confirmationSentAt" = "createdAt"
WHERE "confirmationSentAt" IS NULL AND "paymentStatus" <> 'pending' AND "createdAt" < NOW() - INTERVAL '10 minutes';
