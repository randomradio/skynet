function resolveMatrixOneUrl(): string | null {
  return process.env.MATRIXONE_URL ?? process.env.DATABASE_URL ?? null;
}

export function hasMatrixOneUrl(): boolean {
  return Boolean(resolveMatrixOneUrl());
}

export function getMatrixOneUrl(): string {
  const matrixOneUrl = resolveMatrixOneUrl();

  if (!matrixOneUrl) {
    throw new Error(
      "MATRIXONE_URL is required (DATABASE_URL is accepted for compatibility).",
    );
  }

  return matrixOneUrl;
}

// Backward-compatible aliases for existing imports.
export const hasDatabaseUrl = hasMatrixOneUrl;
export const getDatabaseUrl = getMatrixOneUrl;
