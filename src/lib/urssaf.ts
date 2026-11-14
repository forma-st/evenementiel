import { cache } from "react";
import { db } from "./db";
import { fromParis, parisParts } from "./format";

/**
 * Micro-entreprise (auto-entrepreneur, EI) : chiffre d'affaires encaissé, cotisations, seuils.
 * Taux et plafonds 2026 par défaut — modifiables dans Paramètres › Comptabilité.
 * À vérifier chaque année sur autoentrepreneur.urssaf.fr.
 */
export const ACTIVITIES = {
  BIC_SERVICES: { label: "Prestations de services commerciales (BIC) — ex. DJ, animation, location de sono", rate: 21.2, cfp: 0.1, vl: 1.7, ceiling: 83_600, vatThreshold: 37_500, vatMajor: 41_250, box: "5KP", boxVL: "5TB", abatement: 50 },
  BIC_ARTISAN: { label: "Prestations de services artisanales (BIC) — ex. photographe inscrit au répertoire des métiers", rate: 21.2, cfp: 0.3, vl: 1.7, ceiling: 83_600, vatThreshold: 37_500, vatMajor: 41_250, box: "5KP", boxVL: "5TB", abatement: 50 },
  BNC: { label: "Profession libérale non réglementée (BNC, SSI)", rate: 25.6, cfp: 0.2, vl: 2.2, ceiling: 83_600, vatThreshold: 37_500, vatMajor: 41_250, box: "5HQ", boxVL: "5TE", abatement: 34 },
  BNC_CIPAV: { label: "Profession libérale réglementée (BNC, CIPAV)", rate: 23.2, cfp: 0.2, vl: 2.2, ceiling: 83_600, vatThreshold: 37_500, vatMajor: 41_250, box: "5HQ", boxVL: "5TE", abatement: 34 },
  VENTE: { label: "Vente de marchandises (BIC)", rate: 12.3, cfp: 0.1, vl: 1.0, ceiling: 203_100, vatThreshold: 85_000, vatMajor: 93_500, box: "5KO", boxVL: "5TA", abatement: 71 },
} as const;
export type ActivityId = keyof typeof ACTIVITIES;

export type UrssafSettings = {
  activity: ActivityId;
  frequency: "MENSUELLE" | "TRIMESTRIELLE";
  versementLiberatoire: boolean;
  acreUntil: string; // AAAA-MM-JJ, vide si pas d'ACRE
  acreFactor: number; // part des cotisations dues pendant l'ACRE (0,5 avant juillet 2026, 0,75 après)
  rate: number | null; // taux personnalisé (null = taux par défaut de l'activité)
  cfp: number | null;
  vl: number | null;
  creationDate: string;
};

export const DEFAULT_URSSAF: UrssafSettings = { activity: "BIC_SERVICES", frequency: "TRIMESTRIELLE", versementLiberatoire: false, acreUntil: "", acreFactor: 0.75, rate: null, cfp: null, vl: null, creationDate: "" };

export const getUrssaf = cache(async (): Promise<UrssafSettings> => {
  const row = await db.setting.findUnique({ where: { key: "urssaf" } });
  return { ...DEFAULT_URSSAF, ...(row ? (JSON.parse(row.value) as Partial<UrssafSettings>) : {}) };
});

export function ratesOf(s: UrssafSettings) {
  const a = ACTIVITIES[s.activity] ?? ACTIVITIES.BIC_SERVICES;
  return { ...a, rate: s.rate ?? a.rate, cfp: s.cfp ?? a.cfp, vl: s.versementLiberatoire ? s.vl ?? a.vl : 0 };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cotisations dues sur un chiffre d'affaires encaissé (ACRE si la période se termine avant la fin de l'ACRE). */
export function contributionsFor(turnover: number, s: UrssafSettings, periodEnd: Date) {
  const r = ratesOf(s);
  const acre = !!s.acreUntil && periodEnd <= fromParis(s.acreUntil, "23:59");
  const social = r2((turnover * r.rate * (acre ? s.acreFactor : 1)) / 100);
  const cfp = r2((turnover * r.cfp) / 100);
  const incomeTax = r2((turnover * r.vl) / 100);
  return { social, cfp, incomeTax, total: r2(social + cfp + incomeTax), acre };
}

/* ---------- Périodes ---------- */

export type Period = { id: string; label: string; start: Date; end: Date; deadline: Date };
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const pad = (n: number) => String(n).padStart(2, "0");
const monthStart = (y: number, m: number) => fromParis(`${y + Math.floor((m - 1) / 12)}-${pad(((m - 1) % 12) + 1)}-01`);
const lastDay = (y: number, m: number) => new Date(monthStart(y, m + 1).getTime() - 12 * 36e5);

export function periodOf(id: string): Period {
  const [ys, ps] = id.split("-");
  const y = Number(ys);
  if (ps.startsWith("T")) {
    const q = Number(ps.slice(1));
    const m = (q - 1) * 3 + 1;
    return { id, label: `${q}${q === 1 ? "er" : "e"} trimestre ${y}`, start: monthStart(y, m), end: monthStart(y, m + 3), deadline: lastDay(y, m + 3) };
  }
  const m = Number(ps);
  return { id, label: `${MONTHS[m - 1]} ${y}`, start: monthStart(y, m), end: monthStart(y, m + 1), deadline: lastDay(y, m + 1) };
}

/** Périodes de l'année (jusqu'à la période en cours). */
export function periodsOfYear(year: number, freq: UrssafSettings["frequency"], creationDate = "") {
  const ids = freq === "MENSUELLE" ? Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`) : [1, 2, 3, 4].map((q) => `${year}-T${q}`);
  const created = creationDate ? fromParis(creationDate) : null;
  return ids.map(periodOf).filter((p) => p.start <= new Date() && (!created || p.end > created));
}

export function currentPeriodId(freq: UrssafSettings["frequency"], d = new Date()) {
  const p = parisParts(d);
  return freq === "MENSUELLE" ? `${p.y}-${pad(p.m)}` : `${p.y}-T${Math.ceil(p.m / 3)}`;
}

/** Chiffre d'affaires encaissé (paiements reçus) entre deux dates. Les avoirs remboursés sont saisis en paiements négatifs. */
export async function turnoverBetween(start: Date, end: Date) {
  const a = await db.payment.aggregate({ where: { paidAt: { gte: start, lt: end } }, _sum: { amount: true } });
  return r2(a._sum.amount ?? 0);
}

/** Plafond proratisé l'année de création (au prorata des jours d'activité). */
export function ceilingFor(s: UrssafSettings, year: number) {
  const r = ratesOf(s);
  if (!s.creationDate || !s.creationDate.startsWith(String(year))) return { ceiling: r.ceiling, vat: r.vatThreshold, vatMajor: r.vatMajor, prorata: 1 };
  const start = fromParis(s.creationDate);
  const end = fromParis(`${year + 1}-01-01`);
  const total = (fromParis(`${year + 1}-01-01`).getTime() - fromParis(`${year}-01-01`).getTime()) / 864e5;
  const prorata = Math.max(0, (end.getTime() - start.getTime()) / 864e5) / total;
  return { ceiling: Math.round(r.ceiling * prorata), vat: r.vatThreshold, vatMajor: r.vatMajor, prorata };
}

export const URSSAF_URL = "https://autoentrepreneur.urssaf.fr";
