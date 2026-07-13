import path from "path";
import fs from "fs";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env";
import { publicRouter } from "./routes/public";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { requireAdmin } from "./lib/auth";
import { UPLOAD_DIR } from "./lib/uploads";

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
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "img-src": ["'self'", "data:", "https:"],
        },
      },
    })
  );

  app.use(cors({ origin: env.clientOrigins, credentials: true }));
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
