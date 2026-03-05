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
 * Walk up from startDir looking for skynet.yaml.
 * Returns the first match or undefined.
 */
function findConfigFile(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(dir, "skynet.yaml");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined; // reached filesystem root
    dir = parent;
  }
}

/**
 * Load skynet.yaml from the given root directory (defaults to process.cwd()).
 * If the file is not found in the given directory, walks up parent directories.
 * Returns an empty config if the file doesn't exist.
 */
export function loadSkynetConfig(rootDir?: string): SkynetConfig {
  const dir = rootDir ?? process.cwd();
  const filePath = rootDir
    ? path.join(dir, "skynet.yaml")
    : findConfigFile(dir);

  if (!filePath || !fs.existsSync(filePath)) {
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
