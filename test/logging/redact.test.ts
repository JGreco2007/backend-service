import { describe, expect, it } from "vitest";
import { redactSensitive } from "../../src/logging/redact";

describe("redactSensitive", () => {
  it("redacts known sensitive fields at the top level", () => {
    const result = redactSensitive({ email: "a@b.com", password: "hunter2" }) as Record<string, unknown>;
    expect(result.email).toBe("a@b.com");
    expect(result.password).toBe("[Redacted]");
  });

  it("redacts sensitive fields nested arbitrarily deep", () => {
    const result = redactSensitive({
      user: { profile: { credentials: { token: "abc123", accessToken: "xyz" } } },
    }) as any;
    expect(result.user.profile.credentials.token).toBe("[Redacted]");
    expect(result.user.profile.credentials.accessToken).toBe("[Redacted]");
  });

  it("redacts sensitive fields inside arrays of objects", () => {
    const result = redactSensitive([{ password: "a" }, { password: "b" }]) as Array<Record<string, unknown>>;
    expect(result[0].password).toBe("[Redacted]");
    expect(result[1].password).toBe("[Redacted]");
  });

  it("matches sensitive keys case-insensitively", () => {
    const result = redactSensitive({ Password: "x", NEWPASSWORD: "y" }) as Record<string, unknown>;
    expect(result.Password).toBe("[Redacted]");
    expect(result.NEWPASSWORD).toBe("[Redacted]");
  });

  it("leaves ordinary fields untouched", () => {
    expect(redactSensitive({ title: "A Listing", priceCents: 100 })).toEqual({
      title: "A Listing",
      priceCents: 100,
    });
  });

  it("handles primitives and null without throwing", () => {
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(undefined)).toBeUndefined();
    expect(redactSensitive("just a string")).toBe("just a string");
    expect(redactSensitive(42)).toBe(42);
  });
});
