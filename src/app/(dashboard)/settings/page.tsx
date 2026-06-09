"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Building2, MessageCircle, Bot, HardDrive, ShoppingBag, Users, Target, Clock } from "lucide-react";
import { WhatsAppConfig } from "@/components/settings/whatsapp-config";
import { AIProviderConfig } from "@/components/settings/ai-provider-config";
import { GoogleDriveConfig } from "@/components/settings/gdrive-config";
import { DropiConfig } from "@/components/settings/dropi-config";
import { TeamConfig } from "@/components/settings/team-config";
import { ScoringConfig } from "@/components/settings/scoring-config";
import { FollowUpConfig } from "@/components/settings/followup-config";
import { TenantConfig } from "@/components/settings/tenant-config";

const tabs = [
  { id: "tenant", label: "Empresa", icon: Building2 },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "ai-provider", label: "Proveedor IA", icon: Bot },
  { id: "gdrive", label: "Google Drive", icon: HardDrive },
  { id: "dropi", label: "Dropi", icon: ShoppingBag },
  { id: "team", label: "Equipo", icon: Users },
  { id: "scoring", label: "Scoring", icon: Target },
  { id: "followup", label: "Follow-up", icon: Clock },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("tenant");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tu cuenta, integraciones y preferencias
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-t-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
              activeTab === tab.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border bg-card p-6">
        {activeTab === "tenant" && <TenantConfig />}
        {activeTab === "whatsapp" && <WhatsAppConfig />}
        {activeTab === "ai-provider" && <AIProviderConfig />}
        {activeTab === "gdrive" && <GoogleDriveConfig />}
        {activeTab === "dropi" && <DropiConfig />}
        {activeTab === "team" && <TeamConfig />}
        {activeTab === "scoring" && <ScoringConfig />}
        {activeTab === "followup" && <FollowUpConfig />}
      </div>
    </div>
  );
}
