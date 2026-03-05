#!/usr/bin/env node

/**
 * Database setup script for Skynet.
 *
 * Creates the database and applies all migrations against MatrixOne.
 * drizzle-kit migrate/push don't work with MatrixOne due to SERIAL type
 * and introspection incompatibilities, so we run SQL files directly.
 *
 * Usage:
 *   node scripts/db-setup.mjs          # create DB + apply migrations
 *   node scripts/db-setup.mjs --reset  # drop and recreate everything
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const migrationsDir = resolve(rootDir, "packages/db/drizzle");

const reset = process.argv.includes("--reset");

// ── Load .env ──────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(rootDir, ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL is not set.\n");
  console.error("Quick fix:");
  console.error("  1. cp .env.example .env");
  console.error("  2. Edit .env with your database credentials");
  console.error("  3. Run this command again");
  process.exit(1);
}

// ── Parse URL ──────────────────────────────────────────
const url = new URL(databaseUrl);
const dbName = url.pathname.slice(1);
const serverUrl = new URL(databaseUrl);
serverUrl.pathname = "/";

// ── Step 1: Create database ────────────────────────────
let conn;
try {
  console.log(`Connecting to ${url.hostname}:${url.port || 3306}...`);
  conn = await createConnection(serverUrl.toString());

  if (reset) {
    console.log(`Dropping database "${dbName}"...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  }

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  console.log(`Database "${dbName}" ready.`);
  await conn.end();
} catch (err) {
  console.error(`Failed to connect: ${err.message}\n`);
  console.error("Is the database server running?");
  console.error("  docker compose up -d    # start MatrixOne");
  process.exit(1);
}

// ── Step 2: Connect to the database ────────────────────
conn = await createConnection(databaseUrl);

// ── Step 3: Create migration tracking table ────────────
await conn.query(`
  CREATE TABLE IF NOT EXISTS \`__skynet_migrations\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`applied_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`name\` (\`name\`)
  )
`);

// ── Step 4: Get applied migrations ─────────────────────
const [rows] = await conn.query(
  "SELECT name FROM `__skynet_migrations` ORDER BY id",
);
const applied = new Set(rows.map((r) => r.name));

// ── Step 5: Find and apply pending migrations ──────────
const sqlFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let appliedCount = 0;

for (const file of sqlFiles) {
  if (applied.has(file)) {
    continue;
  }

  console.log(`Applying ${file}...`);
  const sql = readFileSync(resolve(migrationsDir, file), "utf-8");

  // Split on Drizzle's statement-breakpoint marker
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (err) {
      // Ignore "table already exists" and "duplicate column" for idempotency
      if (err.errno === 1050 || err.errno === 1060) {
        console.log(`  (skipped: ${err.message.split("\n")[0]})`);
        continue;
      }
      console.error(`  FAILED: ${stmt.slice(0, 100)}...`);
      console.error(`  Error: ${err.message}`);
      await conn.end();
      process.exit(1);
    }
  }

  await conn.query(
    "INSERT INTO `__skynet_migrations` (name) VALUES (?)",
    [file],
  );
  appliedCount++;
  console.log(`  Applied.`);
}

if (appliedCount === 0) {
  console.log("All migrations already applied.");
} else {
  console.log(`\nApplied ${appliedCount} migration(s).`);
}

// ── Step 6: Apply schema patches for MatrixOne ─────────
// These handle changes that were applied manually and aren't in migration files.
const patches = [
  {
    name: "patch_pull_requests_table",
    sql: `CREATE TABLE IF NOT EXISTS \`pull_requests\` (
      \`id\` varchar(36) NOT NULL,
      \`github_id\` bigint NOT NULL,
      \`number\` int NOT NULL,
      \`repo_owner\` varchar(100) NOT NULL,
      \`repo_name\` varchar(100) NOT NULL,
      \`title\` text NOT NULL,
      \`body\` text,
      \`state\` enum('open','closed','merged') NOT NULL,
      \`head_branch\` varchar(200) NOT NULL,
      \`base_branch\` varchar(200) NOT NULL,
      \`author_github_id\` bigint,
      \`linked_issue_numbers\` json,
      \`additions\` int,
      \`deletions\` int,
      \`changed_files\` int,
      \`created_at\` timestamp,
      \`updated_at\` timestamp,
      \`merged_at\` timestamp,
      \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`pull_requests_github_id_unique\` (\`github_id\`)
    )`,
  },
  {
    name: "patch_messages_author_type_system",
    sql: `ALTER TABLE \`messages\` MODIFY COLUMN \`author_type\` enum('user','ai','system') NOT NULL`,
  },
];

for (const patch of patches) {
  if (applied.has(patch.name)) continue;

  try {
    await conn.query(patch.sql);
    await conn.query(
      "INSERT INTO `__skynet_migrations` (name) VALUES (?)",
      [patch.name],
    );
    console.log(`Applied patch: ${patch.name}`);
  } catch (err) {
    if (err.errno === 1050 || err.errno === 1060) {
      // Already exists — record it
      await conn.query(
        "INSERT IGNORE INTO `__skynet_migrations` (name) VALUES (?)",
        [patch.name],
      );
      console.log(`Patch already applied: ${patch.name}`);
    } else {
      console.error(`Patch ${patch.name} failed: ${err.message}`);
    }
  }
}

await conn.end();
console.log("\nDatabase setup complete!");
