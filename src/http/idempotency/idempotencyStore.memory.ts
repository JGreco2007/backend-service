import type { IdempotencyRecord, IdempotencyStore } from "./idempotencyStore";

/**
 * In-memory fake for tests. JS's single-threaded execution makes the
 * check-then-set in `claim` atomic for free — no separate locking needed,
 * unlike the Postgres-backed store which relies on a unique constraint.
 */
export function createInMemoryIdempotencyStore(): IdempotencyStore {
  const rowsByKey = new Map<string, IdempotencyRecord>();

  return {
    async claim({ key, requestHash, expiresAt }) {
      const existing = rowsByKey.get(key);
      if (existing) return existing;
      rowsByKey.set(key, { key, requestHash, responseStatus: null, responseBody: null, expiresAt });
      return null;
    },
    async complete(key, { status, body }) {
      const record = rowsByKey.get(key);
      if (record) {
        record.responseStatus = status;
        record.responseBody = body;
      }
    },
    async release(key) {
      rowsByKey.delete(key);
    },
  };
}
