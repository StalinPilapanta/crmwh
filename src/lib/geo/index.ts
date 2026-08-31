import ecuador from "./ec.json";

/**
 * Catálogo geográfico por país (país → provincias → ciudades). Data estática
 * en el repo (constitución II: sin dependencias externas). La división
 * territorial casi no cambia. Estructura lista para agregar más países:
 * agregar `xx.json` y registrarlo en CATALOGS.
 */

export type GeoProvincia = { nombre: string; ciudades: string[] };
export type GeoCatalog = {
  code: string;
  name: string;
  provincias: GeoProvincia[];
};

export const SUPPORTED_COUNTRIES = [{ code: "EC", name: "Ecuador" }] as const;

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]["code"];

export const SUPPORTED_COUNTRY_CODES = SUPPORTED_COUNTRIES.map(
  (c) => c.code
) as [CountryCode, ...CountryCode[]];

const CATALOGS: Record<string, GeoCatalog> = {
  EC: ecuador as GeoCatalog,
};

export const DEFAULT_COUNTRY: CountryCode = "EC";

/** Catálogo del país, o null si no está soportado. */
export function getGeoCatalog(country: string): GeoCatalog | null {
  return CATALOGS[country?.toUpperCase()] ?? null;
}

/** Nombres de provincias del país (vacío si no hay catálogo). */
export function listProvincias(country: string): string[] {
  const cat = getGeoCatalog(country);
  return cat ? cat.provincias.map((p) => p.nombre) : [];
}

/** Ciudades de una provincia (vacío si no aplica). */
export function listCiudades(country: string, provincia: string): string[] {
  const cat = getGeoCatalog(country);
  if (!cat) return [];
  const prov = findProvincia(cat, provincia);
  return prov ? prov.ciudades : [];
}

/**
 * Normaliza el nombre de una provincia contra el catálogo (tolerante a
 * acentos y mayúsculas). Devuelve el nombre canónico o null si no coincide o
 * el país no tiene catálogo.
 */
export function normalizeProvincia(
  country: string,
  raw: string
): string | null {
  const cat = getGeoCatalog(country);
  if (!cat || !raw) return null;
  const prov = findProvincia(cat, raw);
  return prov ? prov.nombre : null;
}

/**
 * Normaliza una ciudad DENTRO de una provincia. Devuelve el nombre canónico o
 * null si la ciudad no pertenece a esa provincia (o no hay catálogo).
 */
export function normalizeCiudad(
  country: string,
  provincia: string,
  raw: string
): string | null {
  const cat = getGeoCatalog(country);
  if (!cat || !raw) return null;
  const prov = findProvincia(cat, provincia);
  if (!prov) return null;
  const key = fold(raw);
  return prov.ciudades.find((c) => fold(c) === key) ?? null;
}

function findProvincia(
  cat: GeoCatalog,
  provincia: string
): GeoProvincia | null {
  const key = fold(provincia);
  return cat.provincias.find((p) => fold(p.nombre) === key) ?? null;
}

/** Minúsculas + sin acentos + trim, para comparar de forma tolerante. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
