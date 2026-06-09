"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

interface Conversation {
  id: string;
  lead_id: string;
  controlled_by: string;
  status: string;
  last_message_at: string | null;
  unread_count: number;
  leads: { name: string | null; phone_number: string } | null;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConversations() {
      const supabase = createClient();
      const { data } = await supabase
        .from("conversations")
        .select("*, leads(name, phone_number)")
        .order("last_message_at", { ascending: false });

      if (data) setConversations(data as unknown as Conversation[]);
      setLoading(false);
    }
    fetchConversations();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Conversaciones</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Conversaciones</h1>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Sin conversaciones"
          description="Las conversaciones aparecerán cuando tus leads envíen mensajes por WhatsApp"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[350px_1fr]">
          {/* Conversation List */}
          <div className="space-y-2 rounded-xl border bg-card p-3">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full rounded-lg p-3 text-left transition-colors ${
                  selectedId === conv.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">
                    {conv.leads?.name || conv.leads?.phone_number || "Desconocido"}
                  </p>
                  {conv.unread_count > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    conv.controlled_by === "ai"
                      ? "bg-accent/20 text-accent-foreground"
                      : "bg-blue-50 text-blue-700"
                  }`}>
                    {conv.controlled_by === "ai" ? "IA" : "Humano"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {conv.status}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Chat Window */}
          <div className="rounded-xl border bg-card p-6 flex items-center justify-center min-h-[400px]">
            {selectedId ? (
              <p className="text-sm text-muted-foreground">
                Chat en desarrollo - Seleccionaste conversación {selectedId}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecciona una conversación para ver los mensajes
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
