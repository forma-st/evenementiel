import { db } from "./db";
import { EQUIPMENT_CATEGORIES } from "./presta";

/** Liste de préparation du matériel d'une prestation (cochée au fur et à mesure). */
export type PrepItem = { id: string; name: string; category: string; qty: number; done: boolean; doneBy?: string | null; doneAt?: string | null };
export type PrepList = { createdAt: string; by: string; items: PrepItem[] };

export function parsePrep(s: string | null): PrepList | null {
  if (!s) return null;
  try { return JSON.parse(s) as PrepList; } catch { return null; }
}

const ORDER = EQUIPMENT_CATEGORIES.map((c) => c.id as string);

/**
 * Crée ou met à jour la liste à partir du matériel réservé : les articles déjà cochés le restent,
 * une quantité modifiée décoche l'article, un article retiré disparaît.
 */
export async function buildPrepList(dossierId: string, by: string) {
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, include: { equipment: { include: { equipment: true } } } });
  const old = parsePrep(d.prepList);
  const items: PrepItem[] = d.equipment
    .map((x) => {
      const prev = old?.items.find((i) => i.id === x.equipmentId);
      const same = prev && prev.qty === x.quantity;
      return { id: x.equipmentId, name: x.equipment.name, category: x.equipment.category, qty: x.quantity, done: !!(same && prev.done), doneBy: same ? prev.doneBy ?? null : null, doneAt: same ? prev.doneAt ?? null : null };
    })
    .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.name.localeCompare(b.name));
  const list: PrepList = { createdAt: old?.createdAt ?? new Date().toISOString(), by: old?.by ?? by, items };
  await db.dossier.update({ where: { id: dossierId }, data: { prepList: JSON.stringify(list) } });
  return list;
}

/** La liste ne correspond plus au matériel réservé (ajout, retrait, quantité). */
export function prepOutdated(list: PrepList | null, reserved: { equipmentId: string; quantity: number }[]) {
  if (!list) return false;
  if (list.items.length !== reserved.length) return true;
  return reserved.some((r) => list.items.find((i) => i.id === r.equipmentId)?.qty !== r.quantity);
}
