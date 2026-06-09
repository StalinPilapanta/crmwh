"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "./use-tenant";
import { useRealtime } from "./use-realtime";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useTenant();

  // Fetch existing notifications
  useEffect(() => {
    if (!userId) return;

    async function fetchNotifications() {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, data, read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setNotifications(data as unknown as Notification[]);
      setLoading(false);
    }

    fetchNotifications();
  }, [userId]);

  // Realtime subscription for new notifications
  const handleInsert = useCallback((payload: Record<string, unknown>) => {
    const newNotif = payload as unknown as Notification;
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  const handleUpdate = useCallback((payload: Record<string, unknown>) => {
    const updated = payload as unknown as Notification;
    setNotifications((prev) =>
      prev.map((n) => (n.id === updated.id ? updated : n))
    );
  }, []);

  const handleDelete = useCallback((payload: Record<string, unknown>) => {
    const deleted = payload as unknown as { id: string };
    setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
  }, []);

  useRealtime({
    table: "notifications",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
    enabled: !!userId,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId]);

  const dismiss = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    dismiss,
  };
}
