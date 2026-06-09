"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

interface Message {
  id: string;
  sender_type: "lead" | "ai" | "human";
  content: string;
  message_type: string;
  status?: string;
  created_at: string;
  sender_id?: string | null;
}

interface MessageBubbleProps {
  message: Message;
}

const statusIcons = {
  pending: Clock,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: AlertCircle,
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.sender_type === "human";
  const isAI = message.sender_type === "ai";

  const StatusIcon = message.status
    ? statusIcons[message.status as keyof typeof statusIcons]
    : null;

  return (
    <div
      className={cn(
        "flex w-full",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
          isOutgoing && "bg-primary text-primary-foreground rounded-br-md",
          isAI && "bg-accent/20 text-foreground rounded-bl-md",
          !isOutgoing && !isAI && "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {/* Sender label */}
        {isAI && (
          <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">
            🤖 IA
          </span>
        )}

        {/* Content */}
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* Timestamp + status */}
        <div
          className={cn(
            "mt-1 flex items-center gap-1",
            isOutgoing ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {formatTime(message.created_at)}
          </span>
          {isOutgoing && StatusIcon && (
            <StatusIcon
              className={cn(
                "h-3 w-3",
                message.status === "read"
                  ? "text-blue-300"
                  : message.status === "failed"
                  ? "text-destructive"
                  : "text-primary-foreground/70"
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}
