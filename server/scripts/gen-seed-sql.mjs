// Emits idempotent seed INSERTs (reference data only — no secrets) for Supabase SQL editor.
const sql = (v) =>
  v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "true" : "false") : `'${String(v).replace(/'/g, "''")}'`;
const json = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;

const locations = [
  ["loc-bentley-heath", "Bentley Heath", "bentley-heath", 5, true],
  ["loc-henley", "Henley-in-Arden", "henley-in-arden", 4, true],
  ["loc-stratford", "Stratford-upon-Avon", "stratford-upon-avon", 3, true],
];

const platters = [
  ["platter-date-night", "home", "Date Night In", "Dinner for two, sorted — the same local produce our regulars have trusted for years.", null, 35, 14, "2", 1, 1, true, "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=60", [["Gourmet sandwiches",6],["Sausage rolls",4],["Veg & lamb samosas",4],["Crusty cobs",2],["Local cheese & produce",1],["Fruit pots",2]]],
  ["platter-night-in", "home", "Night In", "For family & friends round the table — generous, fresh, no fuss.", null, 65, 27, "4-6", 1, 2, true, "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=60", [["Gourmet sandwiches",14],["Sausage rolls",10],["Veg & lamb samosas",8],["Crusty cobs",6],["Local cheese & produce",2],["Fruit pots",4]]],
  ["platter-small-gathering", "home", "Small Gathering", "Birthdays, get-togethers, the good afternoons — a proper spread for the room.", null, 140, 62, "10-15", 1, 3, true, "https://images.unsplash.com/photo-1447279506476-3faec8071eee?auto=format&fit=crop&w=800&q=60", [["Gourmet sandwiches",30],["Sausage rolls",22],["Veg & lamb samosas",18],["Crusty cobs",12],["Local cheese & produce",4],["Fruit platters",2]]],
  ["platter-big-spread", "events", "The Big Spread", "The full event spread for up to 20 — everything the table needs.", null, 195, 88, "up to 20", 1, 1, true, "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=60", [["Gourmet sandwiches",45],["Sausage rolls",30],["Veg & lamb samosas",24],["Crusty cobs",18],["Local cheese & produce",6],["Fruit platters",3]]],
  ["platter-office-lunch", "events", "Office Lunch", "Sorted lunch for the team — priced per head, 10 person minimum.", 8.5, null, 3.4, "10+", 10, 2, true, "https://images.unsplash.com/photo-1554998171-89445e31c52b?auto=format&fit=crop&w=800&q=60", [["Gourmet sandwiches",1.5],["Sausage rolls",1],["Veg & lamb samosas",1],["Crusty cobs",1],["Fruit portions",1]]],
  ["platter-xmas", "seasonal", "Christmas Spread", "Festive favourites for the season — switch on from admin when it's time.", null, 165, 72, "10-15", 1, 1, false, "https://images.unsplash.com/photo-1543258103-a62bdc069871?auto=format&fit=crop&w=800&q=60", [["Festive sandwiches",30],["Pigs in blankets",24],["Veg & lamb samosas",16],["Crusty cobs",12],["Cheese & chutney",4],["Mince pies",12]]],
  ["platter-bbq", "seasonal", "Summer BBQ Platter", "Sunshine spread for gardens & gatherings — switch on for summer.", null, 150, 66, "10-15", 1, 2, false, "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=60", [["BBQ pulled rolls",30],["Sausage rolls",20],["Veg & lamb samosas",16],["Salads",6],["Fruit platters",3]]],
];

const experiences = [
  ["exp-cheese-tasting", "Cheese Tasting Evening", "A guided evening through our finest local cheeses, with cobs, chutneys and a glass to match.", 45, 16, 12, true, 1, "https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=800&q=60"],
];

const settings = [
  ["firstOrderHook", "off"],
  ["firstOrderHookText", "FREE: box of sausage rolls"],
  ["tastingsComingSoon", "on"],
];

const out = [];
out.push("\n-- ===== SEED: reference data (idempotent) =====");
for (const [id, name, slug, cap, active] of locations) {
  out.push(`INSERT INTO "Location" ("id","name","slug","weeklyCapacity","active") VALUES (${sql(id)},${sql(name)},${sql(slug)},${cap},${active}) ON CONFLICT ("id") DO NOTHING;`);
}
for (const [id, cat, name, desc, pph, fixed, cost, serves, minH, sort, active, img, items] of platters) {
  const itemsJson = items.map(([label, qty]) => ({ label, qtyPerUnit: qty }));
  out.push(`INSERT INTO "Platter" ("id","category","name","description","pricePerHead","fixedPrice","cost","serves","minHeadcount","items","imageUrl","active","sortOrder","updatedAt") VALUES (${sql(id)},${sql(cat)},${sql(name)},${sql(desc)},${sql(pph)},${sql(fixed)},${cost},${sql(serves)},${minH},${json(itemsJson)},${sql(img)},${active},${sort},now()) ON CONFLICT ("id") DO NOTHING;`);
}
for (const [id, name, desc, pph, cost, cap, active, sort, img] of experiences) {
  out.push(`INSERT INTO "Experience" ("id","name","description","pricePerHead","cost","capacity","active","sortOrder","imageUrl","updatedAt") VALUES (${sql(id)},${sql(name)},${sql(desc)},${pph},${cost},${cap},${active},${sort},${sql(img)},now()) ON CONFLICT ("id") DO NOTHING;`);
}
for (const [k, v] of settings) {
  out.push(`INSERT INTO "Setting" ("key","value") VALUES (${sql(k)},${sql(v)}) ON CONFLICT ("key") DO NOTHING;`);
}
out.push(`
-- ===== ADMIN LOGIN =====
-- Generate a bcrypt hash for YOUR password (run from the server/ folder), then paste it below:
--   node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))"
-- INSERT INTO "User" ("id","email","passwordHash","role")
--   VALUES ('user-admin','owner@kellysdeli.co.uk','PASTE_BCRYPT_HASH_HERE','admin')
--   ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";`);
console.log(out.join("\n"));
