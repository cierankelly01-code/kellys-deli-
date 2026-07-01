-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customItems" JSONB,
ADD COLUMN     "quantity" INTEGER;

-- AlterTable
ALTER TABLE "Platter" ADD COLUMN     "boardType" TEXT,
ADD COLUMN     "size" TEXT;

-- CreateTable
CREATE TABLE "BoardComponent" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardComponent_category_idx" ON "BoardComponent"("category");

-- CreateIndex
CREATE INDEX "Platter_boardType_idx" ON "Platter"("boardType");
