import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { logger } from "./logger";

/**
 * Per-request access log. Deliberately never includes the request body —
 * only method/url/status/duration/request-id. If a handler needs to log
 * body context for debugging, it must go through redactSensitive first
 * (see logging/redact.ts); this middleware doesn't do it implicitly.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers["x-request-id"];
    const id = typeof existing === "string" && existing.length > 0 ? existing : randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
