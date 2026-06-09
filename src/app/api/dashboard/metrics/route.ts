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

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Active conversations
  const { count: activeConversations } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // New leads this week
  const { count: newLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekStart);

  // Average score
  const { data: scoreData } = await supabase
    .from("leads")
    .select("score")
    .gt("score", 0);

  const avgScore = scoreData && scoreData.length > 0
    ? Math.round(scoreData.reduce((sum, l) => sum + l.score, 0) / scoreData.length)
    : 0;

  // Messages today
  const { count: messagesToday } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart);

  return NextResponse.json({
    activeConversations: activeConversations || 0,
    newLeads: newLeads || 0,
    avgScore,
    messagesToday: messagesToday || 0,
  });
}
