import OpenAI from "openai";

export interface ModelProfiles {
  fast: string;
  standard: string;
  long: string;
}

export interface ModelClientConfig {
  apiKey: string;
  baseURL: string;
  profiles: ModelProfiles;
  source: "anthropic_compat";
}

const GLM_DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
const GLM_DEFAULT_MODEL = "glm-4.7";
const GLM_FAST_MODEL = "glm-4.5-air";

let instance: OpenAI | null = null;
let configCache: ModelClientConfig | null = null;

function trim(value: string | undefined): string | null {
  if (!value) return null;
  const next = value.trim();
  return next.length > 0 ? next : null;
}

function resolveAnthropicCompatConfig(env: NodeJS.ProcessEnv): ModelClientConfig | null {
  const token = trim(env.ANTHROPIC_AUTH_TOKEN) ?? trim(env.ANTHROPIC_API_KEY);
  if (!token) return null;

  return {
    apiKey: token,
    baseURL: trim(env.ANTHROPIC_BASE_URL) ?? GLM_DEFAULT_BASE_URL,
    profiles: {
      fast: trim(env.ANTHROPIC_DEFAULT_HAIKU_MODEL) ?? GLM_FAST_MODEL,
      standard: trim(env.ANTHROPIC_DEFAULT_SONNET_MODEL) ?? GLM_DEFAULT_MODEL,
      long: trim(env.ANTHROPIC_DEFAULT_OPUS_MODEL) ?? GLM_DEFAULT_MODEL,
    },
    source: "anthropic_compat",
  };
}

export function resolveModelClientConfig(env: NodeJS.ProcessEnv = process.env): ModelClientConfig | null {
  return resolveAnthropicCompatConfig(env);
}

export function hasModelConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveModelClientConfig(env) !== null;
}

export function getModelProfiles(env: NodeJS.ProcessEnv = process.env): ModelProfiles {
  const resolved = resolveModelClientConfig(env);
  if (resolved) return resolved.profiles;

  return {
    fast: GLM_FAST_MODEL,
    standard: GLM_DEFAULT_MODEL,
    long: GLM_DEFAULT_MODEL,
  };
}

export function getModelClient(): OpenAI {
  if (instance) return instance;

  const resolved = resolveModelClientConfig(process.env);
  if (!resolved) {
    throw new Error(
      "AI model configuration is required. Set ANTHROPIC_AUTH_TOKEN",
    );
  }

  configCache = resolved;
  instance = new OpenAI({
    apiKey: resolved.apiKey,
    baseURL: resolved.baseURL,
  });

  return instance;
}

export function getResolvedModelConfig(): ModelClientConfig | null {
  return configCache ?? resolveModelClientConfig(process.env);
}

export function resetModelClientForTests(): void {
  instance = null;
  configCache = null;
}
