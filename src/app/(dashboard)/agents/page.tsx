"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bot, Plus, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  personality: string;
  is_active: boolean;
  created_at: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", systemPrompt: "", personality: "professional" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_agents")
      .select("id, name, system_prompt, personality, is_active, created_at")
      .order("created_at", { ascending: false });
    if (data) setAgents(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name || !form.systemPrompt) {
      setError("Nombre y system prompt son requeridos");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", systemPrompt: "", personality: "professional" });
      fetchAgents();
    } else {
      const data = await res.json();
      setError(data.error || "Error al crear agente");
    }
    setSaving(false);
  }

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
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo agente
        </button>
      </div>

      {/* Create Agent Form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Crear nuevo agente</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre del agente</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Asistente de ventas"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">System Prompt</label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              placeholder="Eres un asistente de ventas amable y profesional..."
              rows={4}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Personalidad</label>
            <select
              value={form.personality}
              onChange={(e) => setForm({ ...form, personality: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="professional">Profesional</option>
              <option value="friendly">Amigable</option>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Creando..." : "Crear agente"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Agents List */}
      {agents.length === 0 && !showForm ? (
        <EmptyState
          icon={Bot}
          title="Sin agentes"
          description="Crea tu primer agente IA para automatizar respuestas en WhatsApp. Recuerda configurar primero un Proveedor IA en Configuración."
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
                      ? "bg-green-50 text-green-700"
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
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {agent.system_prompt}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
