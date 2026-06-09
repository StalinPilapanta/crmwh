"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteState = {
  error?: string;
} | undefined;

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,128}$/;

export async function acceptInvite(
  token: string,
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const fullName = formData.get("fullName") as string;
  const password = formData.get("password") as string;

  if (!fullName || !password) {
    return { error: "Todos los campos son requeridos" };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      error:
        "La contraseña debe tener 8-128 caracteres, incluir mayúscula, minúscula, número y carácter especial",
    };
  }

  const supabase = createAdminClient();

  // Verify invitation token
  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (inviteError || !invitation) {
    return { error: "Invitación inválida o ya utilizada" };
  }

  if (invitation.accepted_at) {
    return { error: "Esta invitación ya fue utilizada" };
  }

  // Check expiration
  if (new Date(invitation.expires_at) < new Date()) {
    return { error: "La invitación ha expirado" };
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    app_metadata: {
      tenant_id: invitation.tenant_id,
      role: invitation.role,
    },
  });

  if (authError || !authData.user) {
    if (authError?.message.includes("already registered")) {
      return { error: "Este email ya está registrado" };
    }
    return { error: "Error al crear el usuario" };
  }

  // Create user row
  await supabase.from("users").insert({
    id: authData.user.id,
    tenant_id: invitation.tenant_id,
    email: invitation.email,
    full_name: fullName,
    role: invitation.role,
  });

  // Mark invitation as accepted
  await supabase
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  redirect("/login");
}
