import { randomUUID } from "node:crypto";
import type { UserRecord, UserStore } from "./userStore";

/** In-memory fake used by tests so auth logic can run without a live Postgres. */
export function createInMemoryUserStore(seed: UserRecord[] = []): UserStore {
  const rowsById = new Map(seed.map((u) => [u.id, u]));

  return {
    async findByEmail(email) {
      for (const row of rowsById.values()) {
        if (row.email === email) return row;
      }
      return null;
    },
    async findById(id) {
      return rowsById.get(id) ?? null;
    },
    async create({ email, passwordHash }) {
      const row: UserRecord = { id: randomUUID(), email, passwordHash, role: "agent" };
      rowsById.set(row.id, row);
      return row;
    },
    async updatePasswordHash(id, passwordHash) {
      const row = rowsById.get(id);
      if (row) row.passwordHash = passwordHash;
    },
    async updateEmail(id, email) {
      const row = rowsById.get(id);
      if (row) row.email = email;
    },
    async listAll({ limit, offset }) {
      return Array.from(rowsById.values()).slice(offset, offset + limit);
    },
    async updateRole(id, role) {
      const row = rowsById.get(id);
      if (!row) return null;
      row.role = role;
      return row;
    },
  };
}
