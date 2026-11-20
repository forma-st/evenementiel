import { ensurePlanToken } from "./plan";
import { db } from "./db";
import { getCompany } from "./company";
import { paymentToken } from "./stripe";
import { eur, longDate, time, date as shortDate, TZ, BOOKED_STATUSES } from "./format";
import { eventKind, servicesLabel } from "./presta";
import { depositOf, totals, parseLines } from "./quotes";

/** Variables disponibles dans les contrats, e-mails et automatisations. */
export const MERGE_VARIABLES: [string, string][] = [
  ["client.nom", "Nom du client"],
  ["lien.organisation", "Lien de l'espace organisation (déroulé, musique, options)"],
  ["organisation.date_limite", "Date limite de modification par le client"],
  ["client.email", "E-mail du client"],
  ["client.telephone", "Téléphone du client"],
  ["client.adresse", "Adresse complète du client"],
  ["prestation.titre", "Intitulé de la prestation"],
  ["prestation.reference", "Référence (P2027-0001)"],
  ["prestation.type", "Type d'événement"],
  ["prestation.date", "Date de l'événement (en toutes lettres)"],
  ["prestation.heure_debut", "Heure de début"],
  ["prestation.heure_fin", "Heure de fin"],
  ["prestation.installation", "Heure d'installation"],
  ["prestation.lieu", "Nom du lieu"],
  ["prestation.adresse_lieu", "Adresse du lieu"],
  ["prestation.invites", "Nombre d'invités"],
  ["prestation.services", "Services réservés"],
  ["prestation.contact_lieu", "Contact sur place"],
  ["prestation.jours_restants", "Nombre de jours avant l'événement"],
  ["lien.questionnaire", "Lien du questionnaire envoyé par la même automatisation"],
  ["devis.numero", "Numéro du devis accepté (ou du dernier)"],
  ["devis.total_ht", "Total HT"],
  ["devis.total_ttc", "Total TTC"],
  ["devis.detail", "Détail des lignes du devis"],
  ["acompte", "Montant de l'acompte"],
  ["acompte.pourcentage", "Pourcentage d'acompte"],
  ["solde", "Montant du solde"],
  ["responsable", "Prestataire en charge (DJ, photographe…)"],
  ["societe.nom", "Votre entreprise"],
  ["societe.adresse", "Votre adresse"],
  ["societe.siret", "Votre SIRET"],
  ["societe.telephone", "Votre téléphone"],
  ["societe.email", "Votre e-mail"],
  ["societe.site", "Votre site"],
  ["societe.iban", "Votre IBAN"],
  ["lien.portail", "Lien de l'espace client"],
  ["lien.devis", "Lien de consultation du devis"],
  ["lien.galerie", "Lien de la dernière galerie publiée"],
  ["lien.galerie_code", "Code d'accès de la galerie"],
  ["lien.paiement", "Lien de paiement de la prochaine échéance (carte ou virement)"],
  ["lien.avis", "Lien pour laisser un avis"],
  ["date_du_jour", "Date du jour"],
];

export type MergeVars = Record<string, string>;

/** Remplace {{variable}} (espaces tolérés) ; les variables inconnues restent visibles pour être repérées. */
export function render(tpl: string, vars: MergeVars) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export const baseUrl = () => (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");

/** Calcule toutes les variables d'une prestation (client, devis retenu, société, liens). */
export async function varsForDossier(dossierId: string): Promise<MergeVars> {
  const d = await db.dossier.findUniqueOrThrow({
    where: { id: dossierId },
    include: {
      client: true, assignee: true, musicPlan: { select: { deadlineDays: true } },
      quotes: { orderBy: { createdAt: "desc" } },
      galleries: { where: { status: "PUBLIEE" }, orderBy: { publishedAt: "desc" }, take: 1 },
      payments: { where: { paidAt: null, amount: { gt: 0 } }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], take: 1 },
    },
  });
  const c = await getCompany();
  const q = d.quotes.find((x) => x.status === "ACCEPTE") ?? d.quotes.find((x) => x.status !== "REFUSE") ?? null;
  const lines = q ? parseLines(q.lines) : [];
  const t = q ? totals(lines, q.discount) : null;
  const total = t ? (c.vatExempt ? t.totalHT : t.totalTTC) : d.amount ?? 0;
  const pct = q?.depositPercent ?? d.depositPercent;
  const dep = depositOf(total, pct);
  const g = d.galleries[0];
  const url = baseUrl();
  const days = d.eventStart ? Math.ceil((d.eventStart.getTime() - Date.now()) / 864e5) : null;
  return {
    "client.nom": d.client.name,
    "client.email": d.client.email ?? "",
    "client.telephone": d.client.phone ?? "",
    "client.adresse": [d.client.address, [d.client.postalCode, d.client.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    "prestation.titre": d.title,
    "prestation.reference": d.reference,
    "prestation.type": eventKind(d.eventType).label,
    "prestation.date": d.eventStart ? longDateYear(d.eventStart) : "date à définir",
    "prestation.heure_debut": d.eventStart ? time(d.eventStart) : "",
    "prestation.heure_fin": d.eventEnd ? time(d.eventEnd) : "",
    "prestation.installation": d.setupTime ?? "",
    "prestation.lieu": d.venueName ?? "",
    "prestation.lieu_suffixe": d.venueName ? ` à ${d.venueName}` : d.venueCity ? ` à ${d.venueCity}` : "",
    "prestation.adresse_lieu": [d.venueAddress, d.venueCity].filter(Boolean).join(", "),
    "prestation.invites": d.guests ? String(d.guests) : "",
    "prestation.services": servicesLabel(d.services),
    "prestation.contact_lieu": d.venueContact ?? "",
    "prestation.jours_restants": days != null ? String(days) : "",
    "devis.numero": q?.number ?? "",
    "devis.total_ht": t ? eur(t.totalHT) : eur(d.amount),
    "devis.total_ttc": t ? eur(t.totalTTC) : eur(d.amount),
    "devis.detail": lines.map((l) => `- ${l.label}${l.quantity !== 1 ? ` (x${l.quantity})` : ""} : ${eur(l.quantity * l.unitPrice)} HT`).join("\n"),
    acompte: eur(dep),
    "acompte.pourcentage": `${pct} %`,
    solde: eur(Math.max(0, total - dep)),
    responsable: d.assignee?.name ?? "L’équipe",
    "societe.nom": c.name,
    "societe.adresse": c.address,
    "societe.siret": c.siret,
    "societe.telephone": c.phone,
    "societe.email": c.email,
    "societe.site": c.web,
    "societe.iban": c.iban,
    "lien.portail": `${url}/portail`,
    "lien.organisation": `${url}/e/${await ensurePlanToken(d.id)}`,
    "organisation.date_limite": d.eventStart ? longDateYear(new Date(d.eventStart.getTime() - (d.musicPlan?.deadlineDays ?? 7) * 864e5)) : "",
    "lien.devis": q?.token ? `${url}/d/${q.token}` : `${url}/portail`,
    "lien.galerie": g ? `${url}/g/${g.token}` : "",
    "lien.galerie_code": g?.password ?? "",
    "lien.paiement": d.payments[0] ? `${url}/p/${await paymentToken(d.payments[0].id)}` : `${url}/portail`,
    "lien.avis": c.reviewUrl,
    date_du_jour: shortDate(new Date()),
  };
}

const longDateYear = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);
export { longDate };

/** Prestations confirmées le même jour (pour signaler les conflits de date). */
export async function dateConflicts(day: Date, excludeId?: string) {
  const start = new Date(day.getTime() - 14 * 36e5);
  const end = new Date(day.getTime() + 14 * 36e5);
  return db.dossier.findMany({
    where: { id: excludeId ? { not: excludeId } : undefined, status: { in: [...BOOKED_STATUSES, "OPTION"] }, eventStart: { gte: start, lte: end } },
    select: { id: true, reference: true, title: true, status: true, eventStart: true, assignee: { select: { name: true } }, assigneeId: true },
  });
}
