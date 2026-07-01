import { eq } from "drizzle-orm";
import type { RefreshTokenRecord, RefreshTokenStore } from "../auth/refreshTokenStore";
import { db } from "./client";
import { refreshTokens } from "./schema";

export function createDrizzleRefreshTokenStore(): RefreshTokenStore {
  return {
    async create({ userId, tokenHash, expiresAt }): Promise<RefreshTokenRecord> {
      const [row] = await db
        .insert(refreshTokens)
        .values({ userId, tokenHash, expiresAt })
        .returning();
      return row;
    },

    async findByHash(tokenHash): Promise<RefreshTokenRecord | null> {
      const [row] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
      return row ?? null;
    },

    async revokeByHash(tokenHash): Promise<void> {
      await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.tokenHash, tokenHash));
    },

    async revokeAllForUser(userId): Promise<void> {
      await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, userId));
    },
  };
}
