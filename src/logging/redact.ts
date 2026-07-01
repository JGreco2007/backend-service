// Field names that must never reach a log line, regardless of where in an
// object they appear. Matched case-insensitively against object keys.
const SENSITIVE_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "jwt_secret",
  "secret",
]);

const REDACTED = "[Redacted]";
const MAX_DEPTH = 6;

/**
 * Deep-clones a value, replacing any key that looks sensitive with a fixed
 * placeholder. Used to make request bodies / arbitrary context objects safe
 * to attach to a log line — logging code should never pass raw user input
 * to the logger without going through this first.
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redactSensitive(val, depth + 1);
  }
  return result;
}
