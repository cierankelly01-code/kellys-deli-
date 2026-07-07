import { Router, type RequestHandler } from "express";

/**
 * A Router whose route methods auto-forward rejected promises to Express's error
 * handler. Express 4 ignores a handler's returned promise, so an awaited failure
 * (e.g. a transient DB error) would otherwise leave the request hanging instead of
 * returning a clean 500. Wrapping every handler with `.catch(next)` fixes that for
 * all routes at once, without touching each handler. (Express 5 does this natively.)
 */
const wrap = (h: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(h(req, res, next)).catch(next);
};

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export function asyncRouter(): Router {
  const r = Router();
  for (const m of METHODS) {
    const orig = (r[m] as (...a: unknown[]) => unknown).bind(r);
    (r as unknown as Record<string, unknown>)[m] = (path: string, ...handlers: RequestHandler[]) =>
      orig(path, ...handlers.map((h) => (typeof h === "function" ? wrap(h) : h)));
  }
  return r;
}
