import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.MATRIXONE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "MATRIXONE_URL is required (DATABASE_URL is accepted for compatibility).",
  );
}

export default defineConfig({
  dialect: "mysql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
