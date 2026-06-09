import { Plug, MessageCircle, Bot, ShoppingBag, HardDrive } from "lucide-react";

const integrations = [
  {
    name: "WhatsApp Business",
    description: "Conecta tu número de WhatsApp Business",
    icon: MessageCircle,
    href: "/settings/whatsapp",
    color: "#25D366",
  },
  {
    name: "Proveedor IA",
    description: "OpenRouter, OpenAI o Anthropic",
    icon: Bot,
    href: "/agents",
    color: "#0D9488",
  },
  {
    name: "Dropi",
    description: "Sincroniza productos e inventario",
    icon: ShoppingBag,
    href: "/inventory",
    color: "#F59E0B",
  },
  {
    name: "Google Drive",
    description: "Importa documentos de conocimiento",
    icon: HardDrive,
    href: "/settings",
    color: "#4285F4",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="text-sm text-muted-foreground">
          Conecta servicios externos para potenciar tu CRM
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${integration.color}15` }}
              >
                <integration.icon
                  className="h-6 w-6"
                  style={{ color: integration.color }}
                />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{integration.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {integration.description}
                </p>
                <span className="mt-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  No conectado
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
