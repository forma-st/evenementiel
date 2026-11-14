import { db } from "./db";
import type { User } from "@prisma/client";
import { clientWhere, dossierWhere, permsFor } from "./permissions";

/** Listes nécessaires au formulaire d'événement, filtrées selon les droits. */
export async function eventFormData(user: User) {
  const p = await permsFor(user);
  const [clients, dossiers, users] = await Promise.all([
    db.client.findMany({ where: clientWhere(user, p), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.dossier.findMany({ where: { ...dossierWhere(user, p), status: { notIn: ["PERDU"] } }, select: { id: true, reference: true, title: true, clientId: true }, orderBy: { createdAt: "desc" } }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { clients, dossiers: dossiers.map((d) => ({ id: d.id, clientId: d.clientId, label: `${d.reference} — ${d.title}` })), users };
}
