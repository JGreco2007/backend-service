import { z } from "zod";

/**
 * Vars every environment must provide.
 */
const baseSchema = z.object({
  NODE_ENV: z.enum(["local", "staging", "production"]),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Connection pool sizing — bounds how many concurrent connections one
  // process can hold, so a spike in slow queries can't starve the DB.
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
  DB_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(10),
  // Server-side per-query timeout, applied via the Postgres `options` startup
  // parameter so it's enforced by Postgres itself, not just the client.
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
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
  staging: deployedSchema,
  production: productionSchema,
} as const;

export type LocalConfig = z.infer<typeof baseSchema>;
export type DeployedConfig = z.infer<typeof deployedSchema>;
export type ProductionConfig = z.infer<typeof productionSchema>;
export type AppConfig = LocalConfig | DeployedConfig | ProductionConfig;
