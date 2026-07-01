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
