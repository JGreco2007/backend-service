import pino from "pino";
import { config } from "../config";

/**
 * Structured JSON logger. `redact` covers the fixed set of paths pino
 * itself walks (request/response headers); anything logged via an ad-hoc
 * object (e.g. `logger.error({ body }, ...)`) must be passed through
 * `redactSensitive` first — see logging/redact.ts — since pino's `redact`
 * option only knows about paths declared up front, not arbitrary shapes.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.currentPassword",
      "*.newPassword",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[Redacted]",
  },
  transport: config.NODE_ENV === "local" ? { target: "pino-pretty" } : undefined,
});
