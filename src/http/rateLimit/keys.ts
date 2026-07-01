import { ipKeyGenerator } from "express-rate-limit";
import type { AuthenticatedRequest } from "../../auth/middleware";

/**
 * Client IP, normalized to a /56 IPv6 subnet (express-rate-limit's own
 * helper) so a client can't dodge the limit by cycling through addresses
 * within the same IPv6 allocation. Always use this instead of raw `req.ip`
 * in a custom keyGenerator — express-rate-limit validates against that
 * mistake at startup specifically because it's such an easy way to
 * accidentally build a limiter that's trivially bypassable over IPv6.
 */
export function ipKey(req: AuthenticatedRequest): string {
  return ipKeyGenerator(req.ip ?? "unknown");
}

/** Authenticated account id. Only meaningful paired with `skip: (req) => !req.user`. */
export function accountKey(req: AuthenticatedRequest): string {
  return `account:${req.user?.id ?? "anonymous"}`;
}

/**
 * The email a login/register/password-reset request is targeting, so the
 * limit follows the *victim* account regardless of which IP the attempt
 * comes from. Falls back to IP if the body has no email, so malformed
 * requests don't all collide into one shared bucket.
 */
export function emailKey(req: AuthenticatedRequest): string {
  const email = req.body?.email;
  if (typeof email === "string" && email.trim().length > 0) {
    return `email:${email.trim().toLowerCase()}`;
  }
  return ipKey(req);
}
