import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "./env";

export interface AdminClaims {
  sub: string;
  email: string;
  role: string;
}

/** Request with the authenticated admin attached. */
export interface AuthedRequest extends Request {
  admin?: AdminClaims;
}

export function signToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.jwtSecret, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): AdminClaims {
  return jwt.verify(token, env.jwtSecret) as AdminClaims;
}

/** Express middleware: requires a valid admin Bearer token. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const claims = verifyToken(header.slice(7));
    if (claims.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.admin = claims;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
