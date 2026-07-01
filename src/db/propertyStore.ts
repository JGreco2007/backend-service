import { eq } from "drizzle-orm";
import type { PropertyRecord, PropertyStore } from "../properties/propertyStore";
import { db } from "./client";
import { properties } from "./schema";

export function createDrizzlePropertyStore(): PropertyStore {
  return {
    async create(input): Promise<PropertyRecord> {
      const [row] = await db
        .insert(properties)
        .values({
          title: input.title,
          description: input.description,
          priceCents: input.priceCents ?? 0,
          acres: input.acres,
          status: input.status,
          createdBy: input.createdBy,
        })
        .returning();
      return row;
    },

    async findById(id): Promise<PropertyRecord | null> {
      const [row] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
      return row ?? null;
    },

    async update(id, patch): Promise<PropertyRecord | null> {
      const [row] = await db
        .update(properties)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(properties.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id): Promise<void> {
      await db.delete(properties).where(eq(properties.id, id));
    },
  };
}
