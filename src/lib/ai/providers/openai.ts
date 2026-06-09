export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
}

export async function generateOpenAIResponse(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024
): Promise<AIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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
    throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || "",
    tokensUsed: data.usage?.total_tokens || 0,
  };
}
