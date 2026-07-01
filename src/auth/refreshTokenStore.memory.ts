import { randomUUID } from "node:crypto";
import type { RefreshTokenRecord, RefreshTokenStore } from "./refreshTokenStore";

/** In-memory fake used by tests so auth logic can run without a live Postgres. */
export function createInMemoryRefreshTokenStore(): RefreshTokenStore {
  const rowsByHash = new Map<string, RefreshTokenRecord>();

  return {
    async create({ userId, tokenHash, expiresAt }) {
      const row: RefreshTokenRecord = { id: randomUUID(), userId, tokenHash, revoked: false, expiresAt };
      rowsByHash.set(tokenHash, row);
      return row;
    },
    async findByHash(tokenHash) {
      return rowsByHash.get(tokenHash) ?? null;
    },
    async revokeByHash(tokenHash) {
      const row = rowsByHash.get(tokenHash);
      if (row) row.revoked = true;
    },
    async revokeAllForUser(userId) {
      for (const row of rowsByHash.values()) {
        if (row.userId === userId) row.revoked = true;
      }
    },
  };
}
