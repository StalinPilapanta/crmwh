"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
} | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email y contraseña son requeridos" };
  }

  // Password validation
  if (password.length < 8 || password.length > 128) {
    return { error: "La contraseña debe tener entre 8 y 128 caracteres" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Credenciales inválidas" };
    }
    if (error.message.includes("too many requests")) {
      return { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." };
    }
    return { error: "Error al iniciar sesión. Intenta de nuevo." };
  }

  redirect("/");
}
