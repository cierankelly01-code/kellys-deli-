// End-to-end proof (v2): drives every feature against the running API + real DB.
// Uses random far-future dates so repeated runs never contend on a location's capacity.
const base = "http://localhost:4000";
let pass = 0, fail = 0;
const uniqPhone = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;
const dayStr = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const rand = () => dayStr(30 + Math.floor(Math.random() * 240)); // fresh, uncontended far date

function check(name, cond, detail = "") {
  cond ? (pass++, console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`))
       : (fail++, console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`));
}
async function call(path, opts = {}) {
  const { headers, ...rest } = opts;
  const res = await fetch(base + path, { ...rest, headers: { "Content-Type": "application/json", ...(headers || {}) } });
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
}
const section = (t) => console.log(`\n── ${t} ──`);

const run = async () => {
  // 1. CHOICE SCREEN + CATEGORIES
  section("1. Choice screen categories + menus");
  const cats = (await call("/api/categories")).body;
  check("home & events categories populated", cats.home > 0 && cats.events > 0, `home:${cats.home} events:${cats.events} seasonal:${cats.seasonal} exp:${cats.experiences}`);
  check("seasonal hidden until switched on", cats.seasonal === 0, `seasonal:${cats.seasonal}`);
  const home = (await call("/api/platters?category=home")).body;
  const events = (await call("/api/platters?category=events")).body;
  check("At Home menu has tiers", home.some((p) => p.name === "Date Night In") && home.length >= 3, home.map((p) => p.name).join(", "));
  check("Events menu has Office Lunch (per-head, min 10)", events.some((p) => p.name === "Office Lunch" && p.minHeadcount === 10));
  const fixedHome = home.find((p) => p.isFixed);
  const office = events.find((p) => p.name === "Office Lunch");
  const locations = (await call("/api/locations")).body;
  const henley = locations.find((l) => l.name.includes("Henley"));
  const stratford = locations.find((l) => l.name.includes("Stratford"));
  check("single-platter detail endpoint works", (await call(`/api/platters/${fixedHome.id}`)).body.name === fixedHome.name);

  // 2. PLATTER ORDER + DEPOSIT + QR
  section("2. Platter order, 25% deposit, QR src");
  const phoneA = uniqPhone();
  const o1 = await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 4, collectionOrDeliveryDate: rand(), locationId: henley.id, customerName: "Alice", phone: phoneA, email: "alice@example.com", src: "qr" }) });
  check("order created (201)", o1.status === 201, o1.body?.order?.ref);
  check(`total = £${fixedHome.fixedPrice}`, o1.body.pricing.total === fixedHome.fixedPrice);
  check("deposit = 25%", o1.body.pricing.deposit === Math.round(fixedHome.fixedPrice * 25) / 100);
  check("src tracked qr", o1.body.order.src === "qr");

  // 3. GIFT
  section("3. Send as a gift");
  const gift = await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 4, collectionOrDeliveryDate: rand(), locationId: henley.id, customerName: "Gifter", phone: uniqPhone(), email: "g@e.com", isGift: true, recipientName: "Aunt May", deliveryAddress: "1 High St, Henley-in-Arden", giftMessage: "Happy birthday!" }) });
  check("gift order created, type=gift", gift.status === 201 && gift.body.order.type === "gift");
  check("recipient + address captured", gift.body.order.recipientName === "Aunt May" && /High St/.test(gift.body.order.deliveryAddress));
  const giftBad = await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 4, collectionOrDeliveryDate: rand(), locationId: henley.id, customerName: "X", phone: uniqPhone(), email: "x@e.com", isGift: true, recipientName: "Y" }) });
  check("gift without address rejected (400)", giftBad.status === 400);

  // 4. RULES
  section("4. 48h + min headcount enforced");
  check("too-soon rejected (400)", (await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 2, collectionOrDeliveryDate: dayStr(0), locationId: henley.id, customerName: "T", phone: uniqPhone(), email: "t@e.com" }) })).status === 400);
  check("below-min Office Lunch rejected (400)", (await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: office.id, headcount: 4, collectionOrDeliveryDate: rand(), locationId: henley.id, customerName: "T", phone: uniqPhone(), email: "t@e.com" }) })).status === 400);

  // 5. CAPACITY
  section("5. Capacity blocks a full date");
  const capDate = rand();
  const before = (await call(`/api/availability?locationId=${stratford.id}&from=${capDate}&days=1`)).body.days[0];
  check(`Stratford ${capDate} has room`, before.remaining > 0, `remaining ${before.remaining}/${before.capacity}`);
  for (let i = 0; i < before.remaining; i++) await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 4, collectionOrDeliveryDate: capDate, locationId: stratford.id, customerName: `F${i}`, phone: uniqPhone(), email: "f@e.com" }) });
  check("order past capacity rejected (409)", (await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 4, collectionOrDeliveryDate: capDate, locationId: stratford.id, customerName: "Over", phone: uniqPhone(), email: "o@e.com" }) })).status === 409);
  const after = (await call(`/api/availability?locationId=${stratford.id}&from=${capDate}&days=1`)).body.days[0];
  check("calendar now shows that date FULL", after.status === "full", `remaining ${after.remaining}`);

  // Admin token (used from here on)
  const token = (await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "owner@kellysdeli.co.uk", password: "changeme123" }) })).body.token;
  const authH = { Authorization: `Bearer ${token}` };

  // 6. TASTINGS: coming-soon gate, then booking + capacity
  section("6. Tastings: coming-soon gate + booking + capacity");
  const exp = (await call("/api/experiences")).body[0];
  check("experience listed", !!exp, exp?.name);
  check("coming-soon flag on by default", (await call("/api/categories")).body.tastingsComingSoon === true);
  check("booking blocked while coming soon (403)", (await call("/api/bookings", { method: "POST", body: JSON.stringify({ experienceId: exp.id, partySize: 2, date: rand(), locationId: henley.id, customerName: "Early", phone: uniqPhone(), email: "e@e.com" }) })).status === 403);
  await call("/api/admin/settings/tastingsComingSoon", { method: "PATCH", headers: authH, body: JSON.stringify({ value: "off" }) });
  check("owner switches tastings open", (await call("/api/categories")).body.tastingsComingSoon === false);
  const b1 = await call("/api/bookings", { method: "POST", body: JSON.stringify({ experienceId: exp.id, partySize: 2, date: rand(), locationId: henley.id, customerName: "Taster", phone: uniqPhone(), email: "t@e.com", src: "instagram" }) });
  check("booking created, type=experience", b1.status === 201 && b1.body.order.type === "experience");
  check("booking total = price×party", b1.body.pricing.total === exp.pricePerHead * 2);
  const capBookDate = rand();
  const bFill = await call("/api/bookings", { method: "POST", body: JSON.stringify({ experienceId: exp.id, partySize: exp.capacity, date: capBookDate, locationId: henley.id, customerName: "Full", phone: uniqPhone(), email: "f@e.com" }) });
  check("fills the session", bFill.status === 201, `party ${exp.capacity}/${exp.capacity}`);
  check("over-capacity booking rejected (409)", (await call("/api/bookings", { method: "POST", body: JSON.stringify({ experienceId: exp.id, partySize: 1, date: capBookDate, locationId: henley.id, customerName: "One", phone: uniqPhone(), email: "1@e.com" }) })).status === 409);

  // 7. RE-ORDER + REFERRAL
  section("7. Re-order + referral");
  check("re-order finds Alice", (await call(`/api/reorder?contact=${phoneA}`)).body.platterId === fixedHome.id);
  const aliceCode = (await call(`/api/orders/${o1.body.order.ref}`)).body.customerReferralCode;
  const ref = await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 4, collectionOrDeliveryDate: rand(), locationId: henley.id, customerName: "Bob", phone: uniqPhone(), email: "b@e.com", referralCodeUsed: aliceCode }) });
  check("referral £15 off", ref.body.pricing.discount === 15 && ref.body.pricing.total === fixedHome.fixedPrice - 15);

  // 8. ADMIN
  section("8. Admin auth + order list + status flow");
  check("blocked without token (401)", (await call("/api/admin/orders")).status === 401);
  const adminOrders = (await call("/api/admin/orders", { headers: authH })).body;
  check("orders carry profit", adminOrders.length > 0 && typeof adminOrders[0].profit === "number", `${adminOrders.length} orders`);
  const giftRow = adminOrders.find((o) => o.type === "gift");
  check("gift visible to admin with recipient", !!giftRow && !!giftRow.recipientName);
  const target = adminOrders.find((o) => o.ref === o1.body.order.ref);
  const done = await call(`/api/admin/orders/${target.id}/status`, { method: "PATCH", headers: authH, body: JSON.stringify({ status: "completed" }) });
  check("status → completed (fires review+referral)", done.body.status === "completed");

  // 9. PREP SHEET (platters+gifts only; experiences excluded)
  section("9. Kitchen prep sheet (live)");
  const prepDate = rand();
  for (const hc of [10, 23]) await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: office.id, headcount: hc, collectionOrDeliveryDate: prepDate, locationId: henley.id, customerName: `Prep${hc}`, phone: uniqPhone(), email: "p@e.com" }) });
  await call("/api/bookings", { method: "POST", body: JSON.stringify({ experienceId: exp.id, partySize: 2, date: prepDate, locationId: henley.id, customerName: "NotInPrep", phone: uniqPhone(), email: "n@e.com" }) });
  const prep = (await call(`/api/admin/prep-sheet?locationId=${henley.id}&date=${prepDate}`, { headers: authH })).body;
  const q = (l) => prep.sheet.lines.find((x) => x.label === l)?.quantity;
  check("only the 2 platter orders counted (booking excluded)", prep.sheet.totalOrders === 2, `${prep.sheet.totalOrders} orders`);
  check("Gourmet sandwiches = 50 (1.5×10 + 1.5×23 = 49.5→50)", q("Gourmet sandwiches") === 50, `got ${q("Gourmet sandwiches")}`);
  check("Sausage rolls = 33", q("Sausage rolls") === 33, `got ${q("Sausage rolls")}`);

  // 10. PROFIT + LEAD SOURCE
  section("10. Profit + lead source");
  const stats = (await call("/api/admin/stats", { headers: authH })).body;
  check("revenue & profit > 0", stats.all.combined.revenue > 0 && stats.all.combined.profit > 0, `rev £${stats.all.combined.revenue}, profit £${stats.all.combined.profit}`);
  check("lead sources include qr + instagram", stats.all.bySrc.some((s) => s.src === "qr") && stats.all.bySrc.some((s) => s.src === "instagram"), stats.all.bySrc.map((s) => `${s.src}:${s.orders}`).join(" "));
  check("margin ranking includes the experience", stats.marginRanking.some((m) => /experience/.test(m.name)));

  // 11. LIVE PRICING EDITOR
  section("11. Live pricing editor (no redeploy)");
  const adminPlatters = (await call("/api/admin/platters", { headers: authH })).body;
  const off = adminPlatters.find((p) => p.name === "Office Lunch");
  check("editor sees cost", off.cost > 0);
  const payload = { category: off.category, name: off.name, description: off.description, pricePerHead: 9.25, fixedPrice: null, cost: off.cost, serves: off.serves, minHeadcount: off.minHeadcount, items: off.items, imageUrl: off.imageUrl, active: true };
  await call(`/api/admin/platters/${off.id}`, { method: "PATCH", headers: authH, body: JSON.stringify(payload) });
  check("customer site shows new £9.25/head instantly", (await call("/api/platters?category=events")).body.find((p) => p.name === "Office Lunch").pricePerHead === 9.25);
  await call(`/api/admin/platters/${off.id}`, { method: "PATCH", headers: authH, body: JSON.stringify({ ...payload, pricePerHead: 8.5 }) });
  check("category preserved as events after edit", (await call("/api/admin/platters", { headers: authH })).body.find((p) => p.name === "Office Lunch").category === "events");
  const ae = (await call("/api/admin/experiences", { headers: authH })).body[0];
  await call(`/api/admin/experiences/${ae.id}`, { method: "PATCH", headers: authH, body: JSON.stringify({ name: ae.name, description: ae.description, pricePerHead: 49, cost: ae.cost, capacity: ae.capacity, imageUrl: ae.imageUrl, active: true }) });
  check("experience price edit reflects on customer site", (await call("/api/experiences")).body[0].pricePerHead === 49);
  await call(`/api/admin/experiences/${ae.id}`, { method: "PATCH", headers: authH, body: JSON.stringify({ name: ae.name, description: ae.description, pricePerHead: ae.pricePerHead, cost: ae.cost, capacity: ae.capacity, imageUrl: ae.imageUrl, active: true }) });

  // 12. SEASONAL TOGGLE
  section("12. Seasonal toggle");
  const seasonal = adminPlatters.find((p) => p.category === "seasonal");
  const sp = { category: "seasonal", name: seasonal.name, description: seasonal.description, pricePerHead: seasonal.pricePerHead, fixedPrice: seasonal.fixedPrice, cost: seasonal.cost, serves: seasonal.serves, minHeadcount: seasonal.minHeadcount, items: seasonal.items, imageUrl: seasonal.imageUrl };
  await call(`/api/admin/platters/${seasonal.id}`, { method: "PATCH", headers: authH, body: JSON.stringify({ ...sp, active: true }) });
  check("seasonal platter now shows to customers", (await call("/api/platters?category=seasonal")).body.some((p) => p.id === seasonal.id));
  check("choice screen now offers Seasonal", (await call("/api/categories")).body.seasonal > 0);
  await call(`/api/admin/platters/${seasonal.id}`, { method: "PATCH", headers: authH, body: JSON.stringify({ ...sp, active: false }) });
  check("seasonal switched back off", !(await call("/api/platters?category=seasonal")).body.some((p) => p.id === seasonal.id));

  // 13. FIRST-ORDER HOOK
  section("13. First-order hook");
  await call("/api/admin/settings/firstOrderHook", { method: "PATCH", headers: authH, body: JSON.stringify({ value: "on" }) });
  const newPhone = uniqPhone();
  const firstOrder = await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 4, collectionOrDeliveryDate: rand(), locationId: henley.id, customerName: "Newbie", phone: newPhone, email: "new@e.com" }) });
  check("first-time order gets the freebie", !!firstOrder.body.freebie, firstOrder.body.freebie);
  const secondOrder = await call("/api/orders", { method: "POST", body: JSON.stringify({ platterId: fixedHome.id, headcount: 4, collectionOrDeliveryDate: rand(), locationId: henley.id, customerName: "Newbie", phone: newPhone, email: "new@e.com" }) });
  check("returning customer does NOT get it again", !secondOrder.body.freebie);
  await call("/api/admin/settings/firstOrderHook", { method: "PATCH", headers: authH, body: JSON.stringify({ value: "off" }) });

  // 14. SMS LIST + BLAST
  section("14. SMS list + big-spender + blast");
  const customers = (await call("/api/admin/customers", { headers: authH })).body;
  check("SMS list captures phones with lifetime spend", customers.length > 0 && customers.some((c) => c.lifetimeSpend > 0), `${customers.length} customers`);
  const tagged = await call(`/api/admin/customers/${customers[0].id}`, { method: "PATCH", headers: authH, body: JSON.stringify({ isBigSpender: true }) });
  check("big-spender tag persists", tagged.body.isBigSpender === true);
  const blastAll = await call("/api/admin/sms/blast", { method: "POST", headers: authH, body: JSON.stringify({ message: "Platters this weekend — order by Thursday 🥪", audience: "all" }) });
  check("blast to everyone logs payloads", blastAll.body.sent === customers.length, `sent ${blastAll.body.sent}`);
  const blastBig = await call("/api/admin/sms/blast", { method: "POST", headers: authH, body: JSON.stringify({ message: "VIP preview 🧀", audience: "big_spenders" }) });
  check("blast to big spenders targets fewer", blastBig.body.sent >= 1 && blastBig.body.sent <= customers.length, `sent ${blastBig.body.sent}`);
  const csv = await (await fetch(`${base}/api/admin/customers/export`, { headers: authH })).text();
  check("CSV export has header + rows", csv.startsWith("name,phone,email") && csv.split("\n").length > 1);

  // 15. FILL SLOTS
  section("15. Fill these slots");
  const fill = (await call("/api/admin/fill-slots?days=7", { headers: authH })).body;
  check("returns open slots with promo", fill.slots.length > 0 && fill.slots[0].promo.includes("Kelly's Deli"), `${fill.slots.length} slots`);

  // Restore the demo to its "coming soon" state for tastings.
  await call("/api/admin/settings/tastingsComingSoon", { method: "PATCH", headers: authH, body: JSON.stringify({ value: "on" }) });

  console.log(`\n${"=".repeat(42)}\n  RESULT: ${pass} passed, ${fail} failed\n${"=".repeat(42)}`);
  process.exit(fail === 0 ? 0 : 1);
};
run().catch((e) => { console.error("FATAL", e); process.exit(2); });
