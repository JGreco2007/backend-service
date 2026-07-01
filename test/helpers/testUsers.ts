import { randomUUID } from "node:crypto";
import { signAccessToken } from "../../src/auth/jwt";
import type { UserStore } from "../../src/auth/userStore";

export async function createUserAndToken(users: UserStore, role: "agent" | "admin" = "agent") {
  const user = await users.create({ email: `${randomUUID()}@example.com`, passwordHash: "unused-in-tests" });
  if (role !== user.role) {
    await users.updateRole(user.id, role);
  }
  const token = signAccessToken({ sub: user.id, role });
  return { id: user.id, role, token };
}
