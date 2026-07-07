-- AlterTable: one-shot completion-notification guard (nullable, additive)
ALTER TABLE "Order" ADD COLUMN "completedNotifiedAt" TIMESTAMP(3);
