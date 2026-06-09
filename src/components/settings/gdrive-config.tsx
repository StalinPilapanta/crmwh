"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HardDrive, ExternalLink, Check } from "lucide-react";

export function GoogleDriveConfig() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      const supabase = createClient();
      const { data } = await supabase
        .from("integrations")
        .select("id, status")
        .eq("type", "google_drive")
        .single();
      if (data?.status === "connected") setConnected(true);
      setLoading(false);
    }
    checkStatus();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    const res = await fetch("/api/integrations/gdrive");
    if (res.ok) {
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    }
    setConnecting(false);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Google Drive</h3>
      <p className="text-sm text-muted-foreground">
        Conecta Google Drive para sincronizar documentos y hojas de cálculo a la base de conocimiento de tus agentes IA.
      </p>

      {connected ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <Check className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">Conectado</p>
            <p className="text-xs text-green-600">Google Drive se sincroniza cada 60 minutos automáticamente</p>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <HardDrive className="h-4 w-4" />
          {connecting ? "Conectando..." : "Conectar Google Drive"}
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
