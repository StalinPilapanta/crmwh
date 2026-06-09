"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Flame, Snowflake, Thermometer } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  score: number;
  score_category: string;
  stage_id: string | null;
  created_at: string;
  pipeline_stages: { name: string; color: string } | null;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeads() {
      const supabase = createClient();
      const { data } = await supabase
        .from("leads")
        .select("*, pipeline_stages(name, color)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setLeads(data as unknown as Lead[]);
      setLoading(false);
    }
    fetchLeads();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">{leads.length} leads en total</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin leads"
          description="Los leads se crearán automáticamente cuando recibas mensajes de WhatsApp"
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Teléfono</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Etapa</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {lead.name || "Sin nombre"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.phone_number}
                  </td>
                  <td className="px-4 py-3">
                    {lead.pipeline_stages ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${lead.pipeline_stages.color}15`,
                          color: lead.pipeline_stages.color,
                        }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: lead.pipeline_stages.color }}
                        />
                        {lead.pipeline_stages.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {lead.score_category === "hot" && <Flame className="h-3.5 w-3.5 text-red-500" />}
                      {lead.score_category === "warm" && <Thermometer className="h-3.5 w-3.5 text-amber-500" />}
                      {lead.score_category === "cold" && <Snowflake className="h-3.5 w-3.5 text-blue-500" />}
                      <span className={cn(
                        "text-xs font-medium",
                        lead.score_category === "hot" && "text-red-600",
                        lead.score_category === "warm" && "text-amber-600",
                        lead.score_category === "cold" && "text-blue-600",
                      )}>
                        {lead.score}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString("es")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
