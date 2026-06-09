"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ChatWindow } from "@/components/conversations/chat-window";

interface Conversation {
  id: string;
  lead_id: string;
  controlled_by: "ai" | "human";
  assigned_to: string | null;
  ai_agent_id: string | null;
  status: string;
  last_message_at: string | null;
  unread_count: number;
  leads: { name: string | null; phone_number: string } | null;
  ai_agents: { name: string } | null;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);

  useEffect(() => {
    async function fetchConversations() {
      const supabase = createClient();
      const { data } = await supabase
        .from("conversations")
        .select("*, leads(name, phone_number), ai_agents(name)")
        .order("last_message_at", { ascending: false });

      if (data) {
        const convs = data as unknown as Conversation[];
        setConversations(convs);
        if (convs.length > 0 && !selectedConv) {
          setSelectedConv(convs[0]);
        }
      }
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

  if (conversations.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Conversaciones</h1>
        <EmptyState
          icon={MessageSquare}
          title="Sin conversaciones"
          description="Las conversaciones aparecerán cuando tus leads envíen mensajes por WhatsApp"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Conversaciones</h1>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr] h-[calc(100vh-180px)]">
        {/* Conversation List */}
        <div className="space-y-1 overflow-y-auto rounded-xl border bg-card p-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv)}
              className={`w-full rounded-lg p-3 text-left transition-colors ${
                selectedConv?.id === conv.id
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
                  {conv.controlled_by === "ai" ? `🤖 ${conv.ai_agents?.name || "IA"}` : "👤 Humano"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {conv.status}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Chat Window */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {selectedConv ? (
            <ChatWindow
              conversationId={selectedConv.id}
              controlledBy={selectedConv.controlled_by}
              assignedTo={selectedConv.assigned_to}
              onControlChange={(newControl) => {
                setSelectedConv({ ...selectedConv, controlled_by: newControl });
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === selectedConv.id
                      ? { ...c, controlled_by: newControl }
                      : c
                  )
                );
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Selecciona una conversación
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
