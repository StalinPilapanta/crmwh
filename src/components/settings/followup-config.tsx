"use client";

import { useEffect, useState } from "react";
import { Clock, Plus } from "lucide-react";

interface Sequence {
  id: string;
  name: string;
  trigger_delay_minutes: number;
  is_active: boolean;
  steps: unknown[];
}

export function FollowUpConfig() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/followup/sequences");
      if (res.ok) {
        const { sequences: data } = await res.json();
        setSequences(data || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Follow-up Automático</h3>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" />
          Nueva secuencia
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Crea secuencias de mensajes automáticos para leads que no responden.
      </p>

      {sequences.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">Sin secuencias configuradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sequences.map((seq) => (
            <div key={seq.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{seq.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(seq.steps as unknown[]).length} pasos · Delay: {seq.trigger_delay_minutes} min
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${seq.is_active ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {seq.is_active ? "Activa" : "Inactiva"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
