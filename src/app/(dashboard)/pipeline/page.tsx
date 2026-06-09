"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { KanbanColumn } from "@/components/pipeline/kanban-column";
import { LeadCard } from "@/components/pipeline/lead-card";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
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

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [stagesRes, leadsRes] = await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("*")
        .order("position", { ascending: true }),
      supabase
        .from("leads")
        .select("id, name, phone_number, score, score_category, stage_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (stagesRes.data) setStages(stagesRes.data);
    if (leadsRes.data) setLeads(leadsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStageId = over.id as string;

    // Optimistic update
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, stage_id: newStageId } : lead
      )
    );

    // Update in DB
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({ stage_id: newStageId })
      .eq("id", leadId);

    if (error) {
      // Rollback
      fetchData();
    }
  }

  const activeLead = leads.find((l) => l.id === activeId);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pipeline de Ventas</h1>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-72 shrink-0 rounded-xl border bg-card p-4 animate-pulse"
            >
              <div className="h-6 w-24 rounded bg-muted mb-4" />
              <div className="space-y-3">
                <div className="h-20 rounded bg-muted" />
                <div className="h-20 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline de Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Arrastra los leads entre etapas
          </p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leads.filter((l) => l.stage_id === stage.id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
