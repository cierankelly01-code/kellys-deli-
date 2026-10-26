-- AlterTable
ALTER TABLE "GroceryOrder" ADD COLUMN     "isSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionFrequency" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- AddForeignKey
ALTER TABLE "GroceryOrder" ADD CONSTRAINT "GroceryOrder_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
