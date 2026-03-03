import { afterEach, describe, expect, it } from "vitest";

import { getMatrixOneUrl, hasMatrixOneUrl } from "./env";

const originalMatrixOneUrl = process.env.MATRIXONE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalMatrixOneUrl === undefined) {
    delete process.env.MATRIXONE_URL;
  } else {
    process.env.MATRIXONE_URL = originalMatrixOneUrl;
  }

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe("db env resolution", () => {
  it("prefers MATRIXONE_URL when both are set", () => {
    process.env.MATRIXONE_URL = "mysql://matrixone-primary";
    process.env.DATABASE_URL = "mysql://legacy-fallback";

    expect(hasMatrixOneUrl()).toBe(true);
    expect(getMatrixOneUrl()).toBe("mysql://matrixone-primary");
  });

  it("falls back to DATABASE_URL for compatibility", () => {
    delete process.env.MATRIXONE_URL;
    process.env.DATABASE_URL = "mysql://legacy-fallback";

    expect(hasMatrixOneUrl()).toBe(true);
    expect(getMatrixOneUrl()).toBe("mysql://legacy-fallback");
  });

  it("throws when neither variable is configured", () => {
    delete process.env.MATRIXONE_URL;
    delete process.env.DATABASE_URL;

    expect(hasMatrixOneUrl()).toBe(false);
    expect(() => getMatrixOneUrl()).toThrow(
      "MATRIXONE_URL is required (DATABASE_URL is accepted for compatibility).",
    );
  });
});
