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
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: "1mb" })); // cap body size (DoS)

  // Serve uploaded images (public).
  app.use("/uploads", express.static(UPLOAD_DIR));

  // Rate limits. NOTE: in-memory store — effective for a long-running/warm instance.
  // For multi-instance serverless, back this with a shared store (Redis) or a WAF.
  const skip = () => process.env.NODE_ENV === "test"; // don't throttle the test suite
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, skip });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, skip, message: { error: "Too many attempts — try again later" } });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "kellys-deli-api", time: new Date().toISOString() });
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api", publicRouter);
  app.use("/api/admin", requireAdmin, adminRouter);

  // Generic error handler — never leak stack traces / internals to clients.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    console.error("[error]", err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
