import { fromParis, parisParts } from "./format";
export const TASK_STATUSES = [
  { id: "A_FAIRE", label: "À faire", cell: "bg-slate-400", dot: "bg-slate-400", soft: "bg-slate-100 text-slate-700" },
  { id: "EN_COURS", label: "En cours", cell: "bg-amber-500", dot: "bg-amber-500", soft: "bg-amber-100 text-amber-800" },
  { id: "BLOQUE", label: "Bloqué", cell: "bg-brand-600", dot: "bg-brand-600", soft: "bg-brand-100 text-brand-700" },
  { id: "FAIT", label: "Fait", cell: "bg-emerald-500", dot: "bg-emerald-500", soft: "bg-emerald-100 text-emerald-700" },
] as const;

export const TASK_PRIORITIES = [
  { id: "BASSE", label: "Basse", cell: "bg-sky-300" },
  { id: "NORMALE", label: "Normale", cell: "bg-link-500" },
  { id: "HAUTE", label: "Haute", cell: "bg-orange-500" },
  { id: "URGENTE", label: "Urgente", cell: "bg-brand-700" },
] as const;

export const TASK_TYPES = [
  { id: "TACHE", label: "Tâche", icon: "✓" },
  { id: "APPEL", label: "Appel", icon: "☎" },
  { id: "EMAIL", label: "E-mail", icon: "✉" },
  { id: "RDV", label: "Rendez-vous", icon: "◷" },
  { id: "RELANCE", label: "Relance", icon: "↻" },
] as const;

export const taskStatus = (id: string) => TASK_STATUSES.find((s) => s.id === id) ?? TASK_STATUSES[0];
export const taskPriority = (id: string) => TASK_PRIORITIES.find((s) => s.id === id) ?? TASK_PRIORITIES[1];
export const taskType = (id: string) => TASK_TYPES.find((s) => s.id === id) ?? TASK_TYPES[0];

/** Minuit (heure de Paris) du jour donné. */
export const startOfDay = (d = new Date()) => fromParis(parisParts(d).key, "00:00");
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);

export function isOverdue(t: { dueDate: Date | string | null; status: string }) {
  return !!t.dueDate && t.status !== "FAIT" && new Date(t.dueDate) < startOfDay();
}

/** Tâche telle que transmise aux composants client (dates en texte). */
export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null; // AAAA-MM-JJ
  assigneeId: string | null;
  clientId: string | null;
  clientName: string | null;
  dossierId: string | null;
  dossierRef: string | null;
};

export function toRow(t: {
  id: string; title: string; description: string | null; type: string; status: string; priority: string;
  dueDate: Date | null; assigneeId: string | null; clientId: string | null; dossierId: string | null;
  client?: { name: string } | null; dossier?: { reference: string; title: string } | null;
}): TaskRow {
  return {
    id: t.id, title: t.title, description: t.description, type: t.type, status: t.status, priority: t.priority,
    dueDate: t.dueDate ? localDate(t.dueDate) : null,
    assigneeId: t.assigneeId, clientId: t.clientId, clientName: t.client?.name ?? null,
    dossierId: t.dossierId, dossierRef: t.dossier ? `${t.dossier.reference} · ${t.dossier.title}` : null,
  };
}

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Date AAAA-MM-JJ -> Date à midi (évite les décalages de fuseau). */
export const parseDay = (s: string | null | undefined) => (s ? new Date(`${s}T12:00:00`) : null);
