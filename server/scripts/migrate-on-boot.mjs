// Runs `prisma migrate deploy` before the server starts, so a push to main that adds a
// migration goes live without anyone running database commands by hand.
//
// Fails CLOSED: if the migration can't run, the server does not start. The new code reads
// the new columns on every menu and order query, so starting against an unmigrated
// database wouldn't be "one broken feature" — the whole shop would error. Exiting non-zero
// fails the deploy loudly and leaves the previous (working) container serving.
// SKIP_BOOT_MIGRATE=1 bypasses it, for when migrations are applied by hand.
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
  console.error("[migrate-on-boot] Prisma CLI not installed — refusing to start against a possibly unmigrated database. Run `npx prisma migrate deploy` by hand, then set SKIP_BOOT_MIGRATE=1.");
  process.exit(1);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const result = spawnSync(process.execPath, [cli, "migrate", "deploy"], {
  stdio: "inherit",
  timeout: 120_000,
  env: { ...process.env, ...(url ? { DATABASE_URL: url } : {}) },
});
if (result.status === 0) {
  console.log("[migrate-on-boot] database is up to date");
  process.exit(0);
}
console.error(
  `[migrate-on-boot] migrate deploy FAILED (exit ${result.status ?? result.signal}) — NOT starting. ` +
    "If DATABASE_URL is a pooled (pgbouncer) string, set DIRECT_URL to the direct :5432 one. " +
    "SKIP_BOOT_MIGRATE=1 overrides (only once the database is migrated).",
);
process.exit(1);
