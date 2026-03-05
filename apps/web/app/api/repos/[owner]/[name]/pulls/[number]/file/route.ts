import { NextRequest, NextResponse } from "next/server";
import {
  getSandbox,
  isSandboxAvailable,
  readFiles,
  getFileDiff,
} from "@/lib/sandbox";

const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  rb: "ruby",
  md: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  css: "css",
  scss: "scss",
  html: "html",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  toml: "toml",
  xml: "xml",
  txt: "text",
};

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANG_MAP[ext] ?? "text";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; number: string }> },
) {
  const { owner, name, number: prNum } = await params;
  const path = req.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path query param required" }, { status: 400 });
  }

  const worktreePath = req.nextUrl.searchParams.get("worktreePath");
  if (!worktreePath) {
    return NextResponse.json({ error: "worktreePath query param required" }, { status: 400 });
  }

  const sandboxAvailable = await isSandboxAvailable();
  if (!sandboxAvailable) {
    return NextResponse.json({ error: "Sandbox not available" }, { status: 503 });
  }

  try {
    const sandbox = getSandbox();
    const fullPath = `${worktreePath}/${path}`;
    const files = await readFiles(sandbox, [fullPath]);
    const fileContent = files[0]?.content ?? "";
    const language = detectLanguage(path);

    // Check if this is a changed file and get diff
    let diff: string | undefined;
    try {
      const fileDiff = await getFileDiff(sandbox, worktreePath, "main", path);
      if (fileDiff.trim()) diff = fileDiff;
    } catch {
      // no diff available
    }

    return NextResponse.json({
      file: { path, content: fileContent, language },
      isChanged: !!diff,
      diff,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "File read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
