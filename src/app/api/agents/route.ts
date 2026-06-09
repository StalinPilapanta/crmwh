import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: agents, error } = await supabase
    .from("ai_agents")
    .select("*, ai_providers(provider_type, model)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Error al obtener agentes" }, { status: 500 });
  }

  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = user.app_metadata?.role;
  if (role !== "admin" && role !== "supervisor") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const { name, systemPrompt, providerId, personality, temperature, maxTokens, handoffKeywords } = body;

  if (!name || !systemPrompt) {
    return NextResponse.json(
      { error: "Nombre y system prompt son requeridos" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("ai_agents")
    .insert({
      tenant_id: user.app_metadata.tenant_id,
      name,
      system_prompt: systemPrompt,
      provider_id: providerId || null,
      personality: personality || "professional",
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 1024,
      handoff_keywords: handoffKeywords || [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al crear agente" }, { status: 500 });
  }

  return NextResponse.json({ agent: data }, { status: 201 });
}
