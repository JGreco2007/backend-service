import dotenv from "dotenv";
import { schemaForEnv, type AppConfig } from "./schema";

dotenv.config();

function loadConfig(): AppConfig {
  const rawEnv = process.env.NODE_ENV ?? "local";
  const schema = schemaForEnv[rawEnv as keyof typeof schemaForEnv];

  if (!schema) {
    throw new Error(
      `Invalid NODE_ENV "${rawEnv}". Expected one of: ${Object.keys(schemaForEnv).join(", ")}`
    );
  }

  const result = schema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Missing or invalid environment variables for NODE_ENV="${rawEnv}":\n${issues}\n\n` +
        `Check .env (local) or your deployment platform's environment variable settings ` +
        `against .env.example.`
    );
  }

  return result.data;
}

export const config = loadConfig();
