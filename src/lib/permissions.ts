import { cache } from "react";
import { notFound } from "next/navigation";
import type { Prisma, User } from "@prisma/client";
import { db } from "./db";

export const ROLES = [
  { id: "ADMIN", label: "Administrateur", help: "Accès total, gère l'équipe, les droits et les paramètres." },
  { id: "MANAGER", label: "Responsable", help: "Équipe admin : suivi commercial de l'équipe, tâches, réglages courants." },
  { id: "MEMBER", label: "Collaborateur", help: "Usage quotidien, limité selon les droits ci-dessous." },
] as const;
export const roleLabel = (r: string) => ROLES.find((x) => x.id === r)?.label ?? (r === "CLIENT" ? "Client" : r);

export type Scope = "all" | "own";

export type Perms = {
  clientsScope: Scope;
  dossiersScope: Scope;
  tasksScope: Scope;
  eventsScope: Scope;
  canDeleteClients: boolean;
  canDeleteDossiers: boolean;
  canViewQuotes: boolean;
  canCreateQuotes: boolean;
  canManageQuestionnaires: boolean;
  canViewTeamDashboard: boolean;
  canAssignOthers: boolean;
  canManageTags: boolean;
  canSendSignatures: boolean;
};

/** Description des droits, pour l'écran Paramètres > Droits. */
export const PERM_DEFS: { key: keyof Perms; label: string; help: string; kind: "scope" | "bool" }[] = [
  { key: "clientsScope", kind: "scope", label: "Clients visibles", help: "« Les siens » = clients dont il est responsable ou sur lesquels il a une prestation." },
  { key: "dossiersScope", kind: "scope", label: "Prestations visibles", help: "« Les siennes » = prestations qui lui sont assignées." },
  { key: "tasksScope", kind: "scope", label: "Tâches visibles", help: "« Les siennes » = tâches qui lui sont assignées ou qu'il a créées." },
  { key: "eventsScope", kind: "scope", label: "Agenda visible", help: "« Les siens » = événements qu'il organise ou auxquels il participe." },
  { key: "canAssignOthers", kind: "bool", label: "Assigner des tâches à d'autres", help: "Sinon il ne peut créer des tâches que pour lui-même." },
  { key: "canViewQuotes", kind: "bool", label: "Voir les devis", help: "" },
  { key: "canCreateQuotes", kind: "bool", label: "Créer des devis", help: "" },
  { key: "canSendSignatures", kind: "bool", label: "Envoyer des documents à signer", help: "Signature électronique des devis, conventions, etc." },
  { key: "canManageQuestionnaires", kind: "bool", label: "Gérer les questionnaires", help: "Créer, modifier et envoyer des questionnaires." },
  { key: "canViewTeamDashboard", kind: "bool", label: "Tableau de bord de l'équipe", help: "Voir les chiffres de toute l'équipe et filtrer par membre." },
  { key: "canDeleteClients", kind: "bool", label: "Supprimer des clients", help: "" },
  { key: "canDeleteDossiers", kind: "bool", label: "Supprimer des prestations", help: "Le journal et les tâches de la prestation sont supprimés ; devis, événements et signatures sont conservés." },
  { key: "canManageTags", kind: "bool", label: "Gérer les étiquettes", help: "Créer, renommer et supprimer les étiquettes." },
];

const ALL: Perms = {
  clientsScope: "all", dossiersScope: "all", tasksScope: "all", eventsScope: "all",
  canDeleteClients: true, canDeleteDossiers: true, canViewQuotes: true, canCreateQuotes: true, canManageQuestionnaires: true,
  canViewTeamDashboard: true, canAssignOthers: true, canManageTags: true, canSendSignatures: true,
};

export const DEFAULT_PERMS: Record<"MANAGER" | "MEMBER", Perms> = {
  MANAGER: { ...ALL },
  MEMBER: {
    clientsScope: "all", dossiersScope: "all", tasksScope: "all", eventsScope: "all",
    canDeleteClients: false, canDeleteDossiers: false, canViewQuotes: true, canCreateQuotes: true, canManageQuestionnaires: true,
    canViewTeamDashboard: false, canAssignOthers: true, canManageTags: false, canSendSignatures: true,
  },
};

/** Droits enregistrés par l'administrateur (lus une fois par requête). */
export const loadRolePerms = cache(async (): Promise<Record<"MANAGER" | "MEMBER", Perms>> => {
  const row = await db.setting.findUnique({ where: { key: "permissions" } });
  const saved = row ? (JSON.parse(row.value) as Partial<Record<"MANAGER" | "MEMBER", Partial<Perms>>>) : {};
  return {
    MANAGER: { ...DEFAULT_PERMS.MANAGER, ...saved.MANAGER },
    MEMBER: { ...DEFAULT_PERMS.MEMBER, ...saved.MEMBER },
  };
});

export async function permsFor(user: Pick<User, "role">): Promise<Perms> {
  if (user.role === "ADMIN") return ALL;
  if (user.role === "MANAGER" || user.role === "MEMBER") return (await loadRolePerms())[user.role];
  // un client n'a aucun droit sur le back-office
  return { ...ALL, clientsScope: "own", dossiersScope: "own", tasksScope: "own", eventsScope: "own",
    canDeleteClients: false, canDeleteDossiers: false, canViewQuotes: false, canCreateQuotes: false, canManageQuestionnaires: false,
    canViewTeamDashboard: false, canAssignOthers: false, canManageTags: false, canSendSignatures: false };
}

/* ---------- Filtres de visibilité ---------- */

export function clientWhere(user: Pick<User, "id">, p: Perms): Prisma.ClientWhereInput {
  return p.clientsScope === "all" ? {} : { OR: [{ ownerId: user.id }, { dossiers: { some: { assigneeId: user.id } } }] };
}
export function dossierWhere(user: Pick<User, "id">, p: Perms): Prisma.DossierWhereInput {
  return p.dossiersScope === "all" ? {} : { assigneeId: user.id };
}
export function taskWhere(user: Pick<User, "id">, p: Perms): Prisma.TaskWhereInput {
  return p.tasksScope === "all" ? {} : { OR: [{ assigneeId: user.id }, { createdById: user.id }] };
}
export function eventWhere(user: Pick<User, "id">, p: Perms): Prisma.EventWhereInput {
  return p.eventsScope === "all" ? {} : { OR: [{ organizerId: user.id }, { attendees: { some: { userId: user.id } } }] };
}

/** Lève une page 404 si l'élément n'est pas visible par l'utilisateur. */
export async function assertClientVisible(user: Pick<User, "id" | "role">, clientId: string) {
  const p = await permsFor(user);
  if (p.clientsScope === "all") return;
  const ok = await db.client.count({ where: { id: clientId, ...clientWhere(user, p) } });
  if (!ok) notFound();
}
export async function assertDossierVisible(user: Pick<User, "id" | "role">, dossierId: string) {
  const p = await permsFor(user);
  if (p.dossiersScope === "all") return;
  const ok = await db.dossier.count({ where: { id: dossierId, ...dossierWhere(user, p) } });
  if (!ok) notFound();
}

export class ForbiddenError extends Error {
  constructor(what: string) {
    super(`Vous n'avez pas le droit de ${what}. Demandez à un administrateur.`);
  }
}

export async function requirePerm(user: Pick<User, "role">, key: keyof Perms, what: string) {
  const p = await permsFor(user);
  if (!p[key]) throw new ForbiddenError(what);
  return p;
}

/** Pour une page : renvoie au tableau de bord si le droit manque. */
export async function pagePerm(user: Pick<User, "role">, key: keyof Perms) {
  const p = await permsFor(user);
  if (!p[key]) {
    const { redirect } = await import("next/navigation");
    redirect("/?acces=refuse");
  }
  return p;
}
