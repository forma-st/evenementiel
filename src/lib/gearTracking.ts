import { db } from "./db";
import { HOLDING_STATUSES } from "./equipment";
import { parsePrep } from "./prep";
import { parseJson, type Checkin, type Checkout } from "./rental";
import { eventKind, isGearOnly } from "./presta";
import { addDays, startOfDay } from "./tasks";

export type PrepRow = {
  id: string; reference: string; title: string; icon: string; client: string; start: string; end: string;
  units: number; lines: number; done: number; total: number; hasList: boolean; gearOnly: boolean;
};
export type OutRow = {
  id: string; reference: string; title: string; icon: string; client: string; start: string; end: string;
  units: number; summary: string; late: boolean; kind: "LOCATION" | "PRET" | "PRESTATION";
};

/**
 * Suivi du matériel : ce qu'il faut préparer dans les prochains jours, et ce qui est dehors en ce moment
 * (locations et prêts remis mais pas rendus, prestations en cours).
 */
export async function gearTracking(horizonDays = 14) {
  const now = new Date();
  const until = addDays(startOfDay(), horizonDays + 1);
  const ds = await db.dossier.findMany({
    where: {
      status: { in: HOLDING_STATUSES },
      equipment: { some: {} },
      OR: [
        { eventStart: { gte: addDays(startOfDay(), -1), lt: until } },
        { eventStart: { lte: now }, eventEnd: { gte: addDays(now, -60) } },
      ],
    },
    orderBy: { eventStart: "asc" },
    select: {
      id: true, reference: true, title: true, eventType: true, eventStart: true, eventEnd: true, prepList: true, checkout: true, checkin: true,
      client: { select: { name: true } }, equipment: { select: { quantity: true, equipment: { select: { name: true } } } },
    },
  });

  const toPrepare: PrepRow[] = [];
  const out: OutRow[] = [];
  for (const d of ds) {
    if (!d.eventStart) continue;
    const end = d.eventEnd ?? d.eventStart;
    const gearOnly = isGearOnly(d.eventType);
    const checkout = parseJson<Checkout>(d.checkout);
    const checkin = parseJson<Checkin>(d.checkin);
    const units = d.equipment.reduce((a, x) => a + x.quantity, 0);
    const base = {
      id: d.id, reference: d.reference, title: d.title, icon: eventKind(d.eventType).icon, client: d.client.name,
      start: d.eventStart.toISOString(), end: end.toISOString(), units,
    };
    const summary = d.equipment.slice(0, 4).map((x) => `${x.quantity} × ${x.equipment.name}`).join(", ") + (d.equipment.length > 4 ? `, +${d.equipment.length - 4}` : "");

    // dehors : location / prêt remis et pas rendu ; prestation en cours
    if (gearOnly ? checkout && !checkin : d.eventStart <= now && end >= now) {
      out.push({ ...base, summary, late: end < now, kind: gearOnly ? (d.eventType as "LOCATION" | "PRET") : "PRESTATION" });
      continue;
    }
    // à préparer : départ à venir, matériel pas encore sorti
    if (d.eventStart >= addDays(startOfDay(), 0) && d.eventStart < until && !(gearOnly && checkout)) {
      const list = parsePrep(d.prepList);
      toPrepare.push({
        ...base, gearOnly, lines: d.equipment.length, hasList: !!list,
        done: list?.items.filter((i) => i.done).length ?? 0, total: list?.items.length ?? d.equipment.length,
      });
    }
  }
  out.sort((a, b) => Number(b.late) - Number(a.late) || a.end.localeCompare(b.end));

  const repair = await db.equipment.aggregate({ where: { active: true, outOfService: { gt: 0 } }, _sum: { outOfService: true } });
  return {
    toPrepare, out,
    late: out.filter((o) => o.late).length,
    unitsOut: out.reduce((a, o) => a + o.units, 0),
    repair: repair._sum.outOfService ?? 0,
  };
}
