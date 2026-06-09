"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bot, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

interface Agent {
  id: string;
  name: string;
  personality: string;
  is_active: boolean;
  created_at: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      const supabase = createClient();
      const { data } = await supabase
        .from("ai_agents")
        .select("id, name, personality, is_active, created_at")
        .order("created_at", { ascending: false });

      if (data) setAgents(data);
      setLoading(false);
    }
    fetchAgents();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Agentes IA</h1>
        <div className="animate-pulse grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agentes IA</h1>
          <p className="text-sm text-muted-foreground">
            Configura agentes de IA para atender tus conversaciones
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Nuevo agente
        </button>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Sin agentes"
          description="Crea tu primer agente IA para automatizar respuestas en WhatsApp"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    agent.is_active
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {agent.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold">{agent.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                {agent.personality}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
