"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { createClient } from "@/lib/supabase/client";

interface Metrics {
  activeConversations: number;
  newLeads: number;
  totalLeads: number;
  avgScore: number;
  messagesToday: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      const supabase = createClient();

      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [convRes, leadsWeekRes, leadsAllRes, messagesRes] = await Promise.all([
        supabase.from("conversations").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", weekStart),
        supabase.from("leads").select("score"),
        supabase.from("messages").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
      ]);

      const scores = (leadsAllRes.data || []).filter((l) => l.score > 0);
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((sum, l) => sum + l.score, 0) / scores.length)
        : 0;

      setMetrics({
        activeConversations: convRes.count || 0,
        newLeads: leadsWeekRes.count || 0,
        totalLeads: leadsAllRes.data?.length || 0,
        avgScore,
        messagesToday: messagesRes.count || 0,
      });
    }

    loadMetrics();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de actividad de tu CRM
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Conversaciones activas"
          value={metrics?.activeConversations ?? "—"}
          icon={MessageSquare}
          description="en este momento"
        />
        <MetricCard
          title="Leads nuevos"
          value={metrics?.newLeads ?? "—"}
          icon={Users}
          description="esta semana"
        />
        <MetricCard
          title="Score promedio"
          value={metrics ? `${metrics.avgScore}` : "—"}
          icon={TrendingUp}
          description="de todos los leads"
        />
        <MetricCard
          title="Mensajes hoy"
          value={metrics?.messagesToday ?? "—"}
          icon={Clock}
          description="recibidos + enviados"
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">
            Conversaciones por día
          </h3>
          <div className="mt-4 flex h-48 items-center justify-center text-sm text-muted-foreground">
            <div className="text-center">
              <Zap className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2">Sin datos suficientes</p>
              <p className="text-xs">Los gráficos aparecerán con más actividad</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">
            Resumen
          </h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm">Total de leads</span>
              <span className="text-sm font-semibold">{metrics?.totalLeads ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm">Mensajes hoy</span>
              <span className="text-sm font-semibold">{metrics?.messagesToday ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm">Score promedio</span>
              <span className="text-sm font-semibold">{metrics?.avgScore ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
