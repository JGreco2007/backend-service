import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../../config";
import { logger } from "../../logging/logger";
import type { IdempotencyStore } from "./idempotencyStore";

const IDEMPOTENCY_HEADER = "idempotency-key";

/** JSON.stringify with sorted keys, so field order in the client's retry doesn't change the hash. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashRequest(routeName: string, body: unknown): string {
  return createHash("sha256").update(`${routeName}:${stableStringify(body ?? {})}`).digest("hex");
}

/**
 * Opt-in idempotency: if the client sends an `Idempotency-Key` header, a
 * retried request with the same key returns the original response instead
 * of re-running the handler (so a network-retried "create" never creates a
 * duplicate). If the header is absent, this is a no-op — existing clients
 * that don't send one are unaffected.
 *
 * Concurrency-safe: `claim` is atomic (a unique constraint at the DB layer,
 * a plain Map check in the in-memory test store), so two requests racing in
 * with the same key can't both slip through and both run the side effect —
 * the loser gets back "already in progress," not a second execution.
 */
export function idempotent(store: IdempotencyStore, routeName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header(IDEMPOTENCY_HEADER);
    if (!key) {
      next();
      return;
    }

    const requestHash = hashRequest(routeName, req.body);
    const expiresAt = new Date(Date.now() + config.IDEMPOTENCY_KEY_TTL_HOURS * 60 * 60 * 1000);

    try {
      const existing = await store.claim({ key, requestHash, expiresAt });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          res.status(409).json({ error: "Idempotency-Key was already used with a different request body" });
          return;
        }
        if (existing.responseStatus === null) {
          res.status(409).json({ error: "A request with this Idempotency-Key is already in progress" });
          return;
        }
        res.status(existing.responseStatus).json(existing.responseBody);
        return;
      }
    } catch (err) {
      next(err);
      return;
    }

    // We won the claim — capture whatever the handler eventually sends so a
    // retry with this same key can replay it instead of re-running the
    // handler. Only successful responses are cached; a 4xx/5xx releases the
    // claim instead, so a client that hit a validation error can fix it and
    // retry with the same key rather than being stuck seeing "in progress."
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      const settle = isSuccess ? store.complete(key, { status: res.statusCode, body }) : store.release(key);
      settle.catch((err: unknown) => {
        logger.error({ err, key }, "failed to settle idempotency claim");
      });
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}
