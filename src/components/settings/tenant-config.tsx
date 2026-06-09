"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function TenantConfig() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Bogota");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/tenant/settings");
      if (res.ok) {
        const { tenant } = await res.json();
        setName(tenant.name || "");
        setTimezone(tenant.timezone || "America/Bogota");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/tenant/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setMessage("Guardado correctamente");
    } else {
      setMessage("Error al guardar");
    }
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4 max-w-md">
      <h3 className="text-base font-semibold">Datos de la empresa</h3>

      <div className="space-y-2">
        <label className="text-sm font-medium">Nombre de empresa</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Zona horaria</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="America/Bogota">America/Bogota (COT)</option>
          <option value="America/Mexico_City">America/Mexico_City (CST)</option>
          <option value="America/Lima">America/Lima (PET)</option>
          <option value="America/Santiago">America/Santiago (CLT)</option>
          <option value="America/Buenos_Aires">America/Buenos_Aires (ART)</option>
        </select>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("Error") ? "text-destructive" : "text-success"}`}>
          {message}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
