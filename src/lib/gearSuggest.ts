import { db } from "./db";
import { equipmentAvailability } from "./equipment";
import { parseServices } from "./presta";
import { parseLines } from "./quotes";

export type Suggestion = { id: string; name: string; brand: string | null; category: string; qty: number; wanted: number; available: number; current: number; why: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Matériel proposé pour une prestation : d'après les prestations cochées (DJ, sono, lumière…), le type d'événement,
 * le nombre d'invités et les lignes du devis (options : fumée, photobooth…). Quantités plafonnées au stock libre.
 */
export async function suggestGear(dossierId: string): Promise<Suggestion[]> {
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, select: { eventType: true, services: true, guests: true, eventStart: true, eventEnd: true, quotes: { where: { status: { not: "REFUSE" } }, select: { lines: true } } } });
  const services = parseServices(d.services);
  const text = norm(d.quotes.flatMap((q) => parseLines(q.lines).map((l) => `${l.label} ${l.description ?? ""}`)).join(" | "));
  const guests = d.guests ?? 0;
  const [items, av] = await Promise.all([
    db.equipment.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    equipmentAvailability(dossierId, d.eventStart, d.eventEnd),
  ]);
  const out: Suggestion[] = [];
  for (const e of items) {
    const sv = e.autoServices.split(",").filter(Boolean);
    const types = e.autoTypes.split(",").filter(Boolean);
    if (types.length && !types.includes(d.eventType)) continue;
    const bySv = sv.filter((s) => services.includes(s));
    const kws = e.autoKeywords.split(",").map((k) => norm(k.trim())).filter(Boolean);
    const byKw = kws.filter((k) => text.includes(k));
    if (!bySv.length && !byKw.length) continue;
    let wanted = Math.max(e.autoBase, byKw.length && !bySv.length ? 1 : 0);
    if (e.autoPerGuests && guests) wanted += Math.floor(guests / e.autoPerGuests);
    if (e.autoMax != null) wanted = Math.min(wanted, e.autoMax);
    if (wanted <= 0) continue;
    const a = av.find((x) => x.id === e.id);
    const available = a ? Math.max(0, a.stock - a.elsewhere) : 0;
    const why = [bySv.length ? `prestation ${bySv.join(" + ").toLowerCase()}` : "", byKw.length ? `devis : « ${byKw[0]} »` : "", e.autoPerGuests && guests ? `${guests} invités` : ""].filter(Boolean).join(", ");
    out.push({ id: e.id, name: e.name, brand: e.brand, category: e.category, wanted, qty: Math.min(wanted, available), available, current: a?.mine ?? 0, why });
  }
  return out;
}
