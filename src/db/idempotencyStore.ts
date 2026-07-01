import { eq } from "drizzle-orm";
import type { IdempotencyRecord, IdempotencyStore } from "../http/idempotency/idempotencyStore";
import { db } from "./client";
import { idempotencyKeys } from "./schema";

const POSTGRES_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION;
}

export function createDrizzleIdempotencyStore(): IdempotencyStore {
  return {
    async claim({ key, requestHash, expiresAt }): Promise<IdempotencyRecord | null> {
      try {
        await db.insert(idempotencyKeys).values({ key, requestHash, expiresAt });
        return null; // No conflict — this call claimed the key.
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        const [existing] = await db
          .select()
          .from(idempotencyKeys)
          .where(eq(idempotencyKeys.key, key))
          .limit(1);
        return existing ?? null;
      }
    },

    async complete(key, { status, body }): Promise<void> {
      await db
        .update(idempotencyKeys)
        .set({ responseStatus: status, responseBody: body })
        .where(eq(idempotencyKeys.key, key));
    },

    async release(key): Promise<void> {
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    },
  };
}
