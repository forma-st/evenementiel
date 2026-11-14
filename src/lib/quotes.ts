/** Lignes de devis et calculs (TVA, remise, acompte). */
export type QuoteLine = {
  label: string;
  description?: string;
  quantity: number;
  unitPrice: number; // HT
  vatRate: number; // 20, 10, 5.5, 2.1 ou 0
  unit?: string;
};

export const UNITS: [string, string][] = [["forfait", "Forfait"], ["piece", "Unité"], ["hour", "Heure"], ["day", "Jour"], ["km", "Km"], ["person", "Personne"]];
export const unitLabel = (u?: string) => UNITS.find(([k]) => k === u)?.[1] ?? u ?? "";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Totaux avec remise HT répartie proportionnellement sur les taux de TVA. */
export function totals(lines: QuoteLine[], discount = 0) {
  const gross = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const ratio = gross > 0 ? Math.max(0, gross - discount) / gross : 1;
  let ht = 0;
  let ttc = 0;
  for (const l of lines) {
    const lineHT = l.quantity * l.unitPrice * ratio;
    ht += lineHT;
    ttc += lineHT * (1 + l.vatRate / 100);
  }
  return { grossHT: r2(gross), totalHT: r2(ht), totalTTC: r2(ttc), vat: r2(ttc - ht) };
}

export const depositOf = (totalTTC: number, percent: number) => r2((totalTTC * percent) / 100);

export function parseLines(json: string): QuoteLine[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
