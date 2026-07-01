import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { config } from "../config";
import { rateLimitExceededHandler } from "../http/rateLimit/handler";
import { emailKey, ipKey } from "../http/rateLimit/keys";
import { SlidingWindowStore } from "../http/rateLimit/slidingWindowStore";

/**
 * Brute-force targets (login, register, password-reset) get two independent
 * limiters: one by IP, one by the email/account being targeted. Either axis
 * alone can be routed around (many IPs hitting one account, or one IP
 * spraying many accounts) — both together can't be, without also being
 * throttled on whichever axis is left.
 */
function createBruteForceLimiters(): [RequestHandler, RequestHandler] {
  const byIp = rateLimit({
    windowMs: config.RATE_LIMIT_AUTH_IP_WINDOW_MS,
    limit: config.RATE_LIMIT_AUTH_IP_MAX,
    store: new SlidingWindowStore(),
    keyGenerator: ipKey,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: rateLimitExceededHandler,
  });

  const byEmail = rateLimit({
    windowMs: config.RATE_LIMIT_AUTH_IDENTIFIER_WINDOW_MS,
    limit: config.RATE_LIMIT_AUTH_IDENTIFIER_MAX,
    store: new SlidingWindowStore(),
    keyGenerator: emailKey,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: rateLimitExceededHandler,
  });

  return [byIp, byEmail];
}

export const loginRateLimiters = createBruteForceLimiters();
export const registerRateLimiters = createBruteForceLimiters();
export const passwordResetRateLimiters = createBruteForceLimiters();
