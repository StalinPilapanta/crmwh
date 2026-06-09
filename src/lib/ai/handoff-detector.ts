/**
 * Detects whether a conversation should be handed off to a human agent.
 * Analyzes both the AI response content and predefined keywords.
 */

const DEFAULT_HANDOFF_KEYWORDS = [
  "hablar con un humano",
  "hablar con una persona",
  "agente humano",
  "quiero hablar con alguien",
  "operador",
  "asesor",
  "no entiendo",
  "queja",
  "reclamo",
  "gerente",
  "supervisor",
];

interface HandoffResult {
  shouldHandoff: boolean;
  reason: string | null;
}

/**
 * Checks if the lead's message contains handoff trigger keywords
 */
export function detectHandoffFromMessage(
  message: string,
  customKeywords: string[] = []
): HandoffResult {
  const allKeywords = [...DEFAULT_HANDOFF_KEYWORDS, ...customKeywords];
  const lowerMessage = message.toLowerCase();

  for (const keyword of allKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return {
        shouldHandoff: true,
        reason: `Keyword detectado: "${keyword}"`,
      };
    }
  }

  return { shouldHandoff: false, reason: null };
}

/**
 * Checks if the AI response indicates it cannot handle the conversation
 */
export function detectHandoffFromAIResponse(aiResponse: string): HandoffResult {
  const handoffIndicators = [
    "no puedo ayudarte con eso",
    "te transfiero con un agente",
    "voy a transferirte",
    "necesitas hablar con",
    "un agente humano te podrá",
    "te conecto con",
    "[HANDOFF]",
    "[TRANSFERIR]",
  ];

  const lowerResponse = aiResponse.toLowerCase();

  for (const indicator of handoffIndicators) {
    if (lowerResponse.includes(indicator.toLowerCase())) {
      return {
        shouldHandoff: true,
        reason: `AI indicó handoff: "${indicator}"`,
      };
    }
  }

  return { shouldHandoff: false, reason: null };
}

/**
 * Combined handoff detection from both message and AI response
 */
export function shouldHandoff(
  leadMessage: string,
  aiResponse: string,
  customKeywords: string[] = []
): HandoffResult {
  // Check lead message first
  const messageResult = detectHandoffFromMessage(leadMessage, customKeywords);
  if (messageResult.shouldHandoff) return messageResult;

  // Check AI response
  const aiResult = detectHandoffFromAIResponse(aiResponse);
  if (aiResult.shouldHandoff) return aiResult;

  return { shouldHandoff: false, reason: null };
}
