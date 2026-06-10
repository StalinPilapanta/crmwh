"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wifi, WifiOff, Trash2, MessageCircle } from "lucide-react";

interface Session {
  id: string;
  display_phone: string;
  phone_number_id: string;
  status: string;
  created_at: string;
}

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: FBLoginResponse) => void, params: { config_id: string; response_type: string; override_default_response_type: boolean; extras: { setup: object; featureType: string; sessionInfoVersion: string } }) => void;
    };
    launchWhatsAppSignup: () => void;
  }
}

interface FBLoginResponse {
  authResponse?: {
    code: string;
    accessToken?: string;
  };
  status: string;
}

export function WhatsAppConfig() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    fetchSessions();
    loadFacebookSDK();
  }, []);

  async function fetchSessions() {
    const supabase = createClient();
    const { data } = await supabase
      .from("whatsapp_sessions")
      .select("id, display_phone, phone_number_id, status, created_at")
      .order("created_at", { ascending: false });
    if (data) setSessions(data);
    setLoading(false);
  }

  function loadFacebookSDK() {
    // Check if already loaded
    if (window.FB) {
      setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID || "",
        autoLogAppEvents: true,
        xfbml: true,
        version: "v21.0",
      });
      setSdkLoaded(true);
    };

    // Load SDK script
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);
  }

  const launchEmbeddedSignup = useCallback(() => {
    if (!window.FB) {
      setError("Facebook SDK no cargado. Recarga la página.");
      return;
    }

    setConnecting(true);
    setError("");

    window.FB.login(
      function (response: FBLoginResponse) {
        if (response.authResponse?.code) {
          // Send the code to our backend to exchange for tokens
          exchangeCode(response.authResponse.code);
        } else {
          setConnecting(false);
          setError("Conexión cancelada o fallida");
        }
      },
      {
        config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID || "",
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      }
    );
  }, []);

  async function exchangeCode(code: string) {
    try {
      const res = await fetch("/api/whatsapp/embedded-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        const { session } = await res.json();
        setSessions((prev) => [session, ...prev]);
        setConnecting(false);
      } else {
        const data = await res.json();
        setError(data.error || "Error al conectar WhatsApp");
        setConnecting(false);
      }
    } catch {
      setError("Error de red al conectar");
      setConnecting(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/whatsapp/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">WhatsApp Business</h3>
        <button
          onClick={launchEmbeddedSignup}
          disabled={connecting || !sdkLoaded}
          className="inline-flex items-center gap-2 rounded-md bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:bg-[#20bd5a] disabled:opacity-50"
        >
          <MessageCircle className="h-4 w-4" />
          {connecting ? "Conectando..." : "Conectar WhatsApp"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Haz clic en "Conectar WhatsApp" para vincular tu número de WhatsApp Business. 
        Se abrirá una ventana de Meta donde podrás autorizar tu cuenta.
      </p>

      {error && (
        <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">No hay números conectados</p>
          <p className="text-xs text-muted-foreground">Conecta tu número de WhatsApp Business para empezar a recibir mensajes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {session.status === "active" ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium">{session.display_phone}</p>
                  <p className="text-xs text-muted-foreground">ID: {session.phone_number_id}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(session.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
