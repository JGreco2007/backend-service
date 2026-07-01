import { eq } from "drizzle-orm";
import type { InquiryRecord, InquiryStore } from "../inquiries/inquiryStore";
import { db } from "./client";
import { inquiries } from "./schema";

export function createDrizzleInquiryStore(): InquiryStore {
  return {
    async create(input): Promise<InquiryRecord> {
      const [row] = await db
        .insert(inquiries)
        .values({
          propertyId: input.propertyId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          message: input.message,
        })
        .returning();
      return row;
    },

    async findById(id): Promise<InquiryRecord | null> {
      const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
      return row ?? null;
    },

    async update(id, patch): Promise<InquiryRecord | null> {
      const [row] = await db.update(inquiries).set(patch).where(eq(inquiries.id, id)).returning();
      return row ?? null;
    },

    async delete(id): Promise<void> {
      await db.delete(inquiries).where(eq(inquiries.id, id));
    },
  };
}
