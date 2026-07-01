import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryUserStore } from "../src/auth/userStore.memory";
import type { UserStore } from "../src/auth/userStore";
import { createInMemoryInquiryStore } from "../src/inquiries/inquiryStore.memory";
import { createInMemoryPropertyStore } from "../src/properties/propertyStore.memory";
import { buildTestApp } from "./helpers/buildTestApp";
import { createUserAndToken } from "./helpers/testUsers";

const ADMIN_ENDPOINTS = [
  { method: "get" as const, path: "/api/admin/users" },
  { method: "patch" as const, path: "/api/admin/users/00000000-0000-0000-0000-000000000000/role" },
];

describe("admin-only endpoints", () => {
  let users: UserStore;
  let app: Express;

  beforeEach(() => {
    users = createInMemoryUserStore();
    app = buildTestApp({ users, properties: createInMemoryPropertyStore(), inquiries: createInMemoryInquiryStore() });
  });

  it("rejects a non-admin user calling every admin-only endpoint directly", async () => {
    const agent = await createUserAndToken(users, "agent");

    for (const { method, path } of ADMIN_ENDPOINTS) {
      const res = await request(app)[method](path).set("Authorization", `Bearer ${agent.token}`).send({ role: "admin" });
      expect(res.status).toBe(403);
    }
  });

  it("rejects an unauthenticated caller entirely (401, before the role check even runs)", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("a non-admin cannot use the role-change endpoint to self-promote", async () => {
    const agent = await createUserAndToken(users, "agent");

    const res = await request(app)
      .patch(`/api/admin/users/${agent.id}/role`)
      .set("Authorization", `Bearer ${agent.token}`)
      .send({ role: "admin" });

    expect(res.status).toBe(403);
    const stillAgent = await users.findById(agent.id);
    expect(stillAgent?.role).toBe("agent");
  });

  it("an admin can call the admin endpoints successfully", async () => {
    const admin = await createUserAndToken(users, "admin");
    const target = await createUserAndToken(users, "agent");

    const list = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${admin.token}`);
    expect(list.status).toBe(200);

    const promote = await request(app)
      .patch(`/api/admin/users/${target.id}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "admin" });
    expect(promote.status).toBe(200);
    expect(promote.body.role).toBe("admin");
  });

  it("clamps an oversized requested pageSize instead of returning it unbounded", async () => {
    const admin = await createUserAndToken(users, "admin");
    for (let i = 0; i < 5; i++) {
      await createUserAndToken(users, "agent");
    }

    const res = await request(app)
      .get("/api/admin/users")
      .query({ pageSize: 999999 })
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    // Clamped to config.MAX_PAGE_SIZE (100 by default), not the requested 999999.
    expect(res.body.pageSize).toBeLessThan(999999);
    expect(res.body.pageSize).toBeLessThanOrEqual(100);
  });
});
