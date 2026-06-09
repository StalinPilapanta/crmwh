import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: List knowledge documents for an agent
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/agents/[id]/knowledge">
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: documents, error } = await supabase
    .from("knowledge_docs")
    .select("id, agent_id, name, file_size, status, created_at")
    .eq("agent_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Error al obtener documentos" }, { status: 500 });
  }

  return NextResponse.json({ documents });
}

// POST: Upload a PDF knowledge document
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/agents/[id]/knowledge">
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

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

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
  }

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  // Validate file type
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Solo se permiten archivos PDF" },
      { status: 400 }
    );
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: "El archivo excede el tamaño máximo de 10MB" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Upload file to storage
  const fileBuffer = await file.arrayBuffer();
  const filePath = `${tenantId}/${id}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await adminClient.storage
    .from("knowledge-base")
    .upload(filePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json(
      { error: "Error al subir archivo" },
      { status: 500 }
    );
  }

  // Create document record
  const { data: document, error: dbError } = await adminClient
    .from("knowledge_docs")
    .insert({
      tenant_id: tenantId,
      agent_id: id,
      name: file.name,
      source_type: "pdf",
      file_size: file.size,
      status: "processing",
    })
    .select()
    .single();

  if (dbError) {
    // Cleanup uploaded file on DB error
    await adminClient.storage.from("knowledge-base").remove([filePath]);
    return NextResponse.json(
      { error: "Error al registrar documento" },
      { status: 500 }
    );
  }

  return NextResponse.json({ document }, { status: 201 });
}
