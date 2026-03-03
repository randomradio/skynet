import { afterEach, describe, expect, it } from "vitest";

import { getDatabaseUrl, hasDatabaseUrl } from "./env";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe("db env resolution", () => {
  it("returns true when DATABASE_URL is set", () => {
    process.env.DATABASE_URL = "mysql://root:111@127.0.0.1:6001/skynet";

    expect(hasDatabaseUrl()).toBe(true);
    expect(getDatabaseUrl()).toBe("mysql://root:111@127.0.0.1:6001/skynet");
  });

  it("throws when DATABASE_URL is not configured", () => {
    delete process.env.DATABASE_URL;

    expect(hasDatabaseUrl()).toBe(false);
    expect(() => getDatabaseUrl()).toThrow("DATABASE_URL is required.");
  });
});
