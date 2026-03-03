import { promises as fs } from "node:fs";

export async function readFile(path: string): Promise<string> {
  return fs.readFile(path, "utf8");
}

export async function writeFile(path: string, content: string): Promise<void> {
  await fs.writeFile(path, content, "utf8");
}
