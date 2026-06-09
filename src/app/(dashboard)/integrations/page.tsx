import Link from "next/link";
import { MessageCircle, Bot, ShoppingBag, HardDrive, ArrowRight } from "lucide-react";

const integrations = [
  {
    name: "WhatsApp Business",
    description: "Conecta tu número de WhatsApp Business",
    icon: MessageCircle,
    color: "#25D366",
    tab: "whatsapp",
  },
  {
    name: "Proveedor IA",
    description: "OpenRouter, OpenAI o Anthropic",
    icon: Bot,
    color: "#0D9488",
    tab: "ai-provider",
  },
  {
    name: "Dropi",
    description: "Sincroniza productos e inventario",
    icon: ShoppingBag,
    color: "#F59E0B",
    tab: "dropi",
  },
  {
    name: "Google Drive",
    description: "Importa documentos de conocimiento",
    icon: HardDrive,
    color: "#4285F4",
    tab: "gdrive",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="text-sm text-muted-foreground">
          Conecta servicios externos para potenciar tu CRM. Configura cada integración desde{" "}
          <Link href="/settings" className="text-primary hover:underline">Configuración</Link>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((integration) => (
          <Link
            key={integration.name}
            href={`/settings?tab=${integration.tab}`}
            className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${integration.color}15` }}
              >
                <integration.icon
                  className="h-6 w-6"
                  style={{ color: integration.color }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{integration.name}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {integration.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
