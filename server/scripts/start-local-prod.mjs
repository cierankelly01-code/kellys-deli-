// Local verification server: runs the real production-mode app (serving client/dist)
// against the embedded test postgres on :5433 — never the shared prod DB. Used by
// .claude/launch.json ("local-prod") for in-browser verification before a deploy.
import { spawn } from "node:child_process";
import path from "node:path";

const serverDir = path.resolve(import.meta.dirname, "..");

const child = spawn("npx", ["tsx", "src/index.ts"], {
  cwd: serverDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: process.env.PORT ?? "4010", // the preview launcher may assign a different port
    DATABASE_URL: "postgresql://kelly:kelly@localhost:5433/kellysdeli",
    ADMIN_PASSWORD: "changeme123",
    // Production-mode boot refuses the dev default; this is a throwaway local secret.
    JWT_SECRET: "local-verify-only-9f2c71d84ab06e35c2d91b7a44f8e0c3",
    DISABLE_RATE_LIMIT: "1",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
