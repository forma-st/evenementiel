/**
 * Définitions des automatisations utilisables côté navigateur (éditeur de règles) :
 * aucun accès à la base ni au serveur ici.
 */
import type { AutomationRule } from "@prisma/client";
import { statusOf } from "./format";

/* ---------- Déclencheurs ---------- */

export type Trigger = "STATUS" | "EVENT_OFFSET" | "QUOTE_NO_REPLY" | "PAYMENT_LATE" | "GALLERY_PUBLISHED" | "CONTRACT_SIGNED" | "QUOTE_ACCEPTED" | "PAYMENT_RECEIVED";

export const TRIGGERS: { id: Trigger; label: string; help: string; scheduled: boolean }[] = [
  { id: "STATUS", label: "La prestation passe à un statut", help: "Immédiat, à chaque changement de statut (et à la création).", scheduled: false },
  { id: "EVENT_OFFSET", label: "Avant / après la date de l'événement", help: "Vérifié chaque jour : J-30, J-7, J+2…", scheduled: true },
  { id: "QUOTE_NO_REPLY", label: "Devis envoyé sans réponse", help: "Vérifié chaque jour : X jours après l'envoi, si le devis n'est ni accepté ni refusé.", scheduled: true },
  { id: "QUOTE_ACCEPTED", label: "Devis accepté par le client", help: "Immédiat, quand le client accepte le devis en ligne ou le signe.", scheduled: false },
  { id: "CONTRACT_SIGNED", label: "Contrat signé", help: "Immédiat, quand toutes les signatures d'un contrat sont recueillies.", scheduled: false },
  { id: "PAYMENT_RECEIVED", label: "Paiement reçu en ligne", help: "Immédiat, quand le client règle une échéance par carte.", scheduled: false },
  { id: "PAYMENT_LATE", label: "Paiement en retard", help: "Vérifié chaque jour : X jours après l'échéance d'un paiement non reçu.", scheduled: true },
  { id: "GALLERY_PUBLISHED", label: "Galerie / transfert publié", help: "Immédiat, quand vous publiez une galerie liée à la prestation.", scheduled: false },
];
export const triggerOf = (id: string) => TRIGGERS.find((t) => t.id === id) ?? TRIGGERS[0];

/* ---------- Actions ---------- */

/** Destinataire interne : responsable de la prestation, responsable commercial du client, tous les responsables/admins, ou un membre précis. */
export type Target = "DOSSIER_ASSIGNEE" | "CLIENT_OWNER" | "ACTOR" | "MANAGERS" | `user:${string}`;

export type AutomationAction =
  | { kind: "SEND_EMAIL"; templateId: string }
  | { kind: "CREATE_TASK"; title: string; type: string; priority: string; dueInDays: number; assignTo: Target; description?: string }
  | { kind: "NOTIFY"; to: Target; message: string }
  | { kind: "SEND_QUESTIONNAIRE"; questionnaireId: string }
  | { kind: "SET_STATUS"; status: string }
  | { kind: "CREATE_PAYMENTS"; balanceDaysBefore: number }
  | { kind: "POST_CHANNEL"; message: string };

export const ACTION_KINDS = [
  { id: "SEND_EMAIL", label: "Envoyer un e-mail au client" },
  { id: "CREATE_TASK", label: "Créer une tâche" },
  { id: "NOTIFY", label: "Notifier l'équipe" },
  { id: "SEND_QUESTIONNAIRE", label: "Envoyer un questionnaire au client" },
  { id: "SET_STATUS", label: "Changer le statut de la prestation" },
  { id: "CREATE_PAYMENTS", label: "Créer l'échéancier acompte + solde" },
  { id: "POST_CHANNEL", label: "Publier dans le canal Général" },
] as const;

export const TARGETS: { id: Target; label: string }[] = [
  { id: "DOSSIER_ASSIGNEE", label: "Responsable de la prestation" },
  { id: "CLIENT_OWNER", label: "Responsable commercial du client" },
  { id: "ACTOR", label: "Personne à l'origine de l'action" },
  { id: "MANAGERS", label: "Administrateurs et responsables" },
];

export function parseActions(json: string): AutomationAction[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function describeTrigger(r: Pick<AutomationRule, "trigger" | "toStatus" | "offsetDays">) {
  switch (r.trigger) {
    case "STATUS": return `Statut → ${statusOf(r.toStatus).label}`;
    case "EVENT_OFFSET": return r.offsetDays === 0 ? "Le jour J" : r.offsetDays < 0 ? `J${r.offsetDays} (avant l'événement)` : `J+${r.offsetDays} (après l'événement)`;
    case "QUOTE_NO_REPLY": return `Devis sans réponse depuis ${r.offsetDays} j`;
    case "PAYMENT_LATE": return `Paiement en retard de ${r.offsetDays} j`;
    default: return triggerOf(r.trigger).label;
  }
}

export function describeAction(
  a: AutomationAction,
  ctx: { questionnaires?: { id: string; title: string }[]; users?: { id: string; name: string }[]; templates?: { id: string; name: string }[] } = {},
) {
  const who = (t: Target) => (t.startsWith("user:") ? ctx.users?.find((u) => `user:${u.id}` === t)?.name ?? "un membre" : TARGETS.find((x) => x.id === t)?.label.toLowerCase() ?? t);
  switch (a.kind) {
    case "SEND_EMAIL": return `E-mail au client : « ${ctx.templates?.find((t) => t.id === a.templateId)?.name ?? "modèle supprimé"} »`;
    case "CREATE_TASK": return `Tâche « ${a.title} » pour ${who(a.assignTo)}, échéance J+${a.dueInDays}`;
    case "NOTIFY": return `Notifier ${who(a.to)} : « ${a.message} »`;
    case "SEND_QUESTIONNAIRE": return `Questionnaire « ${ctx.questionnaires?.find((q) => q.id === a.questionnaireId)?.title ?? "?"} » dans l'espace client`;
    case "SET_STATUS": return `Passer la prestation à « ${statusOf(a.status).label} »`;
    case "CREATE_PAYMENTS": return `Échéancier : acompte à la réservation, solde ${a.balanceDaysBefore} j avant`;
    case "POST_CHANNEL": return `Message dans #Général : « ${a.message} »`;
  }
}

