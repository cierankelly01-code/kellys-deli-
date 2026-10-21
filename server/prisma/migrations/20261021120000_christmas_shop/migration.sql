-- Christmas pre-order shop: products (hams, joints, party food, hampers) alongside the
-- catering boards, supplier sourcing for the admin Supplier Order Sheet, and full
-- online payment. Every column is nullable or defaulted, so existing rows are untouched.

-- AlterTable
ALTER TABLE "Platter" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'catering',
ADD COLUMN     "section" TEXT,
ADD COLUMN     "unitLabel" TEXT,
ADD COLUMN     "payInFull" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageIllustrative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderBy" TIMESTAMP(3),
ADD COLUMN     "collectFrom" DATE,
ADD COLUMN     "collectTo" DATE,
ADD COLUMN     "leadTimeHours" INTEGER,
ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "supplierUrl" TEXT,
ADD COLUMN     "supplierSku" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentType" TEXT NOT NULL DEFAULT 'deposit',
ADD COLUMN     "checkoutSessionId" TEXT,
ADD COLUMN     "collectedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Platter_kind_idx" ON "Platter"("kind");

-- CreateIndex
CREATE INDEX "Order_checkoutSessionId_idx" ON "Order"("checkoutSessionId");

-- Data: the Christmas category (a search landing page at /shop/christmas and /christmas).
INSERT INTO "Category" ("id", "slug", "name", "tagline", "description", "seoTitle", "seoDescription", "active", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'cat_christmas', 'christmas', 'Christmas',
  'Hams, turkey, party food and hampers — ordered now, collected in December.',
  'Pre-order your Christmas from the deli: honey roast and Wiltshire hams carved the way you want them, turkey crowns, pigs in blankets, pork pies, cheese boxes and hampers. Pay online, pick your collection day, and walk past the queue.',
  'Christmas Food Pre-Orders — Hams, Turkey & Hampers | Kelly''s Deli',
  'Pre-order Christmas hams, turkey crowns, party food, cheese and hampers from Kelly''s Deli, Bentley Heath. Pay online and collect any day in December.',
  true, -10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

-- Data: a DRAFT Christmas range. Every product is created INACTIVE with a suggested
-- price — the owner checks price, photo and description in Menu & Pricing and switches
-- each one on. Nothing here is customer-visible until that happens.
INSERT INTO "Platter" ("id", "category", "kind", "section", "name", "description", "fixedPrice", "cost", "serves", "minHeadcount", "items", "unitLabel", "payInFull", "imageIllustrative", "orderBy", "collectFrom", "collectTo", "variantGroup", "variantLabel", "variantOrder", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('xmas_honey_ham_half',  'shop', 'product', 'Hams & Joints', 'Honey Roast Ham', 'Our honey roast ham, glazed and cooked in the deli. Collect it whole for the table or ask us to slice it — just say in the order notes.', 45.00, 0, '8-10', 1, '[]', 'Half ham, approx 2.5kg', true, true, '2026-12-16 23:59:00', '2026-12-01', '2026-12-24', 'xmas-honey-ham', 'Half ham — approx 2.5kg', 0, false, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_honey_ham_whole', 'shop', 'product', 'Hams & Joints', 'Honey Roast Ham', 'Our honey roast ham, glazed and cooked in the deli. Collect it whole for the table or ask us to slice it — just say in the order notes.', 85.00, 0, '16-20', 1, '[]', 'Whole ham, approx 5kg', true, true, '2026-12-16 23:59:00', '2026-12-01', '2026-12-24', 'xmas-honey-ham', 'Whole ham — approx 5kg', 1, false, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_wilts_ham_1kg',   'shop', 'product', 'Hams & Joints', 'Wiltshire Ham', 'Traditionally cured Wiltshire ham — mild, moist and the one everyone goes back for on Boxing Day.', 24.00, 0, '6-8', 1, '[]', 'approx 1kg', true, true, '2026-12-16 23:59:00', '2026-12-01', '2026-12-24', 'xmas-wiltshire-ham', '1kg joint', 0, false, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_wilts_ham_2kg',   'shop', 'product', 'Hams & Joints', 'Wiltshire Ham', 'Traditionally cured Wiltshire ham — mild, moist and the one everyone goes back for on Boxing Day.', 44.00, 0, '12-16', 1, '[]', 'approx 2kg', true, true, '2026-12-16 23:59:00', '2026-12-01', '2026-12-24', 'xmas-wiltshire-ham', '2kg joint', 1, false, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_sliced_ham',      'shop', 'product', 'Hams & Joints', 'Sliced Ham from the Counter', 'Honey roast or Wiltshire, sliced fresh on collection day. Say which in your order notes.', 12.00, 0, NULL, 1, '[]', '500g', true, true, '2026-12-20 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_gammon',          'shop', 'product', 'Hams & Joints', 'Gammon Joint (to cook at home)', 'Uncooked smoked gammon joint, ready for your own glaze.', 28.00, 0, '8-10', 1, '[]', 'approx 2kg', true, true, '2026-12-16 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_turkey_crown',    'shop', 'product', 'Turkey & Trimmings', 'Turkey Crown', 'A British turkey crown — all breast meat, easy to carve, ready to roast.', 55.00, 0, '6-8', 1, '[]', 'approx 2.5kg', true, true, '2026-12-14 23:59:00', '2026-12-18', '2026-12-24', NULL, NULL, 0, false, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_pigs_blankets',   'shop', 'product', 'Turkey & Trimmings', 'Pigs in Blankets', 'Chipolatas wrapped in streaky bacon, ready to roast.', 14.00, 0, NULL, 1, '[]', 'pack of 24', true, true, '2026-12-16 23:59:00', '2026-12-18', '2026-12-24', NULL, NULL, 0, false, 21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_stuffing_balls',  'shop', 'product', 'Turkey & Trimmings', 'Sage & Onion Stuffing Balls', 'Pork, sage and onion stuffing balls, ready to roast.', 7.00, 0, NULL, 1, '[]', 'pack of 12', true, true, '2026-12-16 23:59:00', '2026-12-18', '2026-12-24', NULL, NULL, 0, false, 22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_pork_pie',        'shop', 'product', 'Party Food', 'Large Pork Pie', 'Proper hot-water crust pork pie. Cuts into 8.', 9.00, 0, '6-8', 1, '[]', '1lb pie', true, true, '2026-12-20 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_sausage_rolls',   'shop', 'product', 'Party Food', 'Sausage Rolls', 'Buttery puff pastry, proper sausage meat. Warm them through at home.', 10.00, 0, NULL, 1, '[]', 'box of 12', true, true, '2026-12-20 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 31, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_mince_pies',      'shop', 'product', 'Party Food', 'Mince Pies', 'Shortcrust mince pies, dusted and boxed.', 7.00, 0, NULL, 1, '[]', 'box of 6', true, true, '2026-12-20 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 32, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_cheese_box',      'shop', 'product', 'Cheese', 'Christmas Cheese Box', 'Four cheeses picked for the season, with chutney and crackers. Sorted for the cheese course.', 35.00, 0, '6-8', 1, '[]', '4 cheeses + chutney + crackers', true, true, '2026-12-18 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_stilton',         'shop', 'product', 'Cheese', 'Baby Stilton', 'A whole baby Stilton — the Christmas centrepiece cheese.', 30.00, 0, '10-12', 1, '[]', 'approx 1kg', true, true, '2026-12-16 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 41, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_hamper_classic',  'shop', 'product', 'Hampers & Gifts', 'The Kelly''s Christmas Hamper', 'Deli favourites packed in a gift hamper: cheese, chutney, crackers, charcuterie and something sweet. Add a gift note at checkout.', 65.00, 0, NULL, 1, '[]', 'gift hamper', true, true, '2026-12-16 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_hamper_large',    'shop', 'product', 'Hampers & Gifts', 'The Deli Lover''s Hamper', 'The big one: more cheese, more charcuterie, a bottle and the good chocolates. Ideal for clients and staff gifts too.', 120.00, 0, NULL, 1, '[]', 'large gift hamper', true, true, '2026-12-16 23:59:00', '2026-12-01', '2026-12-24', NULL, NULL, 0, false, 51, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_party_platter',   'shop', 'catering', 'Party Platters', 'Christmas Party Platter', 'Turkey and cranberry, ham and mustard, pigs in blankets, mini pork pies and festive cheese — a full party spread on one board.', 75.00, 0, '10-12', 1, '[]', NULL, false, true, NULL, '2026-12-01', '2026-12-31', NULL, NULL, 0, false, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('xmas_boxing_day',      'shop', 'catering', 'Party Platters', 'The Boxing Day Board', 'Cold cuts, cheese, pickles, pork pie and bread — Boxing Day sorted without touching the oven.', 55.00, 0, '6-8', 1, '[]', NULL, false, true, NULL, '2026-12-01', '2026-12-31', NULL, NULL, 0, false, 61, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PlatterCategory" ("id", "categoryId", "platterId", "sortOrder", "createdAt")
SELECT 'pc_' || p."id", c."id", p."id", p."sortOrder", CURRENT_TIMESTAMP
FROM "Platter" p CROSS JOIN "Category" c
WHERE c."slug" = 'christmas' AND p."id" LIKE 'xmas\_%'
ON CONFLICT DO NOTHING;
