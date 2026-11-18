import { db } from "./db";

/** Statuts qui immobilisent réellement le matériel. */
export const HOLDING_STATUSES = ["OPTION", "CONFIRME"];
/** Marge autour de la prestation (installation, démontage, transport). */
const MARGIN = 8 * 36e5;

export type Availability = {
  id: string; name: string; category: string; stock: number; outOfService: number;
  mine: number; // quantité déjà réservée sur cette prestation
  elsewhere: number; // réservée par d'autres prestations sur le même créneau
  available: number; // ce qu'on peut encore ajouter ici
  conflicts: { dossierId: string; reference: string; title: string; quantity: number }[];
  overbooked: boolean; // la réservation de cette prestation dépasse le stock
};

/** Disponibilité de tout le parc pour le créneau d'une prestation. */
export async function equipmentAvailability(dossierId: string, start: Date | null, end: Date | null): Promise<Availability[]> {
  const [items, mine, others] = await Promise.all([
    db.equipment.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.dossierEquipment.findMany({ where: { dossierId } }),
    start
      ? db.dossierEquipment.findMany({
          where: {
            dossierId: { not: dossierId },
            dossier: { status: { in: HOLDING_STATUSES }, eventStart: { lt: new Date((end ?? start).getTime() + MARGIN) }, eventEnd: { gt: new Date(start.getTime() - MARGIN) } },
          },
          include: { dossier: { select: { id: true, reference: true, title: true } } },
        })
      : [],
  ]);
  return items.map((e) => {
    const m = mine.find((x) => x.equipmentId === e.id)?.quantity ?? 0;
    const conflicts = others.filter((o) => o.equipmentId === e.id).map((o) => ({ dossierId: o.dossier.id, reference: o.dossier.reference, title: o.dossier.title, quantity: o.quantity }));
    const elsewhere = conflicts.reduce((a, c) => a + c.quantity, 0);
    const stock = Math.max(0, e.quantity - e.outOfService); // unités utilisables
    return { id: e.id, name: e.name, category: e.category, stock, outOfService: e.outOfService, mine: m, elsewhere, available: Math.max(0, stock - elsewhere - m), conflicts, overbooked: m > 0 && m + elsewhere > stock };
  });
}
