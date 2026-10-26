-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "address" TEXT,
ADD COLUMN     "openingHours" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postcode" TEXT;
