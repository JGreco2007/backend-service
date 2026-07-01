import { eq } from "drizzle-orm";
import type { UserRecord, UserStore } from "../auth/userStore";
import { db } from "./client";
import { users } from "./schema";

export function createDrizzleUserStore(): UserStore {
  return {
    async findByEmail(email): Promise<UserRecord | null> {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row ?? null;
    },

    async findById(id): Promise<UserRecord | null> {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return row ?? null;
    },

    async create({ email, passwordHash }): Promise<UserRecord> {
      const [row] = await db.insert(users).values({ email, passwordHash }).returning();
      return row;
    },

    async updatePasswordHash(id, passwordHash): Promise<void> {
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
    },

    async updateEmail(id, email): Promise<void> {
      await db.update(users).set({ email, updatedAt: new Date() }).where(eq(users.id, id));
    },
  };
}
