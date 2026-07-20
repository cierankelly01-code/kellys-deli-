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
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): AdminClaims {
  // Pin the algorithm: never accept a token signed with a different alg (defense-in-depth
  // against algorithm-confusion / alg:none), even though jsonwebtoken@9 rejects those by default.
  return jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as AdminClaims;
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
