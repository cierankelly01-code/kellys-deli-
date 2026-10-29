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
  // Public base URL for customer-facing links in outbound messages (referral/review SMS + email).
  // Distinct from CLIENT_ORIGIN (a CORS allowlist): defaults to the live site in prod so links
  // never fall back to localhost when CLIENT_ORIGIN is unset. Optional + overridable; NEVER a
  // boot requirement — the site must start without PUBLIC_URL set.
  publicUrl: (process.env.PUBLIC_URL ?? (isProd ? "https://www.kellysdeli.co.uk" : "http://localhost:5173")).replace(/\/+$/, ""),
  // Stripe — OPTIONAL. The payments module no-ops (stub deposit intents, webhook 503s)
  // when these are absent, so the site boots and runs fine without them. NEVER add these
  // to the required-secrets check below: making them boot requirements would break deploys
  // until Stripe is set up. Payments go live simply by setting these two vars.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};

/**
 * True once BOTH Stripe values are set — the app runs identically with it false. Both,
 * because a secret key without the webhook secret would charge customers while never
 * recording the payment.
 */
export const stripeMode = (): "live" | "test" => (/^(sk|rk)_live_/.test(env.stripeSecretKey) ? "live" : "test");
/**
 * Test keys on the production site would let anyone "pay" with Stripe's test card 4242,
 * so they're refused there unless STRIPE_ALLOW_TEST_MODE=1 is set on purpose — only
 * while testing behind the coming-soon password (docs/STRIPE.md).
 */
const testModeBlocked = () => env.isProd && stripeMode() === "test" && process.env.STRIPE_ALLOW_TEST_MODE !== "1";
export const stripeEnabled = () => env.stripeSecretKey.length > 0 && env.stripeWebhookSecret.length > 0 && !testModeBlocked();
if (env.stripeSecretKey && !env.stripeWebhookSecret) {
  console.error("[payments] STRIPE_SECRET_KEY is set without STRIPE_WEBHOOK_SECRET — online deposits stay OFF until both are set.");
}
if (env.stripeSecretKey && testModeBlocked()) {
  console.error("[payments] Stripe TEST keys on the production site — online deposits stay OFF. Set STRIPE_ALLOW_TEST_MODE=1 only while testing behind the site password.");
}

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
