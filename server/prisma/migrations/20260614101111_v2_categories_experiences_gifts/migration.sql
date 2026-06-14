/*
  Warnings:

  - You are about to drop the column `collectionDate` on the `Order` table. All the data in the column will be lost.
  - Added the required column `collectionOrDeliveryDate` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_platterId_fkey";

-- DropIndex
DROP INDEX "Order_locationId_collectionDate_idx";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isBigSpender" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "collectionDate",
ADD COLUMN     "collectionOrDeliveryDate" DATE NOT NULL,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "experienceId" TEXT,
ADD COLUMN     "freebie" TEXT,
ADD COLUMN     "giftMessage" TEXT,
ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'platter',
ALTER COLUMN "platterId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Platter" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'home';

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pricePerHead" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 12,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Order_locationId_collectionOrDeliveryDate_idx" ON "Order"("locationId", "collectionOrDeliveryDate");

-- CreateIndex
CREATE INDEX "Order_type_idx" ON "Order"("type");

-- CreateIndex
CREATE INDEX "Platter_category_idx" ON "Platter"("category");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_platterId_fkey" FOREIGN KEY ("platterId") REFERENCES "Platter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;
