import path from "path";
import fs from "fs";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env, stripeEnabled } from "./lib/env";
import { publicRouter } from "./routes/public";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { requireAdmin } from "./lib/auth";
import { UPLOAD_DIR } from "./lib/uploads";
import { prisma } from "./lib/prisma";
import { parseWebhook } from "./lib/payments";

const SITE = "https://www.kellysdeli.co.uk";

/**
 * Builds the Express app. Kept separate from index.ts so tests (supertest)
 * can import the app without binding a port.
 */
export function createApp(): Express {
  const app = express();

  // Behind a proxy/CDN (Vercel) so rate-limit + req.ip read the real client IP.
  app.set("trust proxy", 1);

  // Security headers. Allow images to be loaded cross-origin (client + API differ).
  // CSP applies to the client HTML we now serve: menu photos live on Supabase Storage
  // and the hero image on Unsplash, so img-src must allow external https origins.
  //
  // Marketing pixels (Meta / TikTok / Google Analytics) and cookieless Cloudflare
  // analytics are loaded CLIENT-SIDE, only after cookie consent, from these origins.
  // They must be allow-listed here or the browser's CSP silently blocks every one of
  // them. We inject them as external <script src> (never inline), so script-src can stay
  // free of 'unsafe-inline' — the XSS protection of the policy is preserved. Adding a
  // host here only *permits* it; nothing loads unless the pixel is configured AND the
  // visitor has consented (see client/src/lib/consent.ts).
  const TRACKER_SCRIPT_SRC = [
    "https://connect.facebook.net", // Meta Pixel (fbevents.js)
    "https://analytics.tiktok.com", // TikTok Pixel (events.js)
    "https://www.googletagmanager.com", // Google Analytics 4 (gtag.js)
    "https://static.cloudflareinsights.com", // Cloudflare Web Analytics beacon
  ];
  const TRACKER_CONNECT_SRC = [
    "https://connect.facebook.net",
    "https://www.facebook.com",
    "https://analytics.tiktok.com",
    "https://analytics-sg.tiktok.com",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    "https://cloudflareinsights.com",
    "https://static.cloudflareinsights.com",
  ];
  const TRACKER_FRAME_SRC = [
    "https://www.facebook.com", // Meta Pixel occasionally injects a same-purpose iframe
    "https://td.doubleclick.net", // GA4 conversion linker
  ];

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "img-src": ["'self'", "data:", "https:"], // menu photos, hero, pixel img-beacons
          "script-src": ["'self'", ...TRACKER_SCRIPT_SRC],
          "connect-src": ["'self'", ...TRACKER_CONNECT_SRC],
          "frame-src": ["'self'", ...TRACKER_FRAME_SRC],
        },
      },
    })
  );

  app.use(cors({ origin: env.clientOrigins, credentials: true }));

  // Stripe webhook — MUST see the raw body (signature verification), so it's mounted
  // before express.json(). No-ops with 200 until Stripe is configured; when live, it
  // reconciles a succeeded payment intent to its order and marks the deposit paid.
  app.post("/api/payments/webhook", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
    if (!stripeEnabled()) return res.status(200).json({ received: true, note: "payments not configured" });
    try {
      const result = parseWebhook(req.body as Buffer, req.header("stripe-signature"));
      if (result.handled && result.paidOrderRef) {
        await prisma.order.updateMany({
          where: { ref: result.paidOrderRef, depositStatus: "pending" },
          data: { depositStatus: "paid", depositPaidAt: new Date(), depositIntentId: result.intentId ?? undefined },
        });
      }
      res.status(200).json({ received: true, handled: result.handled });
    } catch (e) {
      console.error("[payments:webhook] failed", e);
      res.status(400).json({ error: "Webhook error" });
    }
  });

  app.use(express.json({ limit: "1mb" })); // cap body size (DoS)

  // Serve uploaded images (public).
  app.use("/uploads", express.static(UPLOAD_DIR));

  // Rate limits. NOTE: in-memory store — effective for a long-running/warm instance.
  // For multi-instance serverless, back this with a shared store (Redis) or a WAF.
  // Don't throttle the test suite, or a local/E2E run that opts out explicitly
  // (DISABLE_RATE_LIMIT=1). Never set DISABLE_RATE_LIMIT in production.
  const skip = () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "1";
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, skip });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, skip, message: { error: "Too many attempts — try again later" } });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "kellys-deli-api", time: new Date().toISOString() });
  });

  // Whether live payments are configured. The storefront copy stays "payment-ready" until
  // this is true, so we never promise automated billing that isn't wired up.
  app.get("/api/payments/status", (_req, res) => {
    res.json({ enabled: stripeEnabled() });
  });

  // Dynamic sitemap: static public routes + every active occasion category landing page.
  // Generated (not a static file) so newly-added categories appear without a redeploy.
  // Registered before the SPA static/fallback so it wins over any bundled sitemap.xml.
  app.get("/sitemap.xml", async (_req, res) => {
    const staticUrls: Array<{ loc: string; changefreq: string; priority: string }> = [
      { loc: "/", changefreq: "weekly", priority: "1.0" },
      { loc: "/platters", changefreq: "weekly", priority: "0.9" },
      { loc: "/shop", changefreq: "weekly", priority: "0.8" },
      { loc: "/plan", changefreq: "monthly", priority: "0.8" },
      { loc: "/privacy", changefreq: "yearly", priority: "0.2" },
      { loc: "/terms", changefreq: "yearly", priority: "0.2" },
    ];
    let categoryUrls: Array<{ loc: string; changefreq: string; priority: string }> = [];
    try {
      const cats = await prisma.category.findMany({ where: { active: true }, select: { slug: true } });
      categoryUrls = cats.map((c) => ({ loc: `/shop/${c.slug}`, changefreq: "weekly", priority: "0.8" }));
    } catch (e) {
      console.error("[sitemap] could not load categories", e);
    }
    const urls = [...staticUrls, ...categoryUrls]
      .map((u) => `  <url><loc>${SITE}${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
      .join("\n");
    res.setHeader("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api", publicRouter);
  app.use("/api/admin", requireAdmin, adminRouter);

  // In production (VPS/Coolify) this server also serves the built client from the same
  // origin. __dirname differs between tsx (src/) and compiled output (dist/src/), hence
  // two candidates. On Vercel the CDN serves the client and client/dist isn't bundled
  // with the function, so no candidate exists and this block is skipped.
  const clientDist = [
    path.resolve(__dirname, "../../../client/dist"), // compiled: server/dist/src -> repo root
    path.resolve(__dirname, "../../client/dist"), // tsx: server/src -> repo root
  ].find((p) => fs.existsSync(path.join(p, "index.html")));

  if (env.isProd) {
    if (clientDist) {
      app.use(
        express.static(clientDist, {
          index: false,
          setHeaders(res, filePath) {
            // Vite asset filenames are content-hashed — safe to cache hard.
            if (filePath.includes(`${path.sep}assets${path.sep}`)) {
              res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            }
          },
        })
      );
      // SPA fallback: client-side routes get index.html; API/uploads 404 as JSON-land paths.
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
        res.sendFile(path.join(clientDist, "index.html"));
      });
    } else {
      console.warn("[app] client/dist not found — running API-only (no static client).");
    }
  }

  // Generic error handler — never leak stack traces / internals to clients.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    console.error("[error]", err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
