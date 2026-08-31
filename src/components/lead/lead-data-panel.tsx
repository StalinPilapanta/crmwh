"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEAD_FIELDS } from "@/lib/lead-fields";
import { DEFAULT_COUNTRY, listCiudades, listProvincias } from "@/lib/geo";
import type { FichaDto } from "@/lib/types";

/**
 * Datos estándar del lead, unificados para las tres vistas (Inbox, Pipeline,
 * Contactos). Nombre y Teléfono editan columnas del contacto; Provincia,
 * Ciudad, Dirección y Referencia editan la ficha. Provincia/Ciudad usan
 * selectores del catálogo del país (o texto libre si no hay catálogo).
 *
 * Guarda con un patch parcial vía onSave (que hace PATCH /api/contacts/:id).
 */
export type LeadData = {
  name: string | null;
  phone: string | null;
  ficha: FichaDto;
};

export type LeadDataPatch = {
  name?: string;
  phone?: string;
  ficha?: Record<string, string | null>;
};

export function LeadDataPanel({
  data,
  country: countryProp,
  onSave,
}: {
  data: LeadData;
  /** País de operación. Si no se pasa, se resuelve desde la marca. */
  country?: string;
  onSave: (patch: LeadDataPatch) => Promise<void>;
}) {
  // Resuelve el país desde la marca si no viene por props (evita pasarlo en
  // cada una de las 3 vistas).
  const [country, setCountry] = useState<string>(countryProp ?? DEFAULT_COUNTRY);
  useEffect(() => {
    if (countryProp) {
      setCountry(countryProp);
      return;
    }
    let cancel = false;
    fetch("/api/settings/branding")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancel && d?.branding?.country) setCountry(d.branding.country);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [countryProp]);

  const provincias = listProvincias(country);
  const hasGeo = provincias.length > 0;

  const provincia = strValue(data.ficha[LEAD_FIELDS.provincia]);
  const ciudad = strValue(data.ficha[LEAD_FIELDS.ciudad]);
  const direccion = strValue(data.ficha[LEAD_FIELDS.direccion]);
  const referencia = strValue(data.ficha[LEAD_FIELDS.referencia]);

  const [saving, setSaving] = useState(false);

  async function save(patch: LeadDataPatch) {
    setSaving(true);
    try {
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Datos del lead</p>

      <TextRow
        label="Nombre"
        value={data.name ?? ""}
        disabled={saving}
        onSave={(v) => save({ name: v || undefined })}
      />
      <TextRow
        label="Teléfono"
        value={data.phone ?? ""}
        disabled={saving}
        onSave={(v) => save({ phone: v || undefined })}
      />

      {hasGeo ? (
        <>
          <div className="space-y-1">
            <label className="text-xs text-text-3">Provincia</label>
            <select
              value={provincia}
              disabled={saving}
              onChange={(e) => {
                // Cambiar de provincia invalida la ciudad previa.
                void save({
                  ficha: {
                    [LEAD_FIELDS.provincia]: e.target.value || null,
                    [LEAD_FIELDS.ciudad]: null,
                  },
                });
              }}
              className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="">— Selecciona —</option>
              {provincias.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-3">Ciudad</label>
            <select
              value={ciudad}
              disabled={saving || !provincia}
              onChange={(e) =>
                void save({
                  ficha: { [LEAD_FIELDS.ciudad]: e.target.value || null },
                })
              }
              className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {provincia ? "— Selecciona —" : "Elige provincia primero"}
              </option>
              {listCiudades(country, provincia).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <TextRow
            label="Provincia"
            value={provincia}
            disabled={saving}
            onSave={(v) => save({ ficha: { [LEAD_FIELDS.provincia]: v || null } })}
          />
          <TextRow
            label="Ciudad"
            value={ciudad}
            disabled={saving}
            onSave={(v) => save({ ficha: { [LEAD_FIELDS.ciudad]: v || null } })}
          />
        </>
      )}

      <TextRow
        label="Dirección"
        value={direccion}
        disabled={saving}
        onSave={(v) => save({ ficha: { [LEAD_FIELDS.direccion]: v || null } })}
      />
      <TextRow
        label="Referencia"
        value={referencia}
        disabled={saving}
        onSave={(v) => save({ ficha: { [LEAD_FIELDS.referencia]: v || null } })}
      />
    </div>
  );
}

/** Fila editable inline (label + valor + lápiz). */
function TextRow({
  label,
  value,
  disabled,
  onSave,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onSave: (v: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function start() {
    setDraft(value);
    setEditing(true);
  }
  async function confirm() {
    setEditing(false);
    if (draft.trim() !== value) await onSave(draft.trim());
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <label className="text-xs text-text-3">{label}</label>
          <Input
            autoFocus
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirm();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-8"
          />
        </div>
        <Button size="icon" variant="ghost" aria-label="Guardar" onClick={() => void confirm()}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEditing(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-text-3">{label}</p>
        <p className="truncate text-sm">
          {value || <span className="text-text-3">—</span>}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Editar ${label}`}
        className="opacity-0 transition-opacity group-hover:opacity-100"
        disabled={disabled}
        onClick={start}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function strValue(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
