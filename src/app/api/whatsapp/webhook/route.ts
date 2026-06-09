import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/whatsapp/webhook-verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { sendTextMessage } from "@/lib/whatsapp/client";
import type { WebhookPayload } from "@/lib/whatsapp/types";
import { calculateScore } from "@/lib/ai/scoring";
import { generateResponse, type ProviderType, type AIMessage } from "@/lib/ai/router";
import { shouldHandoff } from "@/lib/ai/handoff-detector";
import { searchKnowledge } from "@/lib/ai/rag";
import { notifyTenantUsers } from "@/lib/notifications";

// GET: Webhook verification (challenge)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Incoming messages
export async function POST(request: NextRequest) {
  const body = await request.text();

  // Verify HMAC signature
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET!;

  if (!verifyWebhookSignature(body, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Always return 200 immediately to acknowledge receipt
  // Process async to avoid timeout
  try {
    const payload: WebhookPayload = JSON.parse(body);
    await processWebhook(payload);
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Still return 200 to prevent retries
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

async function processWebhook(payload: WebhookPayload) {
  const supabase = createAdminClient();

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const { metadata, messages, statuses } = change.value;
      const phoneNumberId = metadata.phone_number_id;

      // Find the WhatsApp session by phone_number_id
      const { data: session } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("phone_number_id", phoneNumberId)
        .eq("status", "active")
        .single();

      if (!session) continue;

      // Process incoming messages
      if (messages && messages.length > 0) {
        for (const msg of messages) {
          await processIncomingMessage(supabase, session, msg, change.value.contacts);
        }
      }

      // Process status updates
      if (statuses && statuses.length > 0) {
        for (const status of statuses) {
          await supabase
            .from("messages")
            .update({ status: status.status })
            .eq("whatsapp_message_id", status.id);
        }
      }
    }
  }
}

async function processIncomingMessage(
  supabase: ReturnType<typeof createAdminClient>,
  session: Record<string, unknown>,
  msg: NonNullable<WebhookPayload["entry"][0]["changes"][0]["value"]["messages"]>[number],
  contacts?: WebhookPayload["entry"][0]["changes"][0]["value"]["contacts"]
) {
  const tenantId = session.tenant_id as string;
  const from = msg.from;
  const contactName = contacts?.[0]?.profile?.name || from;

  // Get text content
  let content = "";
  if (msg.type === "text" && msg.text) {
    content = msg.text.body;
  } else {
    content = `[${msg.type}]`;
  }

  // Find or create lead
  let { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("phone_number", from)
    .single();

  if (!lead) {
    // Get first pipeline stage
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true })
      .limit(1)
      .single();

    const { data: newLead } = await supabase
      .from("leads")
      .insert({
        tenant_id: tenantId,
        phone_number: from,
        name: contactName,
        stage_id: firstStage?.id || null,
        last_contact_at: new Date().toISOString(),
      })
      .select()
      .single();

    lead = newLead;
  } else {
    // Update last contact
    await supabase
      .from("leads")
      .update({ last_contact_at: new Date().toISOString(), name: contactName })
      .eq("id", lead.id);
  }

  if (!lead) return;

  // Find or create conversation
  let { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("lead_id", lead.id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conversation) {
    // Find default AI agent
    const { data: agent } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(1)
      .single();

    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        lead_id: lead.id,
        whatsapp_session_id: session.id as string,
        ai_agent_id: agent?.id || null,
        controlled_by: agent ? "ai" : "human",
        status: "active",
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    conversation = newConv;
  } else {
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count as number) + 1,
      })
      .eq("id", conversation.id);
  }

  if (!conversation) return;

  // Save the message
  await supabase.from("messages").insert({
    conversation_id: conversation.id as string,
    tenant_id: tenantId,
    sender_type: "lead",
    content,
    message_type: msg.type === "text" ? "text" : msg.type,
    whatsapp_message_id: msg.id,
  });

  // Cancel pending follow-up tasks for this lead (stop on reply)
  await supabase
    .from("follow_up_tasks")
    .update({ status: "cancelled" })
    .eq("lead_id", lead.id)
    .eq("status", "pending");

  // If conversation is controlled by AI, generate response and check for handoff
  if (conversation.controlled_by === "ai" && conversation.ai_agent_id) {
    triggerAIResponse(
      supabase,
      tenantId,
      conversation.id as string,
      conversation.ai_agent_id as string,
      session,
      lead,
      content
    ).catch((err) => console.error("AI response error:", err));
  }

  // Trigger async lead scoring if AI provider is configured
  triggerScoring(supabase, tenantId, lead.id, conversation.id as string).catch(
    (err) => console.error("Scoring error:", err)
  );
}

/**
 * Generates an AI response, sends it via WhatsApp, and checks for handoff triggers.
 */
async function triggerAIResponse(
  supabase: ReturnType<typeof createAdminClient>,
  tenantId: string,
  conversationId: string,
  agentId: string,
  session: Record<string, unknown>,
  lead: Record<string, unknown>,
  leadMessage: string
) {
  // Get agent config
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("*, ai_providers(provider_type, api_key_encrypted, model)")
    .eq("id", agentId)
    .single();

  if (!agent) return;

  const provider = agent.ai_providers as Record<string, unknown> | null;
  if (!provider) return;

  const apiKey = decrypt(provider.api_key_encrypted as string);

  // Build message history
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("sender_type, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);

  const history: AIMessage[] = (recentMessages || [])
    .reverse()
    .map((m) => ({
      role: (m.sender_type === "lead" ? "user" : "assistant") as "user" | "assistant",
      content: m.content as string,
    }));

  // RAG: search knowledge base for context
  let knowledgeContext = "";
  try {
    const chunks = await searchKnowledge(leadMessage, tenantId, agentId, apiKey);
    if (chunks.length > 0) {
      knowledgeContext = "\n\nContexto de la base de conocimiento:\n" +
        chunks.map((c) => c.content).join("\n---\n");
    }
  } catch {
    // Knowledge search failed, continue without context
  }

  // Product context: if lead mentions products, prices, or catalog
  let productContext = "";
  const productKeywords = ["producto", "precio", "catálogo", "catalogo", "comprar", "stock", "disponible", "cuánto cuesta", "cuanto cuesta", "tienen"];
  const lowerMessage = leadMessage.toLowerCase();
  if (productKeywords.some((kw) => lowerMessage.includes(kw))) {
    try {
      const { data: products } = await supabase
        .from("products")
        .select("name, price, stock, category")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .limit(20);

      if (products && products.length > 0) {
        productContext = "\n\nProductos disponibles:\n" +
          products.map((p) => `- ${p.name}: $${p.price} (stock: ${p.stock})`).join("\n");
      }
    } catch {
      // Product search failed, continue without
    }
  }

  const systemPrompt = (agent.system_prompt as string) + knowledgeContext + productContext;

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  // Generate AI response
  const aiResponse = await generateResponse({
    providerType: provider.provider_type as ProviderType,
    apiKey,
    model: provider.model as string,
    messages,
    temperature: (agent.temperature as number) || 0.7,
    maxTokens: (agent.max_tokens as number) || 1024,
  });

  // Check for handoff
  const handoffResult = shouldHandoff(
    leadMessage,
    aiResponse.content,
    (agent.handoff_keywords as string[]) || []
  );

  if (handoffResult.shouldHandoff) {
    // Update conversation to waiting_handoff
    await supabase
      .from("conversations")
      .update({
        status: "waiting_handoff",
        handoff_requested_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    // Notify available agents
    await notifyTenantUsers(
      tenantId,
      ["agent", "supervisor", "admin"],
      "handoff_request",
      "Handoff solicitado",
      `Un lead necesita atención humana: ${handoffResult.reason}`,
      { conversation_id: conversationId, lead_id: lead.id }
    );

    // Send acknowledgment to lead
    const handoffMessage = "Entendido, te estoy conectando con un asesor. Un momento por favor.";
    const accessToken = decrypt(session.access_token_encrypted as string);
    await sendTextMessage(
      session.phone_number_id as string,
      accessToken,
      lead.phone_number as string,
      handoffMessage
    );

    // Save handoff message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      sender_type: "ai",
      content: handoffMessage,
      message_type: "text",
      status: "sent",
    });

    return;
  }

  // Send AI response via WhatsApp
  const accessToken = decrypt(session.access_token_encrypted as string);
  const waResponse = await sendTextMessage(
    session.phone_number_id as string,
    accessToken,
    lead.phone_number as string,
    aiResponse.content
  );

  // Save AI message in DB
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    sender_type: "ai",
    content: aiResponse.content,
    message_type: "text",
    whatsapp_message_id: waResponse.messages[0]?.id || null,
    status: "sent",
  });
}

/**
 * Triggers lead scoring asynchronously after a lead message is processed.
 * Looks for an active AI provider and scoring config, then calculates the score.
 */
async function triggerScoring(
  supabase: ReturnType<typeof createAdminClient>,
  tenantId: string,
  leadId: string,
  conversationId: string
) {
  // Check if tenant has an AI provider configured
  const { data: provider } = await supabase
    .from("ai_providers")
    .select("id, provider_type, api_key_encrypted, model")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .limit(1)
    .single();

  if (!provider) return; // No AI provider, skip scoring

  // Get scoring config
  const { data: scoringConfig } = await supabase
    .from("scoring_config")
    .select("criteria, keywords_positive, keywords_negative, thresholds")
    .eq("tenant_id", tenantId)
    .single();

  if (!scoringConfig?.criteria) return;

  // Fetch recent messages from the conversation
  const { data: messages } = await supabase
    .from("messages")
    .select("content, sender_type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (!messages || messages.length === 0) return;

  const messageTexts = messages
    .reverse()
    .map(
      (m) =>
        `[${(m.sender_type as string).toUpperCase()}]: ${m.content as string}`
    );

  const apiKey = decrypt(provider.api_key_encrypted as string);

  const result = await calculateScore(
    messageTexts,
    {
      criteria: scoringConfig.criteria as { name: string; weight: number }[],
      keywords_positive: (scoringConfig.keywords_positive as string[]) || [],
      keywords_negative: (scoringConfig.keywords_negative as string[]) || [],
      thresholds: (scoringConfig.thresholds as {
        cold: { min: number; max: number };
        warm: { min: number; max: number };
        hot: { min: number; max: number };
      }) || {
        cold: { min: 0, max: 33 },
        warm: { min: 34, max: 66 },
        hot: { min: 67, max: 100 },
      },
    },
    provider.provider_type as ProviderType,
    apiKey,
    provider.model as string
  );

  // Update lead score
  await supabase
    .from("leads")
    .update({
      score: result.score,
      score_category: result.category,
    })
    .eq("id", leadId);
}
