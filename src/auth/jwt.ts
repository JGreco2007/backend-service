import jwt from "jsonwebtoken";
import { config } from "../config";

// Locked to HS256 explicitly at both sign and verify time. jsonwebtoken's
// verify rejects anything whose header `alg` isn't in this list —
// including `none` and any asymmetric-algorithm-confusion attempt.
const ALLOWED_ALGORITHMS: jwt.Algorithm[] = ["HS256"];

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

export class AccessTokenError extends Error {}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ role: payload.role }, config.JWT_SECRET, {
    algorithm: "HS256",
    subject: payload.sub,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
  });
}

/**
 * Explicitly checks signature, algorithm, expiration, issuer, and audience.
 * jsonwebtoken's verify enforces all five given these options — any failure
 * (bad signature, expired, wrong alg, wrong iss/aud) throws.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ALLOWED_ALGORITHMS,
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    });
  } catch (err) {
    throw new AccessTokenError(err instanceof Error ? err.message : "Invalid token");
  }

  if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
    throw new AccessTokenError("Malformed token payload");
  }

  return { sub: decoded.sub, role: decoded.role };
}
