import { generateResponse, type ProviderType } from "./router";

interface ScoringConfig {
  criteria: { name: string; weight: number }[];
  keywords_positive: string[];
  keywords_negative: string[];
  thresholds: {
    cold: { min: number; max: number };
    warm: { min: number; max: number };
    hot: { min: number; max: number };
  };
}

interface ScoringResult {
  score: number;
  category: "cold" | "warm" | "hot";
  signals: string[];
}

/**
 * Calculates a lead score (0-100) based on conversation messages,
 * using AI to extract signals and keywords for weighted scoring.
 */
export async function calculateScore(
  messages: string[],
  config: ScoringConfig,
  providerType: ProviderType,
  apiKey: string,
  model: string
): Promise<ScoringResult> {
  const recentMessages = messages.slice(-10).join("\n");

  const systemPrompt = `Eres un sistema de scoring de leads. Analiza la conversación y evalúa los siguientes criterios en una escala de 0-10 cada uno:
${config.criteria.map((c) => `- ${c.name} (peso: ${c.weight})`).join("\n")}

Keywords positivas: ${config.keywords_positive.join(", ")}
Keywords negativas: ${config.keywords_negative.join(", ")}

Responde SOLO con un JSON válido con este formato:
{"scores":{"criterio1":5,"criterio2":7},"signals":["señal detectada 1","señal detectada 2"],"keywords_found":["keyword1"]}`;

  try {
    const response = await generateResponse({
      providerType,
      apiKey,
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversación del lead:\n${recentMessages}` },
      ],
      temperature: 0.3,
      maxTokens: 500,
    });

    // Parse AI response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackScore(recentMessages, config);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const scores = parsed.scores || {};
    const signals = parsed.signals || [];

    // Calculate weighted score
    let totalWeight = 0;
    let weightedSum = 0;

    for (const criterion of config.criteria) {
      const criterionScore = scores[criterion.name] || 0;
      weightedSum += criterionScore * criterion.weight;
      totalWeight += criterion.weight * 10; // max score per criterion is 10
    }

    // Normalize to 0-100
    const score = Math.round((weightedSum / totalWeight) * 100);
    const clampedScore = Math.max(0, Math.min(100, score));
    const category = getCategory(clampedScore, config.thresholds);

    return { score: clampedScore, category, signals };
  } catch (error) {
    console.error("AI scoring error, using fallback:", error);
    return fallbackScore(recentMessages, config);
  }
}

/**
 * Simple keyword-based fallback scoring when AI is unavailable
 */
function fallbackScore(text: string, config: ScoringConfig): ScoringResult {
  const lowerText = text.toLowerCase();
  let score = 25; // Base score
  const signals: string[] = [];

  for (const keyword of config.keywords_positive) {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 10;
      signals.push(`Keyword positiva: "${keyword}"`);
    }
  }

  for (const keyword of config.keywords_negative) {
    if (lowerText.includes(keyword.toLowerCase())) {
      score -= 15;
      signals.push(`Keyword negativa: "${keyword}"`);
    }
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  const category = getCategory(clampedScore, config.thresholds);

  return { score: clampedScore, category, signals };
}

function getCategory(
  score: number,
  thresholds: ScoringConfig["thresholds"]
): "cold" | "warm" | "hot" {
  if (score >= thresholds.hot.min) return "hot";
  if (score >= thresholds.warm.min) return "warm";
  return "cold";
}
