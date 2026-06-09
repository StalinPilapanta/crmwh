"use client";

import { useEffect, useState } from "react";
import { Bot, Trash2, Plus, Check } from "lucide-react";

interface Provider {
  id: string;
  provider_type: string;
  model: string;
  is_default: boolean;
  created_at: string;
}

export function AIProviderConfig() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ providerType: "openai", apiKey: "", model: "", isDefault: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProviders();
  }, []);

  async function fetchProviders() {
    const res = await fetch("/api/integrations/ai-provider");
    if (res.ok) {
      const { providers: data } = await res.json();
      setProviders(data || []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.apiKey || !form.model) {
      setError("API Key y modelo son requeridos");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch("/api/integrations/ai-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ providerType: "openai", apiKey: "", model: "", isDefault: true });
      fetchProviders();
    } else {
      const data = await res.json();
      setError(data.error || "Error al configurar");
    }
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Proveedor de IA</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar proveedor
        </button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border p-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <label className="text-sm font-medium">Proveedor</label>
            <select
              value={form.providerType}
              onChange={(e) => setForm({ ...form, providerType: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Modelo</label>
            <input
              placeholder="gpt-4o-mini, claude-3-haiku, etc."
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded"
            />
            Usar como proveedor por defecto
          </label>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {providers.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-4">No hay proveedores configurados. Necesitas al menos uno para que los agentes IA funcionen.</p>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Bot className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium capitalize">{p.provider_type} — {p.model}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.is_default && <span className="inline-flex items-center gap-1 text-primary"><Check className="h-3 w-3" /> Por defecto</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
