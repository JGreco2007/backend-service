import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/http/errorHandler";
import { HttpError } from "../src/http/httpError";

function buildApp(): Express {
  const app = express();
  app.get("/safe-error", () => {
    throw new HttpError("Email already registered", 409);
  });
  app.get("/boom", () => {
    throw new Error("connection string is postgres://admin:hunter2@prod-db.internal:5432/app — something broke");
  });
  app.get("/boom-async", async () => {
    throw new Error("/etc/secrets/prod.env: ENOENT");
  });
  app.use(errorHandler);
  return app;
}

describe("global error handler", () => {
  it("passes an HttpError's own status and message straight through", async () => {
    const res = await request(buildApp()).get("/safe-error");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Email already registered" });
  });

  it("never leaks a raw error message, stack trace, or connection string for an unexpected error", async () => {
    const res = await request(buildApp()).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/postgres:\/\//);
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("prod-db.internal");
    expect(raw).not.toContain("at ");
  });

  it("never leaks a file path for an unexpected async error", async () => {
    const res = await request(buildApp()).get("/boom-async");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("/etc/secrets");
  });

  it("includes a request id the client can quote back for support, without any internal detail", async () => {
    const res = await request(buildApp()).get("/boom");
    expect(res.body).toHaveProperty("requestId");
    expect(Object.keys(res.body).sort()).toEqual(["error", "requestId"]);
  });
});
