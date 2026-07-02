// Debug helper: show the most recent orders (ref, when, who, type).
import "../src/lib/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

prisma.order
  .findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { ref: true, createdAt: true, customerName: true, type: true } })
  .then((rows) => {
    for (const r of rows) console.log(r.ref, "|", r.createdAt.toISOString(), "|", r.customerName, "|", r.type);
    if (rows.length === 0) console.log("(no orders in DB)");
  })
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
