ALTER TABLE "Bundle" ADD COLUMN "discountPct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_discountPct_check" CHECK ("discountPct" BETWEEN 0 AND 50);
