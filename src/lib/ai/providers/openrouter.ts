import type { AIMessage, AIResponse } from "./openai";

export async function generateOpenRouterResponse(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024
): Promise<AIResponse> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "CRM WhatsApp",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || "",
    tokensUsed: data.usage?.total_tokens || 0,
  };
}
