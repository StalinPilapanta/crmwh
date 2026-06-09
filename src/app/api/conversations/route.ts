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
  const status = searchParams.get("status");
  const controlledBy = searchParams.get("controlled_by");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("conversations")
    .select("*, leads(name, phone_number, score, score_category)", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }
  if (controlledBy) {
    query = query.eq("controlled_by", controlledBy);
  }

  const { data: conversations, count, error } = await query
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Error al obtener conversaciones" }, { status: 500 });
  }

  return NextResponse.json({
    conversations,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}
