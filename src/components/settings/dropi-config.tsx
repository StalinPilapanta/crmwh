"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShoppingBag, Check } from "lucide-react";

export function DropiConfig() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ apiKey: "", storeId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkStatus() {
      const supabase = createClient();
      const { data } = await supabase
        .from("integrations")
        .select("id, status")
        .eq("type", "dropi")
        .single();
      if (data?.status === "connected") setConnected(true);
      setLoading(false);
    }
    checkStatus();
  }, []);

  async function handleConnect() {
    if (!form.apiKey || !form.storeId) {
      setError("API Key y Store ID son requeridos");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/integrations/dropi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setConnected(true);
      setShowForm(false);
      setMessage("Dropi conectado correctamente");
    } else {
      const data = await res.json();
      setError(data.error || "Error al conectar");
    }
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Dropi (Dropshipping)</h3>
      <p className="text-sm text-muted-foreground">
        Conecta tu tienda Dropi para sincronizar productos y crear pedidos desde las conversaciones.
      </p>

      {connected && !showForm ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
            <Check className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">Conectado</p>
              <p className="text-xs text-green-600">Productos se sincronizan cada 30 minutos</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-primary hover:underline"
          >
            Reconfigurar credenciales
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-w-md">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-success">{message}</p>}

          <div className="space-y-2">
            <label className="text-sm font-medium">API Key de Dropi</label>
            <input
              type="password"
              placeholder="Tu API key"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Store ID</label>
            <input
              placeholder="ID de tu tienda en Dropi"
              value={form.storeId}
              onChange={(e) => setForm({ ...form, storeId: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Validando..." : "Conectar Dropi"}
            </button>
            {connected && (
              <button onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
