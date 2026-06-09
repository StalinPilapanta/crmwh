"use client";

export function ScoringConfig() {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Calificación de Leads</h3>
      <p className="text-sm text-muted-foreground">
        Configura cómo se califica automáticamente a tus leads basado en sus conversaciones.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-sm font-medium">Cold</span>
          </div>
          <p className="text-xs text-muted-foreground">0 - 33 puntos</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-sm font-medium">Warm</span>
          </div>
          <p className="text-xs text-muted-foreground">34 - 66 puntos</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm font-medium">Hot</span>
          </div>
          <p className="text-xs text-muted-foreground">67 - 100 puntos</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        El scoring se ejecuta automáticamente después de cada mensaje del lead usando el proveedor IA configurado.
      </p>
    </div>
  );
}
