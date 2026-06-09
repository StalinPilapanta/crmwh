import {
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

export default function DashboardPage() {
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
          value={0}
          icon={MessageSquare}
          description="hoy"
        />
        <MetricCard
          title="Leads nuevos"
          value={0}
          icon={Users}
          description="esta semana"
        />
        <MetricCard
          title="Tasa de conversión"
          value="0%"
          icon={TrendingUp}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Tiempo de respuesta"
          value="--"
          icon={Clock}
          description="promedio"
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
              <p className="mt-2">Sin datos aún</p>
              <p className="text-xs">Los gráficos aparecerán cuando tengas conversaciones</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">
            Rendimiento de agentes
          </h3>
          <div className="mt-4 flex h-48 items-center justify-center text-sm text-muted-foreground">
            <div className="text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2">Sin datos aún</p>
              <p className="text-xs">Conecta WhatsApp para comenzar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
