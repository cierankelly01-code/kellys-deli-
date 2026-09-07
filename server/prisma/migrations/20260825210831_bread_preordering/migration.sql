-- CreateTable
CREATE TABLE "BreadProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreadProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreadProductLocation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreadProductLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreadOrder" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "collectionDate" DATE NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreadOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreadOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreadOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreadShopSetting" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "dailyCapacity" INTEGER,
    "closedWeekdays" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreadShopSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreadClosure" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreadClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreadSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "leadTimeHours" INTEGER NOT NULL DEFAULT 48,
    "cutoffMode" TEXT NOT NULL DEFAULT 'rolling',
    "cutoffDaysBefore" INTEGER,
    "cutoffTime" TEXT,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "maxItemQty" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreadSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreadProduct_active_sortOrder_idx" ON "BreadProduct"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "BreadProductLocation_locationId_idx" ON "BreadProductLocation"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "BreadProductLocation_productId_locationId_key" ON "BreadProductLocation"("productId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "BreadOrder_ref_key" ON "BreadOrder"("ref");

-- CreateIndex
CREATE INDEX "BreadOrder_locationId_collectionDate_idx" ON "BreadOrder"("locationId", "collectionDate");

-- CreateIndex
CREATE INDEX "BreadOrder_status_idx" ON "BreadOrder"("status");

-- CreateIndex
CREATE INDEX "BreadOrderItem_orderId_idx" ON "BreadOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "BreadOrderItem_productId_idx" ON "BreadOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BreadShopSetting_locationId_key" ON "BreadShopSetting"("locationId");

-- CreateIndex
CREATE INDEX "BreadClosure_locationId_idx" ON "BreadClosure"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "BreadClosure_locationId_date_key" ON "BreadClosure"("locationId", "date");

-- AddForeignKey
ALTER TABLE "BreadProductLocation" ADD CONSTRAINT "BreadProductLocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BreadProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreadProductLocation" ADD CONSTRAINT "BreadProductLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreadOrder" ADD CONSTRAINT "BreadOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreadOrderItem" ADD CONSTRAINT "BreadOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BreadOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreadOrderItem" ADD CONSTRAINT "BreadOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BreadProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreadShopSetting" ADD CONSTRAINT "BreadShopSetting_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreadClosure" ADD CONSTRAINT "BreadClosure_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
