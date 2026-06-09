import { generateOpenAIResponse, type AIMessage, type AIResponse } from "./providers/openai";
import { generateAnthropicResponse } from "./providers/anthropic";
import { generateOpenRouterResponse } from "./providers/openrouter";

export type ProviderType = "openai" | "anthropic" | "openrouter";

interface GenerateOptions {
  providerType: ProviderType;
  apiKey: string;
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

/**
 * Routes AI generation to the appropriate provider with retry + exponential backoff
 */
export async function generateResponse(options: GenerateOptions): Promise<AIResponse> {
  const { providerType, apiKey, model, messages, temperature = 0.7, maxTokens = 1024 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      switch (providerType) {
        case "openai":
          return await generateOpenAIResponse(apiKey, model, messages, temperature, maxTokens);
        case "anthropic":
          return await generateAnthropicResponse(apiKey, model, messages, temperature, maxTokens);
        case "openrouter":
          return await generateOpenRouterResponse(apiKey, model, messages, temperature, maxTokens);
        default:
          throw new Error(`Unsupported provider: ${providerType}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on 4xx errors (except 429 rate limit)
      if (lastError.message.includes("401") || lastError.message.includes("403")) {
        throw lastError;
      }

      // Exponential backoff
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("AI generation failed after retries");
}

export type { AIMessage, AIResponse };
