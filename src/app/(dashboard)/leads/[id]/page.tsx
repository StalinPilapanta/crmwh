"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Flame,
  Snowflake,
  Thermometer,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MessageBubble } from "@/components/conversations/message-bubble";

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  score: number;
  score_category: string;
  stage_id: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  last_contact_at: string | null;
  pipeline_stages: { name: string; color: string } | null;
}

interface Message {
  id: string;
  sender_type: "lead" | "ai" | "human";
  content: string;
  message_type: string;
  status?: string;
  created_at: string;
  sender_id?: string | null;
}

interface Conversation {
  id: string;
  status: string;
  controlled_by: string;
  last_message_at: string | null;
}

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [lead, setLead] = useState<Lead | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLead() {
      const supabase = createClient();

      const { data: leadData } = await supabase
        .from("leads")
        .select("*, pipeline_stages(name, color)")
        .eq("id", id)
        .single();

      if (leadData) setLead(leadData as unknown as Lead);

      // Fetch conversations for this lead
      const { data: convData } = await supabase
        .from("conversations")
        .select("id, status, controlled_by, last_message_at")
        .eq("lead_id", id)
        .order("last_message_at", { ascending: false });

      if (convData) {
        setConversations(convData as unknown as Conversation[]);
        if (convData.length > 0) {
          setSelectedConvId(convData[0].id as string);
        }
      }

      setLoading(false);
    }

    fetchLead();
  }, [id]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (!selectedConvId) return;

    async function fetchMessages() {
      const supabase = createClient();
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConvId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data as unknown as Message[]);
    }

    fetchMessages();
  }, [selectedConvId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-4">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a leads
        </Link>
        <p className="text-muted-foreground">Lead no encontrado</p>
      </div>
    );
  }

  const scoreInfo = {
    hot: { icon: Flame, color: "text-red-500", label: "Caliente" },
    warm: { icon: Thermometer, color: "text-amber-500", label: "Tibio" },
    cold: { icon: Snowflake, color: "text-blue-500", label: "Frío" },
  };
  const score =
    scoreInfo[lead.score_category as keyof typeof scoreInfo] || scoreInfo.cold;
  const ScoreIcon = score.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="text-2xl font-bold">{lead.name || "Sin nombre"}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Lead Info */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Información
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{lead.phone_number}</span>
              </div>

              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{lead.email}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Creado: {new Date(lead.created_at).toLocaleDateString("es")}
                </span>
              </div>

              {lead.last_contact_at && (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Último contacto:{" "}
                    {new Date(lead.last_contact_at).toLocaleDateString("es")}
                  </span>
                </div>
              )}
            </div>

            {/* Score */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
              <ScoreIcon className={cn("h-5 w-5", score.color)} />
              <div>
                <p className="text-sm font-medium">Score: {lead.score}</p>
                <p className="text-xs text-muted-foreground">{score.label}</p>
              </div>
            </div>

            {/* Stage */}
            {lead.pipeline_stages && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Etapa</p>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
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
              </div>
            )}

            {/* Tags */}
            {lead.tags && lead.tags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {lead.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notas</p>
                <p className="text-sm">{lead.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Conversations and messages */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-[500px]">
          {/* Conversation tabs */}
          {conversations.length > 1 && (
            <div className="border-b px-4 py-2 flex gap-2 overflow-x-auto">
              {conversations.map((conv, i) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    selectedConvId === conv.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  Conv {i + 1} ({conv.status})
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {conversations.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sin conversaciones
              </p>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sin mensajes en esta conversación
              </p>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
