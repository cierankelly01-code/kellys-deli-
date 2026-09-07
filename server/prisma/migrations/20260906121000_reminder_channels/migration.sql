ALTER TABLE "ReminderSignup"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "emailConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "smsConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consentAt" TIMESTAMP(3),
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "emailStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "smsStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "ReminderSignup_cancelled_dueAt_idx" ON "ReminderSignup"("cancelled", "dueAt");
ALTER TABLE "ReminderSignup" ENABLE ROW LEVEL SECURITY;
