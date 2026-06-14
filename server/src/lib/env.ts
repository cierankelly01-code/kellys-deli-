import dotenv from "dotenv";

// Load server/.env once, as early as possible.
dotenv.config();

const isProd = process.env.NODE_ENV === "production";
const WEAK_SECRET = "dev-secret-change-me";

export const env = {
  isProd,
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? WEAK_SECRET,
  port: Number(process.env.PORT ?? 4000),
  // CLIENT_ORIGIN may be a comma-separated list of allowed origins.
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
};

// Fail fast in production if secrets are missing or weak — never run public with defaults.
if (isProd) {
  const problems: string[] = [];
  if (!env.databaseUrl) problems.push("DATABASE_URL is required");
  if (!process.env.JWT_SECRET || env.jwtSecret === WEAK_SECRET || env.jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be a strong random value (>= 32 chars), not the dev default");
  }
  if (problems.length) {
    throw new Error(`[env] Unsafe production configuration:\n - ${problems.join("\n - ")}`);
  }
} else if (!env.databaseUrl) {
  console.warn("[env] DATABASE_URL is not set — copy server/.env.example to server/.env");
}
