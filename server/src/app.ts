import path from "path";
import fs from "fs";
import crypto from "node:crypto";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env, stripeEnabled, stripeMode } from "./lib/env";
import { publicRouter } from "./routes/public";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { requireAdmin } from "./lib/auth";
import { UPLOAD_DIR, storageMode } from "./lib/uploads";
import { emailMode } from "./lib/notify";
import { prisma } from "./lib/prisma";
import { parseWebhook } from "./lib/payments";
import { seoHtmlHandler } from "./lib/seo-pages";
import { notifyShopPaymentProblem } from "./lib/notify";
import { sendOrderEmails, orderEmailInclude } from "./lib/order-emails";
import { recordSimplePayment, recordSimpleRefund, simpleKindForRef } from "./lib/simple-order-payments";

const SITE = "https://www.kellysdeli.co.uk";

/**
 * Constant-time string comparison. Both sides are SHA-256'd first so the compare is over
 * two fixed 32-byte buffers: timingSafeEqual throws on a length mismatch, and comparing
 * raw strings would leak the secret's length through that error path.
 */
function safeEqual(a: string, b: string): boolean {
  const h = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest();
  return crypto.timingSafeEqual(h(a), h(b));
}

/** Escape text before it goes into the XML sitemap. */
const xmlEscape = (s: string): string =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);

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
          "media-src": ["'self'", "https:"],
          "script-src": ["'self'", ...TRACKER_SCRIPT_SRC],
          "connect-src": ["'self'", ...TRACKER_CONNECT_SRC],
          "frame-src": ["'self'", ...TRACKER_FRAME_SRC],
        },
      },
    })
  );

  // Helmet doesn't set Permissions-Policy. The site uses none of these browser features:
  // no geolocation, camera or mic, and no client-side payment UI (Stripe is server-side
  // PaymentIntents only, no Stripe.js). If Stripe Elements / Payment Request is ever added,
  // switch payment to `payment=(self "https://js.stripe.com")` alongside the CSP edits.
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    next();
  });

  app.use(cors({ origin: env.clientOrigins, credentials: true }));

  // Stripe webhook — MUST see the raw body (signature verification), so it's mounted
  // before express.json() and before the coming-soon gate. No-ops with 200 until Stripe
  // is configured. When live: a verified, paid Checkout Session marks that order's deposit
  // paid — once (only from "pending"), and only if Stripe collected exactly what the order
  // owes. A mismatch is logged and left pending for the owner to look at.
  app.post("/api/payments/webhook", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
    if (!stripeEnabled()) return res.status(200).json({ received: true, note: "payments not configured" });
    let result;
    try {
      result = parseWebhook(req.body as Buffer, req.header("stripe-signature"));
    } catch (e) {
      console.error("[payments:webhook] rejected:", e instanceof Error ? e.message : e);
      return res.status(400).json({ error: "Webhook error" });
    }
    if (!result.handled) return res.status(200).json({ received: true, handled: false });
    const shopEmail = async () => (await prisma.setting.findUnique({ where: { key: "orderNotifyEmail" } }))?.value?.trim() || null;
    const problem = async (ref: string, msg: string) => {
      console.error(`[payments:webhook] ${ref}: ${msg}`);
      const to = await shopEmail();
      if (to) await notifyShopPaymentProblem(to, ref, msg).catch((err) => console.error("[payments:webhook] problem alert failed", err));
    };
    try {
      // A full refund made in the Stripe dashboard shows on the order too.
      if (result.refundedIntentId) {
        const r = await prisma.order.updateMany({ where: { depositIntentId: result.refundedIntentId, depositStatus: "paid" }, data: { depositStatus: "refunded" } });
        const simple = await recordSimpleRefund(result.refundedIntentId);
        return res.status(200).json({ received: true, handled: r.count + simple > 0 });
      }
      const ref = result.paidOrderRef!;
      // Bread (KDB-) and deli counter (KDS-) orders have their own handler; boards below.
      const simpleKind = simpleKindForRef(ref);
      if (simpleKind) {
        const handled = await recordSimplePayment(simpleKind, result, problem);
        return res.status(200).json({ received: true, handled });
      }
      const order = await prisma.order.findUnique({
        where: { ref },
        include: orderEmailInclude,
      });
      if (!order) {
        await problem(ref, `A payment was made online for order ${ref}, which no longer exists (deleted?). Refund it in Stripe.`);
        return res.status(200).json({ received: true, handled: false });
      }
      const owed = Math.round(Number(order.deposit) * 100);
      if (result.amountPaidPence !== owed) {
        await problem(ref, `Stripe collected £${((result.amountPaidPence ?? 0) / 100).toFixed(2)} but the order's deposit is £${(owed / 100).toFixed(2)}. Left as pending.`);
        return res.status(200).json({ received: true, handled: false });
      }
      if (order.status === "cancelled") {
        await problem(ref, `A £${(owed / 100).toFixed(2)} deposit was paid online for an order that is CANCELLED. It has not been marked paid.`);
        return res.status(200).json({ received: true, handled: false });
      }
      const r = await prisma.order.updateMany({
        where: { id: order.id, depositStatus: "pending" },
        data: { depositStatus: "paid", depositPaidAt: new Date(), depositIntentId: result.intentId ?? undefined },
      });
      if (r.count === 0) {
        // Already paid. The same payment arriving twice (Stripe retries) is harmless; a
        // DIFFERENT payment means the customer has been charged twice.
        if (order.depositIntentId && result.intentId && order.depositIntentId !== result.intentId) {
          await problem(ref, `This order's deposit was paid TWICE (payments ${order.depositIntentId} and ${result.intentId}). Refund one of them.`);
        } else if (order.depositStatus === "paid" && !order.confirmationSentAt && order.depositIntentId === result.intentId) {
          // Stripe retrying a payment we recorded but crashed before confirming: the emails
          // are the only confirmation the customer gets, so send them now (claimed once).
          await sendOrderEmails(order, { depositPaid: true, onlyIfFirst: true });
        }
        return res.status(200).json({ received: true, handled: false });
      }
      // Paid online on an order the shop had already confirmed or collected (a session
      // opened before the shop moved it on): the money is real, so it's recorded, but the
      // shop may also have taken the deposit by phone — flag it for a human.
      if (order.status !== "new" && order.status !== "deposit_requested") {
        await problem(ref, `The deposit was paid online, but the order was already marked "${order.status}". If you also took the deposit another way, refund one of them.`);
      }
      // The order's first emails: online orders send nothing until the deposit is paid.
      await sendOrderEmails(order, { depositPaid: true });
      res.status(200).json({ received: true, handled: true });
    } catch (e) {
      // 500 so Stripe retries: the payment is real, we just failed to record it.
      console.error("[payments:webhook] failed to record payment", e);
      res.status(500).json({ error: "Could not record payment" });
    }
  });

  app.use(express.json({ limit: "1mb" })); // cap body size (DoS)

  // Serve uploaded images (public).
  app.use("/uploads", express.static(UPLOAD_DIR));

  // Rate limits. NOTE: in-memory store — effective for a long-running/warm instance.
  // For multi-instance serverless, back this with a shared store (Redis) or a WAF.
  //
  // Two DIFFERENT skip rules, deliberately:
  //
  //   apiLimiter  — browse/order traffic. An E2E run makes hundreds of legitimate calls
  //     in a couple of minutes, so this one still honours DISABLE_RATE_LIMIT=1.
  //
  //   authLimiter — the admin-login brute-force guard. This is NEVER switched off by an
  //     env var. These two limiters used to share one skip rule, and the E2E suite runs
  //     the server with NODE_ENV=production AND DISABLE_RATE_LIMIT=1 (see
  //     playwright.config.ts) — so "production" was never the thing keeping the guard on.
  //     That meant a single stray DISABLE_RATE_LIMIT on the live host would silently
  //     remove the only limit on password guessing against /api/auth/login, with nothing
  //     in the UI or logs to show for it. Only NODE_ENV=test bypasses it now: that is
  //     vitest running supertest in-process, which no deploy ever sets.
  //
  //     max=30/15min is sized so the E2E suite (6 logins per full run) can run several
  //     times back-to-back against a reused server without tripping, while still being a
  //     hard ceiling on online guessing. Raise the window, not the max, if that ever bites.
  const isUnitTest = () => process.env.NODE_ENV === "test";
  const skipApi = () => isUnitTest() || process.env.DISABLE_RATE_LIMIT === "1";
  if (env.isProd && process.env.DISABLE_RATE_LIMIT === "1") {
    console.warn(
      "[app] DISABLE_RATE_LIMIT=1 is set in production — browse rate limits are OFF. " +
        "Admin-login rate limiting stays ON regardless. Unset this variable on the live host."
    );
  }
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, skip: skipApi });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, skip: isUnitTest, message: { error: "Too many attempts — try again later" } });

  app.get("/api/health", (_req, res) => {
    // Makes the two things that fail silently in production checkable from outside,
    // without shell access to the host and without exposing any secret:
    //   storage/uploadDir — "disk" on a container with no mounted volume means
    //     uploaded photos are destroyed on the next redeploy.
    //   email — "off" means customers never receive their order confirmation.
    res.json({
      ok: true,
      service: "kellys-deli-api",
      storage: storageMode,
      uploadDir: storageMode === "disk" ? UPLOAD_DIR : null,
      email: emailMode,
      time: new Date().toISOString(),
    });
  });

  // Whether live payments are configured. The storefront copy stays "payment-ready" until
  // this is true, so we never promise automated billing that isn't wired up.
  app.get("/api/payments/status", (_req, res) => {
    res.json({ enabled: stripeEnabled(), ...(stripeEnabled() ? { mode: stripeMode() } : {}) });
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
      { loc: "/our-story", changefreq: "monthly", priority: "0.6" },
      { loc: "/office-catering", changefreq: "monthly", priority: "0.7" },
      { loc: "/groceries", changefreq: "weekly", priority: "0.7" },
      { loc: "/bread", changefreq: "weekly", priority: "0.6" },
      { loc: "/lunch", changefreq: "weekly", priority: "0.7" },
      { loc: "/party-food-solihull", changefreq: "monthly", priority: "0.9" },
      { loc: "/bentley-heath", changefreq: "monthly", priority: "0.9" },
      { loc: "/stratford-upon-avon", changefreq: "monthly", priority: "0.9" },
      { loc: "/privacy", changefreq: "yearly", priority: "0.2" },
      { loc: "/terms", changefreq: "yearly", priority: "0.2" },
    ];
    let dynamicUrls: Array<{ loc: string; changefreq: string; priority: string; lastmod?: Date }> = [];
    try {
      const [cats, boards] = await Promise.all([
        prisma.category.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
        prisma.platter.findMany({
          where: { active: true },
          select: { id: true, updatedAt: true, variantGroup: true },
          orderBy: [{ variantOrder: "asc" }, { createdAt: "asc" }],
        }),
      ]);
      // One URL per board: other sizes of the same board canonicalise to the lead size.
      const seenGroups = new Set<string>();
      const leads = boards.filter((b) => {
        if (!b.variantGroup) return true;
        if (seenGroups.has(b.variantGroup)) return false;
        seenGroups.add(b.variantGroup);
        return true;
      });
      dynamicUrls = [
        ...cats.map((c) => ({ loc: `/shop/${c.slug}`, changefreq: "weekly", priority: "0.8", lastmod: c.updatedAt })),
        ...leads.map((b) => ({ loc: `/platter/${b.id}`, changefreq: "weekly", priority: "0.6", lastmod: b.updatedAt })),
      ];
    } catch (e) {
      console.error("[sitemap] could not load categories/boards", e);
    }
    const urls = [...staticUrls, ...dynamicUrls]
      .map(
        (u: { loc: string; changefreq: string; priority: string; lastmod?: Date }) =>
          `  <url><loc>${xmlEscape(SITE + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
      )
      .join("\n");
    res.setHeader("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  // --- Optional site-wide "coming soon" gate --------------------------------
  // When the DB Setting "sitePassword" holds a non-empty value, the whole public
  // site + public API sit behind an HTTP Basic Auth prompt, so the shop is hidden
  // from the public (and search engines) while the owner finishes setting up.
  // Exempt: the health check, the Stripe webhook, /api/auth and /api/admin — so
  // the platform stays healthy and the owner can always reach /admin, log in, and
  // switch the gate off from Site Settings. Unset/empty => fully open (default).
  // The value is cached briefly so this is not a DB hit on every request, and a DB
  // blip keeps the last known state rather than abruptly locking or unlocking.
  let sitePw = { value: "", ts: 0 };
  const sitePassword = async (): Promise<string> => {
    if (Date.now() - sitePw.ts < 30_000) return sitePw.value;
    try {
      const s = await prisma.setting.findUnique({ where: { key: "sitePassword" } });
      sitePw = { value: (s?.value ?? "").trim(), ts: Date.now() };
    } catch {
      sitePw.ts = Date.now(); // keep the last known value on a DB error
    }
    return sitePw.value;
  };
  app.use(async (req, res, next) => {
    // Admin login/API and the health check bypass the gate entirely.
    // robots.txt and llms.txt stay readable too: a 401 there tells crawlers nothing,
    // and they're the files that say what we'd like indexed once the gate comes off.
    if (
      req.path.startsWith("/api/auth") ||
      req.path.startsWith("/api/admin") ||
      req.path === "/api/health" ||
      req.path === "/robots.txt" ||
      req.path === "/llms.txt"
    ) {
      return next();
    }
    const pw = await sitePassword();
    if (!pw) return next(); // gate off
    const header = req.headers.authorization ?? "";
    if (header.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString();
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(supplied, pw)) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Kelly\'s Deli"');
    return res.status(401).send("Kelly's Deli is putting the finishing touches on — please check back very soon.");
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
      // Each route's real content is rendered into the HTML first (see lib/seo-pages.ts) so
      // crawlers that don't run JavaScript still read it. If that fails for any reason the
      // plain shell goes out instead: a DB blip must never take the shop offline.
      // index.html is read once: every deploy is a fresh container with a fresh build.
      app.get("*", seoHtmlHandler(fs.readFileSync(path.join(clientDist, "index.html"), "utf8")));
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
