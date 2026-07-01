import { createHash, randomBytes } from "node:crypto";

/** A high-entropy opaque token (refresh tokens, password reset tokens). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** One-way hash used to store opaque tokens at rest — never the raw value. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
