-- AlterTable
ALTER TABLE "BoardComponent" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BoardComponentGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "maxSelections" INTEGER,
    "includedFree" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardComponentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardComponentGroup_key_key" ON "BoardComponentGroup"("key");
