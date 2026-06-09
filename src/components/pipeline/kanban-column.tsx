"use client";

import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./lead-card";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  score: number;
  score_category: string;
  stage_id: string | null;
  created_at: string;
}

interface KanbanColumnProps {
  stage: Stage;
  leads: Lead[];
}

export function KanbanColumn({ stage, leads }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 rounded-xl border bg-card transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-4 pb-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2 p-3 pt-1 min-h-[200px]">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Sin leads
          </p>
        )}
      </div>
    </div>
  );
}
