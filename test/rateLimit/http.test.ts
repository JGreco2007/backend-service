import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signAccessToken } from "../../src/auth/jwt";
import { attachUserIfPresent } from "../../src/auth/middleware";
import { rateLimitExceededHandler } from "../../src/http/rateLimit/handler";
import { accountKey, ipKey } from "../../src/http/rateLimit/keys";
import { SlidingWindowStore } from "../../src/http/rateLimit/slidingWindowStore";

function buildIpLimitedApp(limit: number): Express {
  const app = express();
  app.set("trust proxy", 1);
  const limiter = rateLimit({
    windowMs: 60_000,
    limit,
    store: new SlidingWindowStore(),
    keyGenerator: ipKey,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: rateLimitExceededHandler,
  });
  app.use(limiter);
  app.get("/thing", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("rate limit HTTP behavior", () => {
  it("returns a clear 429 with a Retry-After header once the limit is hit", async () => {
    const app = buildIpLimitedApp(2);

    await request(app).get("/thing").expect(200);
    await request(app).get("/thing").expect(200);
    const res = await request(app).get("/thing");

    expect(res.status).toBe(429);
    expect(res.headers).toHaveProperty("retry-after");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    expect(res.body).toMatchObject({ error: expect.any(String), retryAfterSeconds: expect.any(Number) });
  });

  it("reads the real client IP from X-Forwarded-For when trust proxy is configured", async () => {
    const app = buildIpLimitedApp(1);

    // Two different forwarded IPs get independent quotas...
    await request(app).get("/thing").set("X-Forwarded-For", "203.0.113.1").expect(200);
    await request(app).get("/thing").set("X-Forwarded-For", "203.0.113.2").expect(200);

    // ...but the same forwarded IP hits its own limit on the second request.
    const res = await request(app).get("/thing").set("X-Forwarded-For", "203.0.113.1");
    expect(res.status).toBe(429);
  });

  it("without trust proxy configured, X-Forwarded-For is ignored (fails closed, not open)", async () => {
    const app = express();
    // No app.set('trust proxy', ...) — Express ignores X-Forwarded-For here.
    const limiter = rateLimit({
      windowMs: 60_000,
      limit: 1,
      store: new SlidingWindowStore(),
      keyGenerator: ipKey,
      handler: rateLimitExceededHandler,
    });
    app.use(limiter);
    app.get("/thing", (_req, res) => res.json({ ok: true }));

    await request(app).get("/thing").set("X-Forwarded-For", "203.0.113.1").expect(200);
    // Different claimed X-Forwarded-For, but since it's untrusted, both
    // requests are keyed by the same real (loopback) connection IP.
    const res = await request(app).get("/thing").set("X-Forwarded-For", "203.0.113.2");
    expect(res.status).toBe(429);
  });

  it("per-IP and per-account limits are independent", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(attachUserIfPresent);

    const ipLimiter = rateLimit({
      windowMs: 60_000,
      limit: 100, // generous — this test is about the account axis
      store: new SlidingWindowStore(),
      keyGenerator: ipKey,
      handler: rateLimitExceededHandler,
    });
    const accountLimiter = rateLimit({
      windowMs: 60_000,
      limit: 1,
      store: new SlidingWindowStore(),
      keyGenerator: accountKey,
      skip: (req) => !("user" in req && req.user),
      handler: rateLimitExceededHandler,
    });
    app.use(ipLimiter, accountLimiter);
    app.get("/thing", (_req, res) => res.json({ ok: true }));

    const tokenA = signAccessToken({ sub: "user-a", role: "agent" });
    const tokenB = signAccessToken({ sub: "user-b", role: "agent" });

    // User A's first request succeeds, second is blocked by their own quota...
    await request(app).get("/thing").set("Authorization", `Bearer ${tokenA}`).expect(200);
    const blockedA = await request(app).get("/thing").set("Authorization", `Bearer ${tokenA}`);
    expect(blockedA.status).toBe(429);

    // ...but user B, from the same IP, has an entirely separate quota.
    const okB = await request(app).get("/thing").set("Authorization", `Bearer ${tokenB}`);
    expect(okB.status).toBe(200);
  });
});
