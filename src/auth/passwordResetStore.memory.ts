import { randomUUID } from "node:crypto";
import type { PasswordResetStore, PasswordResetTokenRecord } from "./passwordResetStore";

/** In-memory fake used by tests so auth logic can run without a live Postgres. */
export function createInMemoryPasswordResetStore(): PasswordResetStore {
  const rowsByHash = new Map<string, PasswordResetTokenRecord>();

  return {
    async create({ userId, tokenHash, expiresAt }) {
      const row: PasswordResetTokenRecord = { id: randomUUID(), userId, tokenHash, usedAt: null, expiresAt };
      rowsByHash.set(tokenHash, row);
      return row;
    },
    async findByHash(tokenHash) {
      return rowsByHash.get(tokenHash) ?? null;
    },
    async markUsed(tokenHash) {
      const row = rowsByHash.get(tokenHash);
      if (row) row.usedAt = new Date();
    },
  };
}
