import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "../config";
import * as schema from "./schema";

/**
 * Pushes statement_timeout onto the Postgres wire-protocol `options` startup
 * parameter, so the timeout is enforced by the server itself (survives even
 * if a client-side timeout is bypassed), not just by the driver.
 */
function withStatementTimeout(connectionString: string, timeoutMs: number): string {
  const url = new URL(connectionString);
  url.searchParams.set("options", `-c statement_timeout=${timeoutMs}`);
  return url.toString();
}

const client = postgres(withStatementTimeout(config.DATABASE_URL, config.DB_STATEMENT_TIMEOUT_MS), {
  max: config.DB_POOL_MAX,
  idle_timeout: config.DB_IDLE_TIMEOUT_SECONDS,
  connect_timeout: config.DB_CONNECT_TIMEOUT_SECONDS,
});

export const db = drizzle(client, { schema });
