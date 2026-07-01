import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHealthRouter } from "../src/health/routes";

function buildApp(checkDatabase: () => Promise<void>): Express {
  const app = express();
  app.use(createHealthRouter({ checkDatabase }));
  return app;
}

describe("health endpoints", () => {
  it("GET /health is always 200 and checks nothing", async () => {
    const neverCalled = () => {
      throw new Error("should not be called for liveness");
    };
    const res = await request(buildApp(neverCalled)).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /health/ready is 200 when the DB check succeeds", async () => {
    const res = await request(buildApp(async () => {})).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /health/ready is 503 when the DB check rejects", async () => {
    const res = await request(buildApp(async () => {
      throw new Error("connection refused");
    })).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error" });
  });

  it("GET /health/ready is 503 when the DB check hangs past the timeout, not left hanging forever", async () => {
    const hangingCheck = () => new Promise<void>(() => {}); // never resolves
    const res = await request(buildApp(hangingCheck)).get("/health/ready");
    expect(res.status).toBe(503);
  }, 10_000);
});
