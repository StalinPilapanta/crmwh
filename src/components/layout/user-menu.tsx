"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User, ChevronDown, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type UserStatus = "available" | "busy" | "offline";

const STATUS_CONFIG: Record<UserStatus, { label: string; color: string }> = {
  available: { label: "Disponible", color: "text-green-500" },
  busy: { label: "Ocupado", color: "text-yellow-500" },
  offline: { label: "Desconectado", color: "text-muted-foreground" },
};

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<UserStatus>("available");
  const [changingStatus, setChangingStatus] = useState(false);
  const router = useRouter();

  // Load initial status
  useEffect(() => {
    const supabase = createClient();
    async function loadStatus() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from("users")
          .select("status")
          .eq("id", session.user.id)
          .single();
        if (data?.status) {
          setStatus(data.status as UserStatus);
        }
      }
    }
    loadStatus();
  }, []);

  async function handleStatusChange(newStatus: UserStatus) {
    if (newStatus === status) return;
    setChangingStatus(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await supabase
        .from("users")
        .update({ status: newStatus })
        .eq("id", session.user.id);
      setStatus(newStatus);
    }
    setChangingStatus(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    // Set offline before signing out
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from("users")
        .update({ status: "offline" })
        .eq("id", session.user.id);
    }
    await supabase.auth.signOut();
    router.push("/login");
  }

  const currentStatusConfig = STATUS_CONFIG[status];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted transition-colors"
      >
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" />
          <Circle
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current",
              currentStatusConfig.color
            )}
          />
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border bg-card py-1 shadow-lg">
            {/* Status section */}
            <div className="px-4 py-2 border-b">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Estado
              </p>
              <div className="flex flex-col gap-1">
                {(Object.entries(STATUS_CONFIG) as [UserStatus, typeof currentStatusConfig][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      onClick={() => handleStatusChange(key)}
                      disabled={changingStatus}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        status === key
                          ? "bg-muted font-medium"
                          : "hover:bg-muted"
                      )}
                    >
                      <Circle
                        className={cn("h-3 w-3 fill-current", config.color)}
                      />
                      {config.label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
