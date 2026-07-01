import { rateLimit } from "express-rate-limit";
import type { AuthenticatedRequest } from "../../auth/middleware";
import { config } from "../../config";
import { rateLimitExceededHandler } from "./handler";
import { accountKey, ipKey } from "./keys";
import { SlidingWindowStore } from "./slidingWindowStore";

/** Applies to every request, keyed by IP — catches abuse regardless of account. */
export const generalIpLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_GENERAL_IP_WINDOW_MS,
  limit: config.RATE_LIMIT_GENERAL_IP_MAX,
  store: new SlidingWindowStore(),
  keyGenerator: ipKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitExceededHandler,
});

/**
 * Applies only to authenticated requests, keyed by account id — catches a
 * single compromised or malicious account spread across many IPs/devices,
 * independent of the per-IP limit above.
 */
export const generalAccountLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_GENERAL_ACCOUNT_WINDOW_MS,
  limit: config.RATE_LIMIT_GENERAL_ACCOUNT_MAX,
  store: new SlidingWindowStore(),
  keyGenerator: accountKey,
  skip: (req: AuthenticatedRequest) => !req.user,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitExceededHandler,
});
