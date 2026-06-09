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

  const { data: config, error } = await supabase
    .from("scoring_config")
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Config no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
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
  const { criteria, keywords_positive, keywords_negative, thresholds } = body;

  // Validate weights (1-10)
  if (criteria) {
    for (const c of criteria) {
      if (c.weight < 1 || c.weight > 10) {
        return NextResponse.json(
          { error: "Los pesos deben estar entre 1 y 10" },
          { status: 400 }
        );
      }
    }
  }

  // Validate keywords max 50
  if (keywords_positive && keywords_positive.length > 50) {
    return NextResponse.json(
      { error: "Máximo 50 keywords positivas" },
      { status: 400 }
    );
  }

  // Validate thresholds don't overlap
  if (thresholds) {
    if (thresholds.cold.max >= thresholds.warm.min || thresholds.warm.max >= thresholds.hot.min) {
      return NextResponse.json(
        { error: "Los umbrales no deben solaparse" },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = {};
  if (criteria) updates.criteria = criteria;
  if (keywords_positive) updates.keywords_positive = keywords_positive;
  if (keywords_negative) updates.keywords_negative = keywords_negative;
  if (thresholds) updates.thresholds = thresholds;

  const { data, error } = await supabase
    .from("scoring_config")
    .update(updates)
    .eq("tenant_id", user.app_metadata.tenant_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al actualizar config" }, { status: 500 });
  }

  return NextResponse.json({ config: data });
}
