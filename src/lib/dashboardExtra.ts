import { db } from "./db";
import { fromParis, parisParts } from "./format";
import { isGearOnly } from "./presta";
import type { CalItem } from "@/components/MiniCalendar";

const ACTIVE = ["DEMANDE", "DEVIS_ENVOYE", "OPTION", "CONFIRME"];

/** Fins de période (heure de Paris) : semaine, mois, trimestre, année en cours. */
function periodEnds(now = new Date()) {
  const [y, m, d] = parisParts(now).key.split("-").map(Number);
  const day = (yy: number, mm: number, dd: number) => { const x = new Date(Date.UTC(yy, mm - 1, dd)); return fromParis(x.toISOString().slice(0, 10)); };
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return { week: day(y, m, d + 7 - dow), month: day(y, m + 1, 1), quarter: day(y, Math.floor((m - 1) / 3) * 3 + 4, 1), year: day(y + 1, 1, 1) };
}

export async function highlightData(memberId: string | null) {
  const now = new Date();
  const ends = periodEnds(now);
  const scope = memberId ? { assigneeId: memberId } : {};
  const ds = await db.dossier.findMany({ where: { ...scope, status: { in: ACTIVE }, eventStart: { gte: now, lt: ends.year } }, select: { eventType: true, eventStart: true } });
  const count = (gear: boolean) => {
    const l = ds.filter((x) => isGearOnly(x.eventType) === gear);
    return { week: l.filter((x) => x.eventStart! < ends.week).length, month: l.filter((x) => x.eventStart! < ends.month).length, quarter: l.filter((x) => x.eventStart! < ends.quarter).length, year: l.length };
  };
  const [dossiers, clients] = await Promise.all([
    db.dossier.count({ where: { ...scope, status: { in: ACTIVE } } }),
    db.client.count(),
  ]);
  return { events: count(false), rentals: count(true), totals: { dossiers, clients } };
}

/** Éléments du calendrier, du mois dernier à dans 6 mois. */
export async function calendarItems(memberId: string | null, userId: string): Promise<CalItem[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 40 * 864e5), to = new Date(now.getTime() + 190 * 864e5);
  const [ds, evs] = await Promise.all([
    db.dossier.findMany({ where: { ...(memberId ? { assigneeId: memberId } : {}), status: { in: ACTIVE }, eventStart: { gte: from, lt: to } }, select: { id: true, title: true, status: true, eventType: true, eventStart: true, eventEnd: true }, take: 400 }),
    db.event.findMany({ where: { type: { not: "PRESTATION" }, start: { gte: from, lt: to }, attendees: { some: { userId: memberId ?? userId } } }, select: { id: true, title: true, start: true, end: true }, take: 300 }),
  ]);
  const k = (d: Date) => parisParts(d).key;
  return [
    ...ds.map((d) => ({ id: d.id, title: d.title, day: k(d.eventStart!), endDay: k(new Date(Math.max(d.eventStart!.getTime(), (d.eventEnd ?? d.eventStart!).getTime() - 6 * 36e5))), href: `/prestations/${d.id}`, tone: (isGearOnly(d.eventType) ? "gear" : d.status === "CONFIRME" ? "presta" : "option") as CalItem["tone"] })),
    ...evs.map((e) => ({ id: e.id, title: e.title, day: k(e.start), endDay: k(e.end), href: `/agenda/${e.id}`, tone: "rdv" as const })),
  ];
}
