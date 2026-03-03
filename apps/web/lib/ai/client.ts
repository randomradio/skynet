import OpenAI from "openai";

export const MODELS = {
  fast: "ep-deepseek-v3-2-104138",
  standard: "ep-deepseek-v3-2-104138",
  long: "ep-deepseek-v3-2-104138",
} as const;

export function hasAIConfig(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

let instance: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (instance) return instance;

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY is required");
  }

  instance = new OpenAI({
    apiKey,
    baseURL: "https://api.magikcloud.cn/v1",
  });
  return instance;
}
