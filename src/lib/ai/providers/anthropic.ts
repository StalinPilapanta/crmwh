import type { AIMessage, AIResponse } from "./openai";

export async function generateAnthropicResponse(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024
): Promise<AIResponse> {
  // Separate system message from conversation
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemMessage?.content || "",
      messages: conversationMessages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((block: { type: string }) => block.type === "text");

  return {
    content: textBlock?.text || "",
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}
