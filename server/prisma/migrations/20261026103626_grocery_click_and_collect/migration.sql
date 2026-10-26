-- CreateTable
CREATE TABLE "GroceryProduct" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "unitLabel" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryProductLocation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryProductLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryOrder" (
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

    CONSTRAINT "GroceryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "GroceryOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryShopSetting" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "dailyCapacity" INTEGER,
    "closedWeekdays" INTEGER[],
    "notifyEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryShopSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryClosure" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrocerySettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "leadTimeHours" INTEGER NOT NULL DEFAULT 24,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "maxItemQty" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrocerySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroceryProduct_active_department_sortOrder_idx" ON "GroceryProduct"("active", "department", "sortOrder");

-- CreateIndex
CREATE INDEX "GroceryProductLocation_locationId_idx" ON "GroceryProductLocation"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryProductLocation_productId_locationId_key" ON "GroceryProductLocation"("productId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryOrder_ref_key" ON "GroceryOrder"("ref");

-- CreateIndex
CREATE INDEX "GroceryOrder_locationId_collectionDate_idx" ON "GroceryOrder"("locationId", "collectionDate");

-- CreateIndex
CREATE INDEX "GroceryOrder_status_idx" ON "GroceryOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryShopSetting_locationId_key" ON "GroceryShopSetting"("locationId");

-- CreateIndex
CREATE INDEX "GroceryClosure_locationId_idx" ON "GroceryClosure"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryClosure_locationId_date_key" ON "GroceryClosure"("locationId", "date");

-- AddForeignKey
ALTER TABLE "GroceryProductLocation" ADD CONSTRAINT "GroceryProductLocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GroceryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryProductLocation" ADD CONSTRAINT "GroceryProductLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrder" ADD CONSTRAINT "GroceryOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrderItem" ADD CONSTRAINT "GroceryOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "GroceryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrderItem" ADD CONSTRAINT "GroceryOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GroceryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryShopSetting" ADD CONSTRAINT "GroceryShopSetting_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryClosure" ADD CONSTRAINT "GroceryClosure_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
