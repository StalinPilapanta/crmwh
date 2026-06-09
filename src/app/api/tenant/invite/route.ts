import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

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
  const { email, inviteRole } = body;

  if (!email || !inviteRole) {
    return NextResponse.json(
      { error: "Email y rol son requeridos" },
      { status: 400 }
    );
  }

  if (!["admin", "supervisor", "agent"].includes(inviteRole)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const tenantId = user.app_metadata?.tenant_id;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      tenant_id: tenantId,
      email,
      role: inviteRole,
      token,
      invited_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Error al crear invitación" },
      { status: 500 }
    );
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

  return NextResponse.json({ invitation: data, inviteUrl });
}
