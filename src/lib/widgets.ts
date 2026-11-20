import type { Perms } from "./permissions";

export type WidgetSize = "S" | "M" | "L" | "XL";
export type LayoutItem = { id: WidgetId; size: WidgetSize };

export const WIDGETS = {
  highlights: { title: "En un coup d'œil", size: "XL", on: true, help: "Prestations et locations à venir, création rapide" },
  gear: { title: "Suivi du matériel", size: "XL", on: true, help: "À préparer, sorti, retours en retard, réparations" },
  calendar: { title: "Calendrier", size: "L", on: true, help: "Le mois en cours : prestations, options, locations, rendez-vous" },
  upcoming: { title: "Prochaines prestations", size: "L", on: true, help: "60 prochains jours" },
  payments: { title: "Encaissements à suivre", size: "S", on: true, help: "Échéances en retard et à venir" },
  kpis: { title: "Chiffres clés", size: "XL", on: true, help: "CA signé, devis, transformation, clients, tâches, RDV" },
  revenue: { title: "Chiffre d'affaires — 12 derniers mois", size: "L", on: true, help: "Devis émis et acceptés par mois" },
  pipeline: { title: "Pipeline des prestations", size: "S", on: true, help: "Prestations par statut" },
  team: { title: "Équipe", size: "XL", on: true, help: "Chiffres par membre", perm: "canViewTeamDashboard" },
  tasksChart: { title: "Activité — tâches par semaine", size: "M", on: true, help: "Tâches créées et terminées" },
  events: { title: "Mes prochains rendez-vous", size: "M", on: true, help: "14 prochains jours" },
  myTasks: { title: "Mes tâches urgentes", size: "M", on: true, help: "En retard et 7 prochains jours" },
  activity: { title: "Activité récente", size: "M", on: true, help: "Journal des prestations" },
  signatures: { title: "Signatures en attente", size: "M", on: false, help: "Documents envoyés non signés", perm: "canSendSignatures" },
  questionnaires: { title: "Derniers questionnaires reçus", size: "M", on: false, help: "Réponses des clients", perm: "canManageQuestionnaires" },
  messages: { title: "Derniers messages", size: "M", on: false, help: "Conversations récentes" },
} as const satisfies Record<string, { title: string; size: WidgetSize; on: boolean; help: string; perm?: keyof Perms }>;

export type WidgetId = keyof typeof WIDGETS;
export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];

export const allowed = (id: WidgetId, p: Perms) => {
  const w = WIDGETS[id] as { perm?: keyof Perms };
  return !w.perm || !!p[w.perm];
};

export const defaultLayout = (p: Perms): LayoutItem[] =>
  WIDGET_IDS.filter((id) => WIDGETS[id].on && allowed(id, p)).map((id) => ({ id, size: WIDGETS[id].size }));

/** Widgets ajoutés après coup, par version de disposition : insérés dans les dispositions enregistrées avant leur arrivée. */
const ADDED: { v: number; id: WidgetId; at: "start" | "afterGear" }[] = [
  { v: 2, id: "gear", at: "start" },
  { v: 3, id: "highlights", at: "start" },
  { v: 3, id: "calendar", at: "afterGear" },
];
export const LAYOUT_VERSION = 3;

/** Nettoie une disposition (widgets inconnus, en double ou non autorisés retirés). */
export function cleanLayout(v: unknown, p: Perms): LayoutItem[] {
  const seen = new Set<string>();
  return (Array.isArray(v) ? (v as LayoutItem[]) : []).filter((x) => x && x.id in WIDGETS && allowed(x.id, p) && !seen.has(x.id) && seen.add(x.id) && ["S", "M", "L", "XL"].includes(x.size));
}

/** Disposition enregistrée : { v, items } ; un tableau seul = version 1. Les nouveaux widgets sont ajoutés une fois. */
export function readLayout(json: string | null, p: Perms): LayoutItem[] {
  if (!json) return defaultLayout(p);
  try {
    const raw = JSON.parse(json) as LayoutItem[] | { v: number; items: LayoutItem[] };
    const ver = Array.isArray(raw) ? 1 : raw.v ?? 2;
    const out = cleanLayout(Array.isArray(raw) ? raw : raw.items, p);
    for (const a of ADDED) {
      if (a.v <= ver || !allowed(a.id, p) || out.some((x) => x.id === a.id)) continue;
      const item = { id: a.id, size: WIDGETS[a.id].size as WidgetSize };
      if (a.at === "start") out.unshift(item);
      else { const g = out.findIndex((x) => x.id === "gear"); out.splice(g >= 0 ? g + 1 : 0, 0, item); }
    }
    // l'ordre voulu en tête : coup d'œil, puis suivi du matériel
    const h = out.findIndex((x) => x.id === "highlights"), g = out.findIndex((x) => x.id === "gear");
    if (ver < 3 && h > g && g >= 0) { const [x] = out.splice(h, 1); out.splice(g, 0, x); }
    return out;
  } catch {
    return defaultLayout(p);
  }
}

/** Largeur dans une grille de 12 colonnes (grand écran) ; pleine largeur sur mobile. */
export const SPAN: Record<WidgetSize, string> = {
  S: "md:col-span-6 xl:col-span-4",
  M: "md:col-span-6 xl:col-span-6",
  L: "md:col-span-12 xl:col-span-8",
  XL: "md:col-span-12 xl:col-span-12",
};
export const SIZE_LABEL: Record<WidgetSize, string> = { S: "⅓", M: "½", L: "⅔", XL: "Pleine largeur" };
