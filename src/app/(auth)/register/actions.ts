"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterState = {
  error?: string;
} | undefined;

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,128}$/;

export async function register(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const fullName = formData.get("fullName") as string;
  const company = formData.get("company") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Validation
  if (!fullName || !company || !email || !password) {
    return { error: "Todos los campos son requeridos" };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      error:
        "La contraseña debe tener 8-128 caracteres, incluir mayúscula, minúscula, número y carácter especial",
    };
  }

  const supabase = createAdminClient();

  // 1. Create tenant
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ name: company })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    return { error: "Error al crear la empresa. Intenta de nuevo." };
  }

  // 2. Create auth user with tenant metadata
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      tenant_id: tenant.id,
      role: "admin",
    },
  });

  if (authError || !authData.user) {
    // Rollback: delete tenant
    await supabase.from("tenants").delete().eq("id", tenant.id);
    if (authError?.message.includes("already registered")) {
      return { error: "Este email ya está registrado" };
    }
    return { error: "Error al crear el usuario. Intenta de nuevo." };
  }

  // 3. Create user row
  const { error: userError } = await supabase.from("users").insert({
    id: authData.user.id,
    tenant_id: tenant.id,
    email,
    full_name: fullName,
    role: "admin",
  });

  if (userError) {
    // Rollback
    await supabase.auth.admin.deleteUser(authData.user.id);
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return { error: "Error al configurar el usuario. Intenta de nuevo." };
  }

  // 4. Create default pipeline stages
  const { error: pipelineError } = await supabase.rpc("create_default_pipeline", {
    tenant_uuid: tenant.id,
  });

  if (pipelineError) {
    console.error("Error creating default pipeline:", pipelineError);
  }

  // 5. Create default scoring config
  const { error: scoringError } = await supabase.rpc("create_default_scoring_config", {
    tenant_uuid: tenant.id,
  });

  if (scoringError) {
    console.error("Error creating default scoring config:", scoringError);
  }

  redirect("/login");
}
