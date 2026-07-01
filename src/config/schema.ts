import { z } from "zod";

/**
 * Vars every environment must provide.
 */
const baseSchema = z.object({
  // "test" is included because test runners (vitest, jest, etc.) set
  // NODE_ENV=test automatically — it has the same requirements as "local".
  NODE_ENV: z.enum(["local", "test", "staging", "production"]),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // HS256 signing key. 32+ chars (256 bits hex-encoded = 64 chars) so brute
  // forcing the secret isn't cheaper than brute forcing the token itself.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ISSUER: z.string().min(1).default("backend-service"),
  JWT_AUDIENCE: z.string().min(1).default("backend-service-clients"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 min
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Connection pool sizing — bounds how many concurrent connections one
  // process can hold, so a spike in slow queries can't starve the DB.
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
  DB_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(10),
  // Server-side per-query timeout, applied via the Postgres `options` startup
  // parameter so it's enforced by Postgres itself, not just the client.
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  // How many hops of X-Forwarded-For to trust when deriving the real client
  // IP (Express's `trust proxy`). Wrong in either direction is a real bug:
  // too low and every client behind the LB looks like the same IP (rate
  // limiting becomes global); too high and a client can spoof their own
  // X-Forwarded-For entry to bypass IP-based limits entirely. Set this to
  // the exact number of reverse proxies between the client and this process.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

  // Hard cap on request body size — independent of any per-field validation,
  // so a client can't exhaust memory/CPU with an oversized payload before
  // that validation even runs.
  BODY_SIZE_LIMIT: z.string().min(1).default("100kb"),

  // Pagination: a client-supplied pageSize is clamped to this regardless of
  // what it asks for, so no endpoint can be made to return unbounded rows.
  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().default(100),

  // General limits applied to every request, on two independent axes: the
  // caller's IP (catches abuse from a single source regardless of account)
  // and, when authenticated, their account id (catches a single compromised
  // or malicious account spread across many IPs/devices).
  RATE_LIMIT_GENERAL_IP_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_GENERAL_IP_WINDOW_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  RATE_LIMIT_GENERAL_ACCOUNT_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_GENERAL_ACCOUNT_WINDOW_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),

  // Stricter limits for brute-force-able endpoints (login, register,
  // password-reset request), applied on both the caller's IP and the
  // account/email being targeted — so an attacker can't get around one axis
  // by spreading requests across the other.
  RATE_LIMIT_AUTH_IP_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AUTH_IP_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_IDENTIFIER_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_IDENTIFIER_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),

  // Tighter limit for the app's one currently-expensive endpoint: the
  // unpaginated-by-default admin user listing. See summary for why nothing
  // else in this app qualifies yet (no search/export/upload endpoints exist).
  RATE_LIMIT_ADMIN_LIST_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_ADMIN_LIST_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
});

/**
 * Extra vars required once traffic is real (staging + production).
 */
const deployedSchema = baseSchema.extend({
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  SENTRY_DSN: z.url("SENTRY_DSN must be a valid URL"),
});

/**
 * Extra vars required only in production (live third-party credentials).
 */
const productionSchema = deployedSchema.extend({
  STRIPE_SECRET_KEY: z
    .string()
    .startsWith("sk_live_", "production must use a live Stripe secret key"),
});

export const schemaForEnv = {
  local: baseSchema,
  test: baseSchema,
  staging: deployedSchema,
  production: productionSchema,
} as const;

export type LocalConfig = z.infer<typeof baseSchema>;
export type DeployedConfig = z.infer<typeof deployedSchema>;
export type ProductionConfig = z.infer<typeof productionSchema>;
export type AppConfig = LocalConfig | DeployedConfig | ProductionConfig;
