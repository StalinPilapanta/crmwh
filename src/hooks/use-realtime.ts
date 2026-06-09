"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeOptions {
  table: string;
  filter?: string;
  onInsert?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (payload: Record<string, unknown>) => void;
  enabled?: boolean;
}

export function useRealtime({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channelName = `${table}-${filter || "all"}-${Date.now()}`;
    let channel = supabase.channel(channelName);

    const config: Record<string, unknown> = {
      event: "*",
      schema: "public",
      table,
    };

    if (filter) {
      config.filter = filter;
    }

    channel = channel.on(
      "postgres_changes" as never,
      config as never,
      (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        switch (payload.eventType) {
          case "INSERT":
            onInsert?.(payload.new);
            break;
          case "UPDATE":
            onUpdate?.(payload.new);
            break;
          case "DELETE":
            onDelete?.(payload.old);
            break;
        }
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled, onInsert, onUpdate, onDelete]);

  return channelRef;
}
