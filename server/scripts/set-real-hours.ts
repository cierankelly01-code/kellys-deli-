// One-off: replace placeholder opening hours with the real ones
// (verified against the Google listing + Facebook page, 2026-07-02).
import "../src/lib/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const hours = JSON.stringify({
  mon: "Closed",
  tue: "8:00 - 16:00",
  wed: "8:00 - 16:00",
  thu: "8:00 - 16:00",
  fri: "8:00 - 16:00",
  sat: "8:00 - 15:00",
  sun: "Closed",
});

prisma.setting
  .upsert({ where: { key: "openingHours" }, update: { value: hours }, create: { key: "openingHours", value: hours } })
  .then(() => console.log("openingHours set to real Tue-Sat hours"))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
