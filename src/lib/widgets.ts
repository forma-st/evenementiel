import type { Perms } from "./permissions";

export type WidgetSize = "S" | "M" | "L" | "XL";
export type LayoutItem = { id: WidgetId; size: WidgetSize };

export const WIDGETS = {
  gear: { title: "Suivi du matériel", size: "XL", on: true, help: "À préparer, sorti, retours en retard, réparations" },
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

/** Widgets ajoutés après coup : placés en tête des dispositions enregistrées avant leur arrivée. */
const ADDED_V2: WidgetId[] = ["gear"];

/** Nettoie une disposition (widgets inconnus, en double ou non autorisés retirés). */
export function cleanLayout(v: unknown, p: Perms): LayoutItem[] {
  const seen = new Set<string>();
  return (Array.isArray(v) ? (v as LayoutItem[]) : []).filter((x) => x && x.id in WIDGETS && allowed(x.id, p) && !seen.has(x.id) && seen.add(x.id) && ["S", "M", "L", "XL"].includes(x.size));
}

/** Disposition enregistrée : { v: 2, items } ; l'ancien format (tableau seul) reçoit les nouveaux widgets en tête. */
export function readLayout(json: string | null, p: Perms): LayoutItem[] {
  if (!json) return defaultLayout(p);
  try {
    const v = JSON.parse(json) as LayoutItem[] | { v: number; items: LayoutItem[] };
    if (!Array.isArray(v)) return cleanLayout(v.items, p);
    const old = cleanLayout(v, p);
    const add = ADDED_V2.filter((id) => allowed(id, p) && !old.some((x) => x.id === id)).map((id) => ({ id, size: WIDGETS[id].size as WidgetSize }));
    return [...add, ...old];
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
