import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryUserStore } from "../src/auth/userStore.memory";
import type { UserStore } from "../src/auth/userStore";
import { createInMemoryIdempotencyStore } from "../src/http/idempotency/idempotencyStore.memory";
import type { IdempotencyStore } from "../src/http/idempotency/idempotencyStore";
import { createInMemoryInquiryStore } from "../src/inquiries/inquiryStore.memory";
import type { InquiryStore } from "../src/inquiries/inquiryStore";
import { createInMemoryPropertyStore } from "../src/properties/propertyStore.memory";
import type { PropertyStore } from "../src/properties/propertyStore";
import { buildTestApp } from "./helpers/buildTestApp";
import { createUserAndToken } from "./helpers/testUsers";

describe("idempotency key support", () => {
  let app: Express;
  let users: UserStore;
  let properties: PropertyStore;
  let inquiries: InquiryStore;
  let idempotency: IdempotencyStore;

  beforeEach(() => {
    users = createInMemoryUserStore();
    properties = createInMemoryPropertyStore();
    inquiries = createInMemoryInquiryStore();
    idempotency = createInMemoryIdempotencyStore();
    app = buildTestApp({ users, properties, inquiries, idempotency });
  });

  describe("POST /api/properties", () => {
    it("without an Idempotency-Key header, repeated identical POSTs create separate resources (baseline)", async () => {
      const agent = await createUserAndToken(users);
      const body = { title: "A Listing", priceCents: 100 };

      const first = await request(app).post("/api/properties").set("Authorization", `Bearer ${agent.token}`).send(body);
      const second = await request(app).post("/api/properties").set("Authorization", `Bearer ${agent.token}`).send(body);

      expect(first.body.id).not.toBe(second.body.id);
    });

    it("replays the original response for a repeated request with the same Idempotency-Key", async () => {
      const agent = await createUserAndToken(users);
      const body = { title: "A Listing", priceCents: 100 };
      const key = "test-key-1";

      const first = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${agent.token}`)
        .set("Idempotency-Key", key)
        .send(body);
      expect(first.status).toBe(201);

      const second = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${agent.token}`)
        .set("Idempotency-Key", key)
        .send(body);

      expect(second.status).toBe(201);
      expect(second.body).toEqual(first.body); // same id — not a new resource
    });

    it("rejects reusing the same Idempotency-Key with a different request body", async () => {
      const agent = await createUserAndToken(users);
      const key = "test-key-2";

      const first = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${agent.token}`)
        .set("Idempotency-Key", key)
        .send({ title: "Original", priceCents: 100 });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${agent.token}`)
        .set("Idempotency-Key", key)
        .send({ title: "Different", priceCents: 999 });

      expect(second.status).toBe(409);
    });

    it("releases the claim on a validation failure, so the same key can be retried after fixing the request", async () => {
      const agent = await createUserAndToken(users);
      const key = "test-key-3";

      const failed = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${agent.token}`)
        .set("Idempotency-Key", key)
        .send({ title: "Missing priceCents" }); // priceCents omitted -> 400
      expect(failed.status).toBe(400);

      const retried = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${agent.token}`)
        .set("Idempotency-Key", key)
        .send({ title: "Fixed now", priceCents: 500 });
      expect(retried.status).toBe(201);
    });

    it("two concurrent requests with the same key never create the resource twice", async () => {
      const agent = await createUserAndToken(users);
      const key = "test-key-concurrent";
      const body = { title: "Race Listing", priceCents: 100 };

      const send = () =>
        request(app).post("/api/properties").set("Authorization", `Bearer ${agent.token}`).set("Idempotency-Key", key).send(body);

      const [resA, resB] = await Promise.all([send(), send()]);

      // Either both see the same successful, replayed response, or the
      // loser of the race sees "already in progress" — either way, the
      // side effect must only have happened once.
      for (const res of [resA, resB]) {
        expect([201, 409]).toContain(res.status);
      }
      const created = [resA, resB].filter((r) => r.status === 201);
      if (created.length === 2) {
        expect(created[0].body).toEqual(created[1].body);
      }
    });
  });

  describe("POST /api/inquiries (public, no auth)", () => {
    it("a repeated form submission with the same key doesn't create a duplicate lead", async () => {
      const key = "inquiry-key-1";
      const body = { name: "Lead", email: "lead@example.com" };

      const first = await request(app).post("/api/inquiries").set("Idempotency-Key", key).send(body);
      const second = await request(app).post("/api/inquiries").set("Idempotency-Key", key).send(body);

      expect(first.status).toBe(201);
      expect(second.body).toEqual(first.body);
    });
  });
});
