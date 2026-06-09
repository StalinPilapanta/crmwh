import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// DELETE: Remove a knowledge document
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/agents/[id]/knowledge/[docId]">
) {
  const supabase = await createClient();
  const { id, docId } = await ctx.params;

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

  const adminClient = createAdminClient();

  // Get document to find file_path
  const { data: document, error: fetchError } = await adminClient
    .from("knowledge_docs")
    .select("id, agent_id")
    .eq("id", docId)
    .eq("agent_id", id)
    .single();

  if (fetchError || !document) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  // Delete chunks first
  await adminClient
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", docId);

  // Delete from database
  const { error: deleteError } = await adminClient
    .from("knowledge_docs")
    .delete()
    .eq("id", docId);

  if (deleteError) {
    return NextResponse.json({ error: "Error al eliminar documento" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
