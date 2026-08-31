/**
 * Claves canónicas de los datos del lead que se guardan en la ficha del
 * contacto (`contact.ficha`). Nombre y Teléfono NO están aquí: son columnas
 * propias del contacto (`contact.name` / `contact.phone`).
 *
 * Estas constantes son la ÚNICA fuente de nombres: las usan el agente
 * (update_ficha), la API y la UI, para no desincronizarse.
 */

export const LEAD_FIELDS = {
  provincia: "provincia",
  ciudad: "ciudad",
  direccion: "direccion",
  referencia: "referencia",
} as const;

export type LeadFieldKey = (typeof LEAD_FIELDS)[keyof typeof LEAD_FIELDS];

export const LEAD_FIELD_LABELS: Record<LeadFieldKey, string> = {
  provincia: "Provincia",
  ciudad: "Ciudad",
  direccion: "Dirección",
  referencia: "Referencia",
};

/** Claves de ficha que corresponden a datos estándar del lead. */
export const LEAD_FICHA_KEYS: LeadFieldKey[] = [
  LEAD_FIELDS.provincia,
  LEAD_FIELDS.ciudad,
  LEAD_FIELDS.direccion,
  LEAD_FIELDS.referencia,
];
