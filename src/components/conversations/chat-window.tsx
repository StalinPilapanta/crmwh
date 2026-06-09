"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageBubble } from "./message-bubble";
import { HandoffBanner } from "./handoff-banner";
import { Send, Loader2 } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import { useTenant } from "@/hooks/use-tenant";

interface Message {
  id: string;
  sender_type: "lead" | "ai" | "human";
  content: string;
  message_type: string;
  status?: string;
  created_at: string;
  sender_id?: string | null;
}

interface ChatWindowProps {
  conversationId: string;
  controlledBy: "ai" | "human";
  assignedTo?: string | null;
  onControlChange?: (controlledBy: "ai" | "human") => void;
}

export function ChatWindow({
  conversationId,
  controlledBy,
  assignedTo,
  onControlChange,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { userId } = useTenant();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch messages
  useEffect(() => {
    async function fetchMessages() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data as unknown as Message[]);
      setLoading(false);
    }

    fetchMessages();
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Realtime subscription for new messages
  const handleInsert = useCallback((payload: Record<string, unknown>) => {
    const newMsg = payload as unknown as Message;
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });
  }, []);

  const handleUpdate = useCallback((payload: Record<string, unknown>) => {
    const updated = payload as unknown as Message;
    setMessages((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );
  }, []);

  useRealtime({
    table: "messages",
    filter: `conversation_id=eq.${conversationId}`,
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    enabled: !!conversationId,
  });

  // Send message
  async function handleSend() {
    if (!inputValue.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputValue.trim() }),
      });

      if (res.ok) {
        const { message } = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message as Message];
        });
        setInputValue("");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  }

  // Handoff actions
  async function handleAcceptHandoff() {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        onControlChange?.("human");
      }
    } catch (error) {
      console.error("Error accepting handoff:", error);
    }
  }

  async function handleReleaseHandoff() {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      });
      if (res.ok) {
        onControlChange?.("ai");
      }
    } catch (error) {
      console.error("Error releasing handoff:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Handoff banner */}
      <HandoffBanner
        controlledBy={controlledBy}
        onAccept={handleAcceptHandoff}
        onRelease={handleReleaseHandoff}
        isAssignedToMe={assignedTo === userId}
      />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Sin mensajes aún
          </p>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
