import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: tsx scripts/db/run-sql.ts <path-to-sql-file>");
  process.exit(1);
}

const adminUrl = process.env.MIGRATION_DATABASE_URL;
if (!adminUrl) {
  console.error("MIGRATION_DATABASE_URL is required (admin/owner credential).");
  process.exit(1);
}

async function main() {
  const sql = postgres(adminUrl as string, { max: 1 });
  try {
    await sql.unsafe(readFileSync(filePath, "utf8"));
    console.log(`Applied ${filePath}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
