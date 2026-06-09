"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Member {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
}

export function TeamConfig() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("id, email, full_name, role, status")
        .order("created_at", { ascending: true });
      if (data) setMembers(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Equipo</h3>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Rol</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">{m.full_name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{m.email}</td>
                <td className="px-4 py-2.5 capitalize">{m.role}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 text-xs ${m.status === "available" ? "text-green-600" : m.status === "busy" ? "text-yellow-600" : "text-muted-foreground"}`}>
                    <span className={`h-2 w-2 rounded-full ${m.status === "available" ? "bg-green-500" : m.status === "busy" ? "bg-yellow-500" : "bg-gray-300"}`} />
                    {m.status === "available" ? "Disponible" : m.status === "busy" ? "Ocupado" : "Offline"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
