"use client";

import { AlertTriangle, UserCheck } from "lucide-react";

interface HandoffBannerProps {
  controlledBy: "ai" | "human";
  onAccept?: () => void;
  onRelease?: () => void;
  isAssignedToMe?: boolean;
}

export function HandoffBanner({
  controlledBy,
  onAccept,
  onRelease,
  isAssignedToMe,
}: HandoffBannerProps) {
  if (controlledBy === "ai") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800">
            Conversación controlada por IA
          </span>
        </div>
        {onAccept && (
          <button
            onClick={onAccept}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Tomar control
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2">
      <div className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-800">
          {isAssignedToMe ? "Tú controlas esta conversación" : "Controlada por humano"}
        </span>
      </div>
      {isAssignedToMe && onRelease && (
        <button
          onClick={onRelease}
          className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
        >
          Devolver a IA
        </button>
      )}
    </div>
  );
}
