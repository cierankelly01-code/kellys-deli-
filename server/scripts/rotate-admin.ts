// Rotate the owner admin password and remove the demo account.
// Reads ADMIN_EMAIL / ADMIN_PASSWORD from server/.env — update .env first, then run:
//   npx tsx scripts/rotate-admin.ts
import "../src/lib/env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in server/.env");
  if (password.length < 16) throw new Error("Refusing: ADMIN_PASSWORD must be at least 16 characters");

  const demo = await prisma.user.deleteMany({ where: { email: "demo@kellysdeli.co.uk" } });
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 10), role: "admin" },
    create: { email, passwordHash: await bcrypt.hash(password, 10), role: "admin" },
  });
  console.log(`Owner <${email}> password rotated. Demo accounts removed: ${demo.count}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
