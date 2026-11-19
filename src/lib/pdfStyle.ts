import { cache } from "react";
import { rgb } from "pdf-lib";
import { db } from "./db";

export * from "./pdfStyleDefs";
import { DEFAULT_STYLE, normalizeStyle, type PdfStyle } from "./pdfStyleDefs";

export const getPdfStyle = cache(async (): Promise<PdfStyle> => {
  const row = await db.setting.findUnique({ where: { key: "pdfStyle" } });
  return normalizeStyle(row ? (JSON.parse(row.value) as Partial<PdfStyle>) : null);
});

/** Style à utiliser pour les factures et contrats (celui des devis, ou le style par défaut). */
export async function documentStyle() {
  const s = await getPdfStyle();
  return s.applyToInvoices ? s : DEFAULT_STYLE;
}

export function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
/** Teinte très claire de la couleur (fonds de blocs). */
export function tint(hex: string, t = 0.92) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => (x + (255 - x) * t) / 255);
  return rgb(c[0], c[1], c[2]);
}
