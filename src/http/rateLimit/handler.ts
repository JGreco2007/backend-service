import type { RateLimitExceededEventHandler, RateLimitInfo } from "express-rate-limit";

/**
 * Shared 429 response for every limiter in the app — consistent body shape,
 * and always includes a `Retry-After` header (in seconds, per RFC 9110)
 * computed from the store's actual reset time rather than a hardcoded value.
 */
export const rateLimitExceededHandler: RateLimitExceededEventHandler = (req, res) => {
  const info = (req as unknown as { rateLimit?: RateLimitInfo }).rateLimit;
  const resetTime = info?.resetTime;
  const retryAfterSeconds = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : 60;

  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({
    error: "Too many requests. Please try again later.",
    retryAfterSeconds,
  });
};
