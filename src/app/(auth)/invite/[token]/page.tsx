"use client";

import { useActionState } from "react";
import { useParams } from "next/navigation";
import { acceptInvite } from "./actions";

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const [state, formAction, pending] = useActionState(
    acceptInvite.bind(null, token),
    undefined
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Aceptar invitación</h2>
        <p className="text-sm text-muted-foreground">
          Completa tu registro para unirte al equipo
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium">
            Nombre completo
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Procesando..." : "Aceptar invitación"}
        </button>
      </form>
    </div>
  );
}
