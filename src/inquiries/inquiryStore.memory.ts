import { randomUUID } from "node:crypto";
import type { InquiryRecord, InquiryStore } from "./inquiryStore";

/** In-memory fake used by tests so ownership logic can run without a live Postgres. */
export function createInMemoryInquiryStore(): InquiryStore {
  const rowsById = new Map<string, InquiryRecord>();

  return {
    async create(input) {
      const row: InquiryRecord = {
        id: randomUUID(),
        propertyId: input.propertyId ?? null,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        message: input.message ?? null,
        status: "new",
      };
      rowsById.set(row.id, row);
      return row;
    },
    async findById(id) {
      return rowsById.get(id) ?? null;
    },
    async update(id, patch) {
      const row = rowsById.get(id);
      if (!row) return null;
      Object.assign(row, patch);
      return row;
    },
    async delete(id) {
      rowsById.delete(id);
    },
  };
}
