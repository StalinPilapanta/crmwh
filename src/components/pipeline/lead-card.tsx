"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Phone, Flame, Snowflake, Thermometer } from "lucide-react";

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  score: number;
  score_category: string;
  stage_id: string | null;
  created_at: string;
}

interface LeadCardProps {
  lead: Lead;
  isDragging?: boolean;
}

const scoreIcons = {
  hot: { icon: Flame, color: "text-red-500", bg: "bg-red-50" },
  warm: { icon: Thermometer, color: "text-amber-500", bg: "bg-amber-50" },
  cold: { icon: Snowflake, color: "text-blue-500", bg: "bg-blue-50" },
};

export function LeadCard({ lead, isDragging }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const scoreInfo = scoreIcons[lead.score_category as keyof typeof scoreIcons] || scoreIcons.cold;
  const ScoreIcon = scoreInfo.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-lg border bg-background p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-50 shadow-lg rotate-2"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {lead.name || "Sin nombre"}
          </p>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{lead.phone_number}</span>
          </div>
        </div>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            scoreInfo.bg
          )}
        >
          <ScoreIcon className={cn("h-3.5 w-3.5", scoreInfo.color)} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Score: {lead.score}
        </span>
      </div>
    </div>
  );
}
