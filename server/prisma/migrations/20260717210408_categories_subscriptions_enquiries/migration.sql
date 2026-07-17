-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "depositIntentId" TEXT,
ADD COLUMN     "depositPaidAt" TIMESTAMP(3),
ADD COLUMN     "isSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionDiscount" DECIMAL(10,2),
ADD COLUMN     "subscriptionFrequency" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "heroImageUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "isCorporate" BOOLEAN NOT NULL DEFAULT false,
    "promotePlanner" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatterCategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "platterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatterCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "frequency" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 10,
    "customerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateEnquiry" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "headcount" INTEGER,
    "frequency" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "reminderDate" DATE,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_active_sortOrder_idx" ON "Category"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "PlatterCategory_platterId_idx" ON "PlatterCategory"("platterId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatterCategory_categoryId_platterId_key" ON "PlatterCategory"("categoryId", "platterId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "CorporateEnquiry_status_idx" ON "CorporateEnquiry"("status");

-- CreateIndex
CREATE INDEX "ReminderSignup_occasion_idx" ON "ReminderSignup"("occasion");

-- CreateIndex
CREATE INDEX "Order_isSubscription_idx" ON "Order"("isSubscription");

-- AddForeignKey
ALTER TABLE "PlatterCategory" ADD CONSTRAINT "PlatterCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatterCategory" ADD CONSTRAINT "PlatterCategory_platterId_fkey" FOREIGN KEY ("platterId") REFERENCES "Platter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
