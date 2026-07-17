import dotenv from "dotenv";

// Load server/.env once, as early as possible.
dotenv.config();

const isProd = process.env.NODE_ENV === "production";
const WEAK_SECRET = "dev-secret-change-me";

export const env = {
  isProd,
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? WEAK_SECRET,
  // VPS (Coolify) expects 3000 by default; local dev tooling (vite proxy, launch.json) targets 4000.
  port: Number(process.env.PORT ?? (isProd ? 3000 : 4000)),
  // CLIENT_ORIGIN may be a comma-separated list of allowed origins.
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
  // Stripe — OPTIONAL. The payments module no-ops (stub deposit intents, webhook 503s)
  // when these are absent, so the site boots and runs fine without them. NEVER add these
  // to the required-secrets check below: making them boot requirements would break deploys
  // until Stripe is set up. Payments go live simply by setting these two vars.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};

/** True once Stripe keys are configured — the app runs identically with it false. */
export const stripeEnabled = () => env.stripeSecretKey.length > 0;

// Fail fast in production if secrets are missing or weak — never run public with defaults.
if (isProd) {
  const problems: string[] = [];
  if (!env.databaseUrl) problems.push("DATABASE_URL is required");
  if (!process.env.JWT_SECRET || env.jwtSecret === WEAK_SECRET || env.jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be a strong random value (>= 32 chars), not the dev default");
  }
  // NOTE: CLIENT_ORIGIN is intentionally NOT required. This app serves the client and
  // the API from the same Vercel origin, so cross-origin CORS never applies in prod and
  // CLIENT_ORIGIN is normally unset. Only add a check here if the client is ever split
  // onto a different domain — a hard requirement now would break the current deploy.
  if (process.env.CLIENT_ORIGIN && env.clientOrigins.length === 0) {
    console.warn("[env] CLIENT_ORIGIN is set but parsed to an empty allowlist — check its format.");
  }
  if (problems.length) {
    throw new Error(`[env] Unsafe production configuration:\n - ${problems.join("\n - ")}`);
  }
} else if (!env.databaseUrl) {
  console.warn("[env] DATABASE_URL is not set — copy server/.env.example to server/.env");
}
