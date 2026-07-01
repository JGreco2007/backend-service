import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../auth/middleware";

/**
 * Centralized role gate for admin-only/privileged endpoints. Enforced
 * server-side against the role embedded in the verified access token —
 * nothing the frontend hides can bypass this.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
