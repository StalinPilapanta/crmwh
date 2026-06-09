"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wifi, WifiOff, Trash2, Plus } from "lucide-react";

interface Session {
  id: string;
  display_phone: string;
  phone_number_id: string;
  status: string;
  created_at: string;
}

export function WhatsAppConfig() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ phoneNumberId: "", displayPhone: "", businessAccountId: "", accessToken: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    const supabase = createClient();
    const { data } = await supabase
      .from("whatsapp_sessions")
      .select("id, display_phone, phone_number_id, status, created_at")
      .order("created_at", { ascending: false });
    if (data) setSessions(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.phoneNumberId || !form.displayPhone || !form.businessAccountId || !form.accessToken) {
      setError("Todos los campos son requeridos");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch("/api/whatsapp/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ phoneNumberId: "", displayPhone: "", businessAccountId: "", accessToken: "" });
      fetchSessions();
    } else {
      const data = await res.json();
      setError(data.error || "Error al conectar");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/whatsapp/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">WhatsApp Business</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Conectar número
        </button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Ingresa los datos de tu WhatsApp Business API (Meta Cloud)</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <input
            placeholder="Phone Number ID"
            value={form.phoneNumberId}
            onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Número a mostrar (ej: +57 300 123 4567)"
            value={form.displayPhone}
            onChange={(e) => setForm({ ...form, displayPhone: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Business Account ID"
            value={form.businessAccountId}
            onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Access Token (permanente)"
            type="password"
            value={form.accessToken}
            onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Conectando..." : "Conectar"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-4">No hay números conectados. Haz clic en "Conectar número" para configurar.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {session.status === "active" ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium">{session.display_phone}</p>
                  <p className="text-xs text-muted-foreground">ID: {session.phone_number_id}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(session.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
