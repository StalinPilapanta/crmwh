"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface TenantInfo {
  tenantId: string | null;
  role: "admin" | "supervisor" | "agent" | null;
  userId: string | null;
  isLoading: boolean;
}

export function useTenant(): TenantInfo {
  const [info, setInfo] = useState<TenantInfo>({
    tenantId: null,
    role: null,
    userId: null,
    isLoading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    async function getSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const appMetadata = session.user.app_metadata;
        setInfo({
          tenantId: appMetadata?.tenant_id ?? null,
          role: appMetadata?.role ?? null,
          userId: session.user.id,
          isLoading: false,
        });
      } else {
        setInfo({
          tenantId: null,
          role: null,
          userId: null,
          isLoading: false,
        });
      }
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const appMetadata = session.user.app_metadata;
        setInfo({
          tenantId: appMetadata?.tenant_id ?? null,
          role: appMetadata?.role ?? null,
          userId: session.user.id,
          isLoading: false,
        });
      } else {
        setInfo({
          tenantId: null,
          role: null,
          userId: null,
          isLoading: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return info;
}
