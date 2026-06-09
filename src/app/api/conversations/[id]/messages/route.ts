import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { sendTextMessage } from "@/lib/whatsapp/client";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const { data: messages, count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact" })
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Error al obtener mensajes" }, { status: 500 });
  }

  // Mark as read
  await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", id);

  return NextResponse.json({
    messages,
    pagination: { page, limit, total: count || 0 },
  });
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content) {
    return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });
  }

  // Get conversation with lead and session info
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*, leads(phone_number), whatsapp_sessions(phone_number_id, access_token_encrypted)")
    .eq("id", id)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const lead = conversation.leads as { phone_number: string } | null;
  const session = conversation.whatsapp_sessions as { phone_number_id: string; access_token_encrypted: string } | null;

  // Save message in DB
  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: id,
      tenant_id: user.app_metadata.tenant_id,
      sender_type: "human",
      sender_id: user.id,
      content,
      message_type: "text",
    })
    .select()
    .single();

  if (msgError) {
    return NextResponse.json({ error: "Error al guardar mensaje" }, { status: 500 });
  }

  // Send via WhatsApp if session is available
  if (session && lead) {
    try {
      const accessToken = decrypt(session.access_token_encrypted);
      const waResponse = await sendTextMessage(
        session.phone_number_id,
        accessToken,
        lead.phone_number,
        content
      );

      // Update message with WhatsApp ID
      const adminClient = createAdminClient();
      await adminClient
        .from("messages")
        .update({
          whatsapp_message_id: waResponse.messages[0]?.id,
          status: "sent",
        })
        .eq("id", message.id);
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      // Message is saved but not sent via WA
      const adminClient = createAdminClient();
      await adminClient
        .from("messages")
        .update({ status: "failed" })
        .eq("id", message.id);
    }
  }

  // Update conversation last_message_at
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ message }, { status: 201 });
}
