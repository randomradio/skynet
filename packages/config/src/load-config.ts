import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

export interface RepositoryConfig {
  owner: string;
  name: string;
  sync?: boolean; // default: true
}

export interface SkynetConfig {
  repositories: RepositoryConfig[];
}

const EMPTY_CONFIG: SkynetConfig = { repositories: [] };

/**
 * Load skynet.yaml from the given root directory (defaults to process.cwd()).
 * Returns an empty config if the file doesn't exist.
 */
export function loadSkynetConfig(rootDir?: string): SkynetConfig {
  const dir = rootDir ?? process.cwd();
  const filePath = path.join(dir, "skynet.yaml");

  if (!fs.existsSync(filePath)) {
    return EMPTY_CONFIG;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = parse(raw) as Partial<SkynetConfig> | null;

  if (!parsed || !Array.isArray(parsed.repositories)) {
    return EMPTY_CONFIG;
  }

  return {
    repositories: parsed.repositories.map((r) => ({
      owner: String(r.owner),
      name: String(r.name),
      sync: r.sync !== false, // default true
    })),
  };
}
