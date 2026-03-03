import fs from "node:fs";
import path from "node:path";

let cachedOrgContext: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load organization context from AGENTS.md and skynet.yaml for AI consumption.
 * Results are cached for 5 minutes since file contents rarely change.
 */
export function loadOrgContext(): string {
  const now = Date.now();
  if (cachedOrgContext !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedOrgContext;
  }

  const parts: string[] = [];

  // Try to read AGENTS.md (or CLAUDE.md as fallback) for project standards
  const rootDir = findProjectRoot();
  if (rootDir) {
    const agentsMd = tryReadFile(path.join(rootDir, "AGENTS.md"));
    const claudeMd = agentsMd ?? tryReadFile(path.join(rootDir, "CLAUDE.md"));

    if (claudeMd) {
      // Extract key sections: Project Overview + Key Architecture Decisions
      const extracted = extractRelevantSections(claudeMd);
      if (extracted) {
        parts.push(extracted);
      }
    }

    // Try to read skynet.yaml org/standards section
    const skynetYaml = tryReadFile(path.join(rootDir, "skynet.yaml"));
    if (skynetYaml) {
      parts.push(`### Repository Configuration (skynet.yaml)\n${skynetYaml}`);
    }
  }

  cachedOrgContext = parts.length > 0 ? parts.join("\n\n") : "";
  cacheTimestamp = now;
  return cachedOrgContext;
}

function findProjectRoot(): string | null {
  // Walk up from cwd looking for skynet.yaml or CLAUDE.md
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (
      fs.existsSync(path.join(dir, "skynet.yaml")) ||
      fs.existsSync(path.join(dir, "CLAUDE.md")) ||
      fs.existsSync(path.join(dir, "AGENTS.md"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function tryReadFile(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

/**
 * Extract relevant sections from AGENTS.md / CLAUDE.md for AI context.
 * Keeps it concise — project overview, architecture, and conventions.
 */
function extractRelevantSections(content: string): string | null {
  const sections: string[] = [];

  // Extract "Project Overview" section
  const overviewMatch = content.match(
    /## Project Overview\s*\n([\s\S]*?)(?=\n## |\n---\s*$|$)/,
  );
  if (overviewMatch) {
    sections.push(`### Project Overview\n${overviewMatch[1].trim()}`);
  }

  // Extract "Key Architecture Decisions" section
  const archMatch = content.match(
    /### Key Architecture Decisions\s*\n([\s\S]*?)(?=\n### |\n## |\n---\s*$|$)/,
  );
  if (archMatch) {
    sections.push(`### Key Architecture Decisions\n${archMatch[1].trim()}`);
  }

  // Extract "Technology Stack" section
  const techMatch = content.match(
    /### Technology Stack\s*\n([\s\S]*?)(?=\n### |\n## |\n---\s*$|$)/,
  );
  if (techMatch) {
    sections.push(`### Technology Stack\n${techMatch[1].trim()}`);
  }

  // Extract "Git Flow Workflow" section
  const gitMatch = content.match(
    /### Git Flow Workflow\s*\n([\s\S]*?)(?=\n### |\n## |\n---\s*$|$)/,
  );
  if (gitMatch) {
    sections.push(`### Git Flow Workflow\n${gitMatch[1].trim()}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}
