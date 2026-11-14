import { db } from "./db";
import { eventKind } from "./presta";
import { BOOKED_STATUSES } from "./format";

/**
 * Tient à jour l'événement d'agenda « Prestation » d'une prestation datée :
 * créé ou mis à jour quand la date existe, supprimé si la prestation est perdue ou sans date.
 * Le responsable et l'équipe déjà inscrite restent participants.
 */
export async function syncPrestationEvent(dossierId: string) {
  const d = await db.dossier.findUnique({ where: { id: dossierId }, include: { client: { select: { name: true } } } });
  if (!d) return;
  const existing = await db.event.findFirst({ where: { dossierId, type: "PRESTATION" } });
  if (!d.eventStart || d.status === "PERDU") {
    if (existing) await db.event.delete({ where: { id: existing.id } });
    return;
  }
  const end = d.eventEnd && d.eventEnd > d.eventStart ? d.eventEnd : new Date(d.eventStart.getTime() + 6 * 36e5);
  const option = !BOOKED_STATUSES.includes(d.status);
  const data = {
    title: `${option ? "[option] " : ""}${eventKind(d.eventType).label} — ${d.client.name}`,
    start: d.eventStart,
    end,
    location: [d.venueName, d.venueAddress, d.venueCity].filter(Boolean).join(", ") || null,
    description: [d.title, d.setupTime ? `Installation : ${d.setupTime}` : "", d.venueContact ? `Contact sur place : ${d.venueContact}` : ""].filter(Boolean).join("\n"),
    clientId: d.clientId,
    dossierId: d.id,
    organizerId: d.assigneeId,
  };
  if (existing) {
    await db.event.update({ where: { id: existing.id }, data });
    if (d.assigneeId) await db.eventAttendee.upsert({ where: { eventId_userId: { eventId: existing.id, userId: d.assigneeId } }, update: {}, create: { eventId: existing.id, userId: d.assigneeId } });
  } else {
    await db.event.create({ data: { ...data, type: "PRESTATION", attendees: d.assigneeId ? { create: [{ userId: d.assigneeId }] } : undefined } });
  }
}
