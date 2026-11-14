import { db } from "./db";

export async function galleryFormData() {
  const [clients, dossiers] = await Promise.all([
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.dossier.findMany({ where: { status: { not: "PERDU" } }, select: { id: true, reference: true, title: true, clientId: true }, orderBy: { eventStart: "desc" } }),
  ]);
  return { clients, dossiers: dossiers.map((d) => ({ id: d.id, clientId: d.clientId, label: `${d.reference} — ${d.title}` })) };
}
