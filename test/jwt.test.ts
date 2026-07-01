import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { AccessTokenError, signAccessToken, verifyAccessToken } from "../src/auth/jwt";
import { config } from "../src/config";

describe("access tokens", () => {
  it("verifies a freshly signed token", () => {
    const token = signAccessToken({ sub: "user-1", role: "agent" });
    expect(verifyAccessToken(token)).toEqual({ sub: "user-1", role: "agent" });
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ role: "agent" }, config.JWT_SECRET, {
      algorithm: "HS256",
      subject: "user-1",
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      expiresIn: -10, // already in the past
    });
    expect(() => verifyAccessToken(expired)).toThrow(AccessTokenError);
  });

  it("rejects a token with the wrong issuer", () => {
    const badIssuer = jwt.sign({ role: "agent" }, config.JWT_SECRET, {
      algorithm: "HS256",
      subject: "user-1",
      issuer: "someone-elses-service",
      audience: config.JWT_AUDIENCE,
      expiresIn: 900,
    });
    expect(() => verifyAccessToken(badIssuer)).toThrow(AccessTokenError);
  });

  it("rejects a token with the wrong audience", () => {
    const badAudience = jwt.sign({ role: "agent" }, config.JWT_SECRET, {
      algorithm: "HS256",
      subject: "user-1",
      issuer: config.JWT_ISSUER,
      audience: "someone-elses-clients",
      expiresIn: 900,
    });
    expect(() => verifyAccessToken(badAudience)).toThrow(AccessTokenError);
  });

  it("rejects a token signed with an unexpected algorithm", () => {
    const wrongAlg = jwt.sign({ role: "agent" }, config.JWT_SECRET, {
      algorithm: "HS384", // valid signature, wrong algorithm for our allowlist
      subject: "user-1",
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      expiresIn: 900,
    });
    expect(() => verifyAccessToken(wrongAlg)).toThrow(AccessTokenError);
  });

  it("rejects an unsigned 'none' algorithm token", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        role: "admin",
        iss: config.JWT_ISSUER,
        aud: config.JWT_AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 900,
      })
    ).toString("base64url");
    expect(() => verifyAccessToken(`${header}.${payload}.`)).toThrow(AccessTokenError);
  });
});
