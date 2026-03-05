import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env from monorepo root (two levels up from packages/db).
// Use process.cwd() fallback since drizzle-kit bundles config as CJS
// where import.meta.dirname is unavailable.
const baseDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : process.cwd();

// Try package dir first (../../.env), then cwd (which may already be root)
for (const candidate of [
  resolve(baseDir, "../../.env"),
  resolve(baseDir, ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), ".env"),
]) {
  if (existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required.\n" +
      "Set it in the root .env file or as an environment variable.\n" +
      "Example: DATABASE_URL=\"mysql://root:111@127.0.0.1:6001/skynet\"\n" +
      "Run `cp .env.example .env` in the repo root to get started.",
  );
}

export default defineConfig({
  dialect: "mysql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  // NOTE: drizzle-kit push/introspect does NOT work with MatrixOne because
  // MatrixOne returns lowercase keys (table_name) in information_schema while
  // drizzle-kit expects uppercase (TABLE_NAME).  Use `node scripts/db-setup.mjs`
  // instead to apply migrations directly.
});
