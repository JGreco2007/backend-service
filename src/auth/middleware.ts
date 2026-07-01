import type { NextFunction, Request, Response } from "express";
import { AccessTokenError, verifyAccessToken } from "./jwt";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

/**
 * Requires a Bearer access token and validates signature, algorithm,
 * expiration, issuer, and audience (see verifyAccessToken) before letting
 * the request through. Any failure is a 401, never a partial pass.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = await verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof AccessTokenError) {
      res.status(401).json({ error: "Invalid or expired access token" });
      return;
    }
    next(err);
  }
}

/**
 * Identifies the caller if a valid access token is present, but never
 * rejects the request — unlike requireAuth. Used ahead of routing (before
 * any router decides whether a route even requires auth) so the general
 * per-account rate limiter can key by account id when one's available,
 * while still letting anonymous requests through to routes that allow them.
 */
export async function attachUserIfPresent(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = await verifyAccessToken(header.slice("Bearer ".length));
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Not our job to reject here — an invalid/expired token just means
      // this request is treated as anonymous for rate-limiting purposes.
      // requireAuth (on routes that need it) will reject it properly.
    }
  }
  next();
}
