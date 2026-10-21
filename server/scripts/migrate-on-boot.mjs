// Runs `prisma migrate deploy` before the server starts, so a push to main that adds a
// migration goes live without anyone running database commands by hand.
//
// Fail-soft on purpose: if the migration can't run (Prisma CLI missing, DB briefly
// unreachable, a pooled connection that can't take migration locks), it logs loudly and
// the server STILL starts — a running site with one broken feature beats a dead site.
// Migrations here are additive and idempotent, so the next boot simply retries.
//
// Uses DIRECT_URL when set (Supabase's direct :5432 string — migrations can't run through
// the pgbouncer pooler), otherwise DATABASE_URL. Set SKIP_BOOT_MIGRATE=1 to turn it off.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

if (process.env.SKIP_BOOT_MIGRATE === "1") {
  console.log("[migrate-on-boot] skipped (SKIP_BOOT_MIGRATE=1)");
  process.exit(0);
}

const require = createRequire(import.meta.url);
let cli;
try {
  cli = require.resolve("prisma/build/index.js");
} catch {
  console.error("[migrate-on-boot] Prisma CLI not installed — migrations NOT applied. Run `npx prisma migrate deploy` by hand.");
  process.exit(0);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const result = spawnSync(process.execPath, [cli, "migrate", "deploy"], {
  stdio: "inherit",
  timeout: 120_000,
  env: { ...process.env, ...(url ? { DATABASE_URL: url } : {}) },
});
if (result.status === 0) console.log("[migrate-on-boot] database is up to date");
else console.error(`[migrate-on-boot] migrate deploy FAILED (exit ${result.status ?? result.signal}) — starting anyway. Check the logs above.`);
process.exit(0);
