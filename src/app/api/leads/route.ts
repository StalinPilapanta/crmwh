import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const stageId = searchParams.get("stage_id");
  const scoreCategory = searchParams.get("score_category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("leads")
    .select("*, pipeline_stages(name, color)", { count: "exact" });

  if (stageId) {
    query = query.eq("stage_id", stageId);
  }
  if (scoreCategory) {
    query = query.eq("score_category", scoreCategory);
  }

  const { data: leads, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Error al obtener leads" }, { status: 500 });
  }

  return NextResponse.json({
    leads,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}
