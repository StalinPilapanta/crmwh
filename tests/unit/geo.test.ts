import { describe, expect, it } from "vitest";
import {
  DEFAULT_COUNTRY,
  getGeoCatalog,
  listCiudades,
  listProvincias,
  normalizeCiudad,
  normalizeProvincia,
  SUPPORTED_COUNTRIES,
} from "@/lib/geo";

/**
 * Catálogo geográfico: listar provincias/ciudades, normalización tolerante a
 * acentos/mayúsculas, ciudad que no pertenece a la provincia → null, y país
 * sin catálogo → degradación segura.
 */

describe("catálogo Ecuador", () => {
  it("tiene las 24 provincias", () => {
    expect(listProvincias("EC")).toHaveLength(24);
  });

  it("Pichincha incluye Quito", () => {
    const ciudades = listCiudades("EC", "Pichincha");
    expect(ciudades).toContain("Quito");
  });

  it("Guayas incluye Guayaquil", () => {
    expect(listCiudades("EC", "Guayas")).toContain("Guayaquil");
  });

  it("país por defecto es EC y está soportado", () => {
    expect(DEFAULT_COUNTRY).toBe("EC");
    expect(SUPPORTED_COUNTRIES.some((c) => c.code === "EC")).toBe(true);
    expect(getGeoCatalog("EC")).not.toBeNull();
  });
});

describe("normalizeProvincia", () => {
  it("normaliza sin acentos y mayúsculas", () => {
    expect(normalizeProvincia("EC", "pichincha")).toBe("Pichincha");
    expect(normalizeProvincia("EC", "BOLIVAR")).toBe("Bolívar");
    expect(normalizeProvincia("EC", "  guayas  ")).toBe("Guayas");
  });

  it("provincia inexistente → null", () => {
    expect(normalizeProvincia("EC", "Madrid")).toBeNull();
  });
});

describe("normalizeCiudad", () => {
  it("normaliza dentro de la provincia", () => {
    expect(normalizeCiudad("EC", "Pichincha", "quito")).toBe("Quito");
    expect(normalizeCiudad("EC", "Guayas", "GUAYAQUIL")).toBe("Guayaquil");
  });

  it("ciudad que no pertenece a la provincia → null", () => {
    // Guayaquil es de Guayas, no de Pichincha.
    expect(normalizeCiudad("EC", "Pichincha", "Guayaquil")).toBeNull();
  });

  it("ciudad inexistente → null", () => {
    expect(normalizeCiudad("EC", "Pichincha", "Narnia")).toBeNull();
  });
});

describe("país sin catálogo (degradación)", () => {
  it("getGeoCatalog → null", () => {
    expect(getGeoCatalog("XX")).toBeNull();
  });
  it("listar → vacío", () => {
    expect(listProvincias("XX")).toEqual([]);
    expect(listCiudades("XX", "lo que sea")).toEqual([]);
  });
  it("normalizar → null", () => {
    expect(normalizeProvincia("XX", "algo")).toBeNull();
    expect(normalizeCiudad("XX", "algo", "otra")).toBeNull();
  });
});
