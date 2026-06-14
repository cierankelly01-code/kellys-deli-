-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "weeklyCapacity" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platter" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'home',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pricePerHead" DECIMAL(10,2),
    "fixedPrice" DECIMAL(10,2),
    "cost" DECIMAL(10,2) NOT NULL,
    "serves" TEXT,
    "minHeadcount" INTEGER NOT NULL DEFAULT 1,
    "items" JSONB NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platter_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'platter',
    "platterId" TEXT,
    "experienceId" TEXT,
    "headcount" INTEGER NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "deposit" DECIMAL(10,2) NOT NULL,
    "depositStatus" TEXT NOT NULL DEFAULT 'pending',
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "recipientName" TEXT,
    "deliveryAddress" TEXT,
    "giftMessage" TEXT,
    "collectionOrDeliveryDate" DATE NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "notes" TEXT,
    "freebie" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "src" TEXT NOT NULL DEFAULT 'direct',
    "referralCodeUsed" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "lastOrderId" TEXT,
    "isBigSpender" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE INDEX "Platter_category_idx" ON "Platter"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Order_ref_key" ON "Order"("ref");

-- CreateIndex
CREATE INDEX "Order_locationId_collectionOrDeliveryDate_idx" ON "Order"("locationId", "collectionOrDeliveryDate");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_src_idx" ON "Order"("src");

-- CreateIndex
CREATE INDEX "Order_type_idx" ON "Order"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "Customer"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_orderId_key" ON "Referral"("orderId");

-- CreateIndex
CREATE INDEX "Referral_code_idx" ON "Referral"("code");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_platterId_fkey" FOREIGN KEY ("platterId") REFERENCES "Platter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ===== SEED: reference data (idempotent) =====
INSERT INTO "Location" ("id","name","slug","weeklyCapacity","active") VALUES ('loc-bentley-heath','Bentley Heath','bentley-heath',5,true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Location" ("id","name","slug","weeklyCapacity","active") VALUES ('loc-henley','Henley-in-Arden','henley-in-arden',4,true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Location" ("id","name","slug","weeklyCapacity","active") VALUES ('loc-stratford','Stratford-upon-Avon','stratford-upon-avon',3,true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Platter" ("id","category","name","description","pricePerHead","fixedPrice","cost","serves","minHeadcount","items","imageUrl","active","sortOrder","updatedAt") VALUES ('platter-date-night','home','Date Night In','Dinner for two, sorted — the same local produce our regulars have trusted for years.',NULL,35,14,'2',1,'[{"label":"Gourmet sandwiches","qtyPerUnit":6},{"label":"Sausage rolls","qtyPerUnit":4},{"label":"Veg & lamb samosas","qtyPerUnit":4},{"label":"Crusty cobs","qtyPerUnit":2},{"label":"Local cheese & produce","qtyPerUnit":1},{"label":"Fruit pots","qtyPerUnit":2}]'::jsonb,'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=60',true,1,now()) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Platter" ("id","category","name","description","pricePerHead","fixedPrice","cost","serves","minHeadcount","items","imageUrl","active","sortOrder","updatedAt") VALUES ('platter-night-in','home','Night In','For family & friends round the table — generous, fresh, no fuss.',NULL,65,27,'4-6',1,'[{"label":"Gourmet sandwiches","qtyPerUnit":14},{"label":"Sausage rolls","qtyPerUnit":10},{"label":"Veg & lamb samosas","qtyPerUnit":8},{"label":"Crusty cobs","qtyPerUnit":6},{"label":"Local cheese & produce","qtyPerUnit":2},{"label":"Fruit pots","qtyPerUnit":4}]'::jsonb,'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=60',true,2,now()) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Platter" ("id","category","name","description","pricePerHead","fixedPrice","cost","serves","minHeadcount","items","imageUrl","active","sortOrder","updatedAt") VALUES ('platter-small-gathering','home','Small Gathering','Birthdays, get-togethers, the good afternoons — a proper spread for the room.',NULL,140,62,'10-15',1,'[{"label":"Gourmet sandwiches","qtyPerUnit":30},{"label":"Sausage rolls","qtyPerUnit":22},{"label":"Veg & lamb samosas","qtyPerUnit":18},{"label":"Crusty cobs","qtyPerUnit":12},{"label":"Local cheese & produce","qtyPerUnit":4},{"label":"Fruit platters","qtyPerUnit":2}]'::jsonb,'https://images.unsplash.com/photo-1447279506476-3faec8071eee?auto=format&fit=crop&w=800&q=60',true,3,now()) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Platter" ("id","category","name","description","pricePerHead","fixedPrice","cost","serves","minHeadcount","items","imageUrl","active","sortOrder","updatedAt") VALUES ('platter-big-spread','events','The Big Spread','The full event spread for up to 20 — everything the table needs.',NULL,195,88,'up to 20',1,'[{"label":"Gourmet sandwiches","qtyPerUnit":45},{"label":"Sausage rolls","qtyPerUnit":30},{"label":"Veg & lamb samosas","qtyPerUnit":24},{"label":"Crusty cobs","qtyPerUnit":18},{"label":"Local cheese & produce","qtyPerUnit":6},{"label":"Fruit platters","qtyPerUnit":3}]'::jsonb,'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=60',true,1,now()) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Platter" ("id","category","name","description","pricePerHead","fixedPrice","cost","serves","minHeadcount","items","imageUrl","active","sortOrder","updatedAt") VALUES ('platter-office-lunch','events','Office Lunch','Sorted lunch for the team — priced per head, 10 person minimum.',8.5,NULL,3.4,'10+',10,'[{"label":"Gourmet sandwiches","qtyPerUnit":1.5},{"label":"Sausage rolls","qtyPerUnit":1},{"label":"Veg & lamb samosas","qtyPerUnit":1},{"label":"Crusty cobs","qtyPerUnit":1},{"label":"Fruit portions","qtyPerUnit":1}]'::jsonb,'https://images.unsplash.com/photo-1554998171-89445e31c52b?auto=format&fit=crop&w=800&q=60',true,2,now()) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Platter" ("id","category","name","description","pricePerHead","fixedPrice","cost","serves","minHeadcount","items","imageUrl","active","sortOrder","updatedAt") VALUES ('platter-xmas','seasonal','Christmas Spread','Festive favourites for the season — switch on from admin when it''s time.',NULL,165,72,'10-15',1,'[{"label":"Festive sandwiches","qtyPerUnit":30},{"label":"Pigs in blankets","qtyPerUnit":24},{"label":"Veg & lamb samosas","qtyPerUnit":16},{"label":"Crusty cobs","qtyPerUnit":12},{"label":"Cheese & chutney","qtyPerUnit":4},{"label":"Mince pies","qtyPerUnit":12}]'::jsonb,'https://images.unsplash.com/photo-1543258103-a62bdc069871?auto=format&fit=crop&w=800&q=60',false,1,now()) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Platter" ("id","category","name","description","pricePerHead","fixedPrice","cost","serves","minHeadcount","items","imageUrl","active","sortOrder","updatedAt") VALUES ('platter-bbq','seasonal','Summer BBQ Platter','Sunshine spread for gardens & gatherings — switch on for summer.',NULL,150,66,'10-15',1,'[{"label":"BBQ pulled rolls","qtyPerUnit":30},{"label":"Sausage rolls","qtyPerUnit":20},{"label":"Veg & lamb samosas","qtyPerUnit":16},{"label":"Salads","qtyPerUnit":6},{"label":"Fruit platters","qtyPerUnit":3}]'::jsonb,'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=60',false,2,now()) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Experience" ("id","name","description","pricePerHead","cost","capacity","active","sortOrder","imageUrl","updatedAt") VALUES ('exp-cheese-tasting','Cheese Tasting Evening','A guided evening through our finest local cheeses, with cobs, chutneys and a glass to match.',45,16,12,true,1,'https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=800&q=60',now()) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Setting" ("key","value") VALUES ('firstOrderHook','off') ON CONFLICT ("key") DO NOTHING;
INSERT INTO "Setting" ("key","value") VALUES ('firstOrderHookText','FREE: box of sausage rolls') ON CONFLICT ("key") DO NOTHING;
INSERT INTO "Setting" ("key","value") VALUES ('tastingsComingSoon','on') ON CONFLICT ("key") DO NOTHING;

-- ===== ADMIN LOGIN =====
-- Generate a bcrypt hash for YOUR password (run from the server/ folder), then paste it below:
--   node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))"
-- INSERT INTO "User" ("id","email","passwordHash","role")
--   VALUES ('user-admin','owner@kellysdeli.co.uk','PASTE_BCRYPT_HASH_HERE','admin')
--   ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
