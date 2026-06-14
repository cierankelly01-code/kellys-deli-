// Dev-only: stand up a real local PostgreSQL using embedded-postgres (no Docker needed).
// Stays running until killed. Prints PG_READY when the DB is accepting connections.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "..", ".pgdata");
const PORT = 5433;
const URL = `postgresql://kelly:kelly@localhost:${PORT}/kellysdeli`;

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "kelly",
  password: "kelly",
  port: PORT,
  persistent: true,
});

const fresh = !existsSync(dataDir);
if (fresh) {
  console.log("Initialising fresh Postgres cluster…");
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase("kellysdeli");
} catch {
  /* database already exists — fine */
}

console.log(`PG_READY ${URL}`);

const shutdown = async () => {
  try {
    await pg.stop();
  } catch {
    /* ignore */
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30); // keep the process alive
