-- v2: add-ons upsell engine, line-item orders, board catalogue tier/feeds, and event recommender config.
-- Fully additive (new nullable columns / columns with defaults, new tables). No data backfill needed.

-- AlterTable
ALTER TABLE "Platter" ADD COLUMN     "feedsMax" INTEGER,
ADD COLUMN     "feedsMin" INTEGER,
ADD COLUMN     "recommendEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recommendPriority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "occasion" TEXT;

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'per_order',
    "unitLabel" TEXT,
    "servesPerUnit" INTEGER,
    "suggestFromHeadcount" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "platterId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAddOn" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AddOn_active_sortOrder_idx" ON "AddOn"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderAddOn_orderId_idx" ON "OrderAddOn"("orderId");

-- CreateIndex
CREATE INDEX "Platter_tier_idx" ON "Platter"("tier");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_platterId_fkey" FOREIGN KEY ("platterId") REFERENCES "Platter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAddOn" ADD CONSTRAINT "OrderAddOn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAddOn" ADD CONSTRAINT "OrderAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
