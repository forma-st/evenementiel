export const eur = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

/** Fuseau de référence : les serveurs (Vercel) tournent en UTC. */
export const TZ = "Europe/Paris";

export const date = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: TZ }).format(new Date(d)) : "—";

export const dateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(new Date(d));

export const time = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(d));

export const longDate = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(d));

/** Composantes d'une date à l'heure de Paris. */
export function parisParts(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, min: +parts.minute, key: `${parts.year}-${parts.month}-${parts.day}` };
}

/** « 2026-11-20 » + « 14:30 » à l'heure de Paris -> Date (UTC). */
export function fromParis(day: string, hm = "00:00") {
  const guess = new Date(`${day}T${hm}:00Z`);
  const p = parisParts(guess);
  const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

/** Cycle de vie d'une prestation. */
export const DOSSIER_STATUSES = [
  { id: "DEMANDE", label: "Demande", color: "bg-slate-100 text-slate-700" },
  { id: "DEVIS_ENVOYE", label: "Devis envoyé", color: "bg-blue-100 text-blue-700" },
  { id: "OPTION", label: "Option posée", color: "bg-amber-100 text-amber-800" },
  { id: "CONFIRME", label: "Confirmée", color: "bg-emerald-100 text-emerald-700" },
  { id: "REALISE", label: "Réalisée", color: "bg-violet-100 text-violet-700" },
  { id: "CLOTURE", label: "Clôturée", color: "bg-zinc-200 text-zinc-700" },
  { id: "PERDU", label: "Perdue", color: "bg-rose-100 text-rose-700" },
] as const;

export const statusOf = (id: string) => DOSSIER_STATUSES.find((s) => s.id === id) ?? DOSSIER_STATUSES[0];
/** Statuts où la date est réservée (bloque l'agenda). */
export const BOOKED_STATUSES = ["CONFIRME", "REALISE", "CLOTURE"];
/** Statuts « en cours de vente ». */
export const OPEN_STATUSES = ["DEMANDE", "DEVIS_ENVOYE", "OPTION"];

export const QUOTE_STATUSES: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  ENVOYE: { label: "Envoyé", color: "bg-blue-100 text-blue-700" },
  ACCEPTE: { label: "Accepté", color: "bg-emerald-100 text-emerald-700" },
  REFUSE: { label: "Refusé", color: "bg-rose-100 text-rose-700" },
  EXPIRE: { label: "Expiré", color: "bg-zinc-200 text-zinc-700" },
};
export const quoteStatus = (s: string) => QUOTE_STATUSES[s] ?? QUOTE_STATUSES.BROUILLON;

export const PRIORITIES: Record<string, string> = { BASSE: "Basse", NORMALE: "Normale", HAUTE: "Haute" };
