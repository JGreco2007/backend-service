import { eq } from "drizzle-orm";
import type { PasswordResetStore, PasswordResetTokenRecord } from "../auth/passwordResetStore";
import { db } from "./client";
import { passwordResetTokens } from "./schema";

export function createDrizzlePasswordResetStore(): PasswordResetStore {
  return {
    async create({ userId, tokenHash, expiresAt }): Promise<PasswordResetTokenRecord> {
      const [row] = await db
        .insert(passwordResetTokens)
        .values({ userId, tokenHash, expiresAt })
        .returning();
      return row;
    },

    async findByHash(tokenHash): Promise<PasswordResetTokenRecord | null> {
      const [row] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);
      return row ?? null;
    },

    async markUsed(tokenHash): Promise<void> {
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.tokenHash, tokenHash));
    },
  };
}
