-- AlterTable
ALTER TABLE "Platter" ADD COLUMN     "variantGroup" TEXT,
ADD COLUMN     "variantLabel" TEXT,
ADD COLUMN     "variantOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Platter_variantGroup_idx" ON "Platter"("variantGroup");
