import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryUserStore } from "../src/auth/userStore.memory";
import { createInMemoryInquiryStore } from "../src/inquiries/inquiryStore.memory";
import { createInMemoryPropertyStore } from "../src/properties/propertyStore.memory";
import type { InquiryStore } from "../src/inquiries/inquiryStore";
import type { PropertyStore } from "../src/properties/propertyStore";
import type { UserStore } from "../src/auth/userStore";
import { buildTestApp } from "./helpers/buildTestApp";
import { createUserAndToken } from "./helpers/testUsers";

const METHODS = ["get", "put", "patch", "delete"] as const;
type Method = (typeof METHODS)[number];

function sendAs(app: Express, method: Method, url: string, token: string, body?: Record<string, unknown>) {
  const req = request(app)[method](url).set("Authorization", `Bearer ${token}`);
  return body ? req.send(body) : req;
}

describe("per-object ownership authorization", () => {
  let users: UserStore;
  let properties: PropertyStore;
  let inquiries: InquiryStore;
  let app: Express;

  beforeEach(() => {
    users = createInMemoryUserStore();
    properties = createInMemoryPropertyStore();
    inquiries = createInMemoryInquiryStore();
    app = buildTestApp({ users, properties, inquiries });
  });

  describe("properties", () => {
    it("user A gets 403/404 (never the data) on GET/PUT/PATCH/DELETE of user B's property", async () => {
      const userA = await createUserAndToken(users);
      const userB = await createUserAndToken(users);

      const created = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${userB.token}`)
        .send({ title: "B's Ranch", priceCents: 500_000 });
      expect(created.status).toBe(201);
      const propertyId = created.body.id as string;

      for (const method of METHODS) {
        const body = method === "put" ? { title: "hijacked", priceCents: 1 } : { title: "hijacked" };
        const res = await sendAs(app, method, `/api/properties/${propertyId}`, userA.token, body);
        expect([403, 404]).toContain(res.status);
        expect(JSON.stringify(res.body)).not.toContain("B's Ranch");
      }

      // The resource must be provably untouched, not just "the response looked right."
      const untouched = await properties.findById(propertyId);
      expect(untouched?.title).toBe("B's Ranch");

      // Sanity check: the actual owner can do all four.
      const ownerGet = await sendAs(app, "get", `/api/properties/${propertyId}`, userB.token);
      expect(ownerGet.status).toBe(200);
    });

    it("an admin can access another user's property", async () => {
      const owner = await createUserAndToken(users);
      const admin = await createUserAndToken(users, "admin");
      const created = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "Owner's listing", priceCents: 1 });

      const res = await sendAs(app, "get", `/api/properties/${created.body.id}`, admin.token);
      expect(res.status).toBe(200);
    });

    it("cannot smuggle createdBy through the request body", async () => {
      const userA = await createUserAndToken(users);
      const userB = await createUserAndToken(users);

      const res = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({ title: "sneaky", priceCents: 1, createdBy: userB.id });

      expect(res.status).toBe(201);
      expect(res.body.createdBy).toBe(userA.id);
    });

    it("a nonexistent property id also returns 404, indistinguishable from 'not yours'", async () => {
      const userA = await createUserAndToken(users);
      const res = await sendAs(app, "get", "/api/properties/00000000-0000-0000-0000-000000000000", userA.token);
      expect(res.status).toBe(404);
    });
  });

  describe("inquiries (ownership derived through the parent property)", () => {
    it("user A gets 403/404 on GET/PUT/PATCH/DELETE of an inquiry on user B's property", async () => {
      const userA = await createUserAndToken(users);
      const userB = await createUserAndToken(users);

      const property = await properties.create({ createdBy: userB.id, title: "B listing", priceCents: 1 });
      const inquiry = await inquiries.create({ propertyId: property.id, name: "Lead", email: "lead@example.com" });

      for (const method of METHODS) {
        const res = await sendAs(app, method, `/api/inquiries/${inquiry.id}`, userA.token, { status: "contacted" });
        expect([403, 404]).toContain(res.status);
      }

      const untouched = await inquiries.findById(inquiry.id);
      expect(untouched?.status).toBe("new");

      const ownerGet = await sendAs(app, "get", `/api/inquiries/${inquiry.id}`, userB.token);
      expect(ownerGet.status).toBe(200);
    });

    it("cannot smuggle name/email/message through the update body — only status is writable", async () => {
      const owner = await createUserAndToken(users);
      const property = await properties.create({ createdBy: owner.id, title: "Listing", priceCents: 1 });
      const inquiry = await inquiries.create({ propertyId: property.id, name: "Lead", email: "lead@example.com" });

      const res = await request(app)
        .patch(`/api/inquiries/${inquiry.id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ status: "contacted", name: "Renamed Lead", email: "attacker@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("contacted");
      expect(res.body.name).toBe("Lead");
      expect(res.body.email).toBe("lead@example.com");
    });

    it("an inquiry with no property (unassigned) is admin-only, not owner-by-default", async () => {
      const someUser = await createUserAndToken(users);
      const admin = await createUserAndToken(users, "admin");
      const orphanInquiry = await inquiries.create({ name: "General", email: "general@example.com" });

      const userRes = await sendAs(app, "get", `/api/inquiries/${orphanInquiry.id}`, someUser.token);
      expect(userRes.status).toBe(404);

      const adminRes = await sendAs(app, "get", `/api/inquiries/${orphanInquiry.id}`, admin.token);
      expect(adminRes.status).toBe(200);
    });
  });
});
