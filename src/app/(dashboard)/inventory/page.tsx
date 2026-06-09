"use client";

import { Package } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function InventoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Productos y pedidos sincronizados con Dropi
        </p>
      </div>

      <EmptyState
        icon={Package}
        title="Sin productos"
        description="Conecta Dropi en Integraciones para sincronizar tu catálogo de productos"
      />
    </div>
  );
}
