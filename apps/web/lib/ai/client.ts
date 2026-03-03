import OpenAI from "openai";

export const MODELS = {
  fast: "moonshot-v1-8k",
  standard: "moonshot-v1-32k",
  long: "moonshot-v1-128k",
} as const;

export function hasAIConfig(): boolean {
  return Boolean(process.env.MOONSHOT_API_KEY);
}

let instance: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (instance) return instance;

  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error("MOONSHOT_API_KEY is required");
  }

  instance = new OpenAI({
    apiKey,
    baseURL: "https://api.moonshot.cn/v1",
  });
  return instance;
}
