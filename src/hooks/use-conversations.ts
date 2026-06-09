"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "./use-realtime";

interface Conversation {
  id: string;
  lead_id: string;
  status: string;
  controlled_by: string;
  assigned_to: string | null;
  last_message_at: string | null;
  unread_count: number;
  leads: {
    name: string;
    phone_number: string;
    score: number | null;
    score_category: string | null;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Filters {
  status?: string;
  controlledBy?: string;
}

interface UseConversationsOptions {
  initialFilters?: Filters;
  limit?: number;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  pagination: Pagination;
  loading: boolean;
  error: string | null;
  filters: Filters;
  setFilters: (filters: Filters) => void;
  setPage: (page: number) => void;
  refresh: () => Promise<void>;
}

export function useConversations(
  options: UseConversationsOptions = {}
): UseConversationsReturn {
  const { initialFilters = {}, limit = 50 } = options;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (filters.status) params.set("status", filters.status);
      if (filters.controlledBy) params.set("controlled_by", filters.controlledBy);

      try {
        const response = await fetch(`/api/conversations?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Error al cargar conversaciones");
        }

        const data = await response.json();
        setConversations(data.conversations || []);
        setPagination(data.pagination || { page, limit, total: 0, totalPages: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    [filters, limit]
  );

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchConversations(1);
  }, [fetchConversations]);

  // Realtime: update conversation in list on change
  const handleUpdate = useCallback((payload: Record<string, unknown>) => {
    const updated = payload as unknown as Conversation;
    setConversations((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    );
  }, []);

  const handleInsert = useCallback(
    (payload: Record<string, unknown>) => {
      const inserted = payload as unknown as Conversation;
      // Only add if it matches current filters
      const matchesStatus = !filters.status || inserted.status === filters.status;
      const matchesControl =
        !filters.controlledBy || inserted.controlled_by === filters.controlledBy;

      if (matchesStatus && matchesControl) {
        setConversations((prev) => [inserted, ...prev]);
      }
    },
    [filters]
  );

  useRealtime({
    table: "conversations",
    onUpdate: handleUpdate,
    onInsert: handleInsert,
    enabled: true,
  });

  const setPage = useCallback(
    (page: number) => {
      fetchConversations(page);
    },
    [fetchConversations]
  );

  const refresh = useCallback(async () => {
    await fetchConversations(pagination.page);
  }, [fetchConversations, pagination.page]);

  return {
    conversations,
    pagination,
    loading,
    error,
    filters,
    setFilters,
    setPage,
    refresh,
  };
}
