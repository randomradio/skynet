import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";

import { getDatabaseUrl, hasDatabaseUrl } from "./env";
import * as schema from "./schema";

export interface DatabaseHealth {
  status: "up" | "down" | "not_configured";
  message: string;
}

let database: MySql2Database<typeof schema> | null = null;

export function getDb(): MySql2Database<typeof schema> {
  if (database) {
    return database;
  }

  const url = getDatabaseUrl();
  // MatrixOne uses the MySQL wire protocol, so we connect with mysql2.
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 5,
  });

  database = drizzle(pool, { mode: "default", schema });
  return database;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  if (!hasDatabaseUrl()) {
    return {
      status: "not_configured",
      message: "MATRIXONE_URL is not configured (DATABASE_URL is accepted).",
    };
  }

  const url = getDatabaseUrl();

  let connection: mysql.Connection | undefined;

  try {
    connection = await mysql.createConnection(url);
    await connection.query("SELECT 1");
    return {
      status: "up",
      message: "Database connection healthy",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      status: "down",
      message,
    };
  } finally {
    await connection?.end();
  }
}
