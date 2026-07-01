import { randomUUID } from "node:crypto";
import type { PropertyRecord, PropertyStore } from "./propertyStore";

/** In-memory fake used by tests so ownership logic can run without a live Postgres. */
export function createInMemoryPropertyStore(): PropertyStore {
  const rowsById = new Map<string, PropertyRecord>();

  return {
    async create(input) {
      const row: PropertyRecord = {
        id: randomUUID(),
        title: input.title,
        description: input.description ?? null,
        priceCents: input.priceCents ?? 0,
        acres: input.acres ?? null,
        status: input.status ?? "available",
        createdBy: input.createdBy,
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
