import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../logging/logger";
import { redactSensitive } from "../logging/redact";
import { HttpError } from "./httpError";

/**
 * The last middleware in the chain. Anything that reaches here either is an
 * HttpError (a deliberate, safe-to-show rejection — auth failures, 404s,
 * validation errors) or is a genuine bug/infrastructure failure. The latter
 * is logged in full — including a redacted body for context — but the
 * client only ever sees a generic message and a request id to quote back
 * for support. No stack trace, file path, or connection string ever
 * reaches the response body.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Falls back to a fresh id if httpLogger (which normally assigns req.id)
  // isn't mounted — the client should always get something to quote back.
  const requestId = (req as Request & { id?: string }).id ?? randomUUID();
  logger.error(
    {
      err,
      requestId,
      method: req.method,
      path: req.path,
      body: redactSensitive(req.body),
    },
    "unhandled error"
  );

  res.status(500).json({ error: "Internal server error", requestId });
}
