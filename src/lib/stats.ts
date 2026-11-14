import type { Prisma, User } from "@prisma/client";
import { db } from "./db";
import { fromParis, parisParts } from "./format";
import { startOfDay } from "./tasks";
import { DOSSIER_STATUSES } from "./format";

export const PERIODS = [
  { id: "30j", label: "30 derniers jours" },
  { id: "trimestre", label: "3 derniers mois" },
  { id: "annee", label: "Année en cours" },
  { id: "12m", label: "12 derniers mois" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** 1er jour (heure de Paris) du mois situé `back` mois avant le mois courant. */
function monthStart(back: number) {
  const t = parisParts(new Date());
  const idx = t.y * 12 + (t.m - 1) - back;
  return fromParis(`${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}-01`);
}

export function periodRange(id: PeriodId) {
  const end = new Date();
  const start =
    id === "30j" ? new Date(startOfDay().getTime() - 29 * 864e5)
    : id === "trimestre" ? monthStart(2)
    : id === "annee" ? fromParis(`${parisParts(end).y}-01-01`)
    : monthStart(11);
  const length = end.getTime() - start.getTime();
  return { start, end, prevStart: new Date(start.getTime() - length), prevEnd: start };
}

/** Filtres « par membre » appliqués à chaque objet. */
function memberFilters(memberId: string | null) {
  return {
    quote: (memberId ? { OR: [{ client: { ownerId: memberId } }, { dossier: { assigneeId: memberId } }] } : {}) as Prisma.QuoteWhereInput,
    dossier: (memberId ? { assigneeId: memberId } : {}) as Prisma.DossierWhereInput,
    client: (memberId ? { ownerId: memberId } : {}) as Prisma.ClientWhereInput,
    task: (memberId ? { assigneeId: memberId } : {}) as Prisma.TaskWhereInput,
    event: (memberId ? { attendees: { some: { userId: memberId } } } : {}) as Prisma.EventWhereInput,
  };
}

const SENT = ["ENVOYE", "ACCEPTE", "REFUSE", "EXPIRE"];

export async function dashboardStats(memberId: string | null, period: PeriodId) {
  const f = memberFilters(memberId);
  const { start, end, prevStart, prevEnd } = periodRange(period);
  const today = startOfDay();
  const inRange = (a: Date, b: Date) => ({ gte: a, lt: b });

  const [sent, accepted, prevAccepted, newClients, prevNewClients, doneTasks, lateTasks, upcomingEvents, pipeline] = await Promise.all([
    db.quote.aggregate({ where: { ...f.quote, status: { in: SENT }, issuedAt: inRange(start, end) }, _sum: { totalHT: true }, _count: true }),
    db.quote.aggregate({ where: { ...f.quote, status: "ACCEPTE", issuedAt: inRange(start, end) }, _sum: { totalHT: true }, _count: true }),
    db.quote.aggregate({ where: { ...f.quote, status: "ACCEPTE", issuedAt: inRange(prevStart, prevEnd) }, _sum: { totalHT: true } }),
    db.client.count({ where: { ...f.client, createdAt: inRange(start, end) } }),
    db.client.count({ where: { ...f.client, createdAt: inRange(prevStart, prevEnd) } }),
    db.task.count({ where: { ...f.task, status: "FAIT", completedAt: inRange(start, end) } }),
    db.task.count({ where: { ...f.task, status: { not: "FAIT" }, dueDate: { lt: today } } }),
    db.event.count({ where: { ...f.event, start: { gte: new Date(), lt: new Date(Date.now() + 7 * 864e5) } } }),
    db.dossier.groupBy({ by: ["status"], where: f.dossier, _count: true, _sum: { amount: true } }),
  ]);

  // CA mensuel sur 12 mois glissants
  const t = parisParts(new Date());
  const months = Array.from({ length: 12 }, (_, i) => {
    const idx = t.y * 12 + (t.m - 1) - (11 - i);
    const y = Math.floor(idx / 12), m = (idx % 12) + 1;
    return { key: `${y}-${pad(m)}`, label: `${MONTHS[m - 1]}${m === 1 || i === 0 ? ` ${String(y).slice(2)}` : ""}`, sent: 0, accepted: 0 };
  });
  const quotes = await db.quote.findMany({
    where: { ...f.quote, status: { in: SENT }, issuedAt: { gte: fromParis(`${months[0].key}-01`) } },
    select: { issuedAt: true, totalHT: true, status: true },
  });
  for (const q of quotes) {
    const p = parisParts(q.issuedAt);
    const b = months.find((x) => x.key === `${p.y}-${pad(p.m)}`);
    if (!b) continue;
    b.sent += q.totalHT;
    if (q.status === "ACCEPTE") b.accepted += q.totalHT;
  }

  // tâches terminées par semaine (8 dernières semaines)
  const weekStart = new Date(today.getTime() - ((new Date(today.getTime() + 12 * 36e5).getUTCDay() + 6) % 7) * 864e5);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const s = new Date(weekStart.getTime() - (7 - i) * 7 * 864e5);
    const p = parisParts(new Date(s.getTime() + 12 * 36e5));
    return { start: s, end: new Date(s.getTime() + 7 * 864e5), label: `${p.d} ${MONTHS[p.m - 1]}`, done: 0, created: 0 };
  });
  const [doneList, createdList] = await Promise.all([
    db.task.findMany({ where: { ...f.task, status: "FAIT", completedAt: { gte: weeks[0].start } }, select: { completedAt: true } }),
    db.task.findMany({ where: { ...f.task, createdAt: { gte: weeks[0].start } }, select: { createdAt: true } }),
  ]);
  for (const x of doneList) { const w = weeks.find((w) => x.completedAt! >= w.start && x.completedAt! < w.end); if (w) w.done++; }
  for (const x of createdList) { const w = weeks.find((w) => x.createdAt >= w.start && x.createdAt < w.end); if (w) w.created++; }

  const sentHT = sent._sum.totalHT ?? 0;
  const acceptedHT = accepted._sum.totalHT ?? 0;
  return {
    kpi: {
      acceptedHT, acceptedCount: accepted._count, prevAcceptedHT: prevAccepted._sum.totalHT ?? 0,
      sentHT, sentCount: sent._count,
      conversion: sent._count ? accepted._count / sent._count : null,
      newClients, prevNewClients, doneTasks, lateTasks, upcomingEvents,
    },
    months: months.map(({ label, sent, accepted }) => ({ label, sent: Math.round(sent), accepted: Math.round(accepted) })),
    weeks: weeks.map(({ label, done, created }) => ({ label, done, created })),
    pipeline: DOSSIER_STATUSES.map((s) => {
      const g = pipeline.find((p) => p.status === s.id);
      return { id: s.id, label: s.label, count: g?._count ?? 0, amount: g?._sum.amount ?? 0 };
    }),
  };
}

/** Tableau par membre de l'équipe sur la période. */
export async function teamTable(period: PeriodId) {
  const { start, end } = periodRange(period);
  const users = await db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true, jobTitle: true }, orderBy: { name: "asc" } });
  const today = startOfDay();
  return Promise.all(
    users.map(async (u) => {
      const f = memberFilters(u.id);
      const [acc, openDossiers, done, late, events] = await Promise.all([
        db.quote.aggregate({ where: { ...f.quote, status: "ACCEPTE", issuedAt: { gte: start, lt: end } }, _sum: { totalHT: true } }),
        db.dossier.count({ where: { ...f.dossier, status: { in: ["DEMANDE", "DEVIS_ENVOYE", "OPTION"] } } }),
        db.task.count({ where: { ...f.task, status: "FAIT", completedAt: { gte: start, lt: end } } }),
        db.task.count({ where: { ...f.task, status: { not: "FAIT" }, dueDate: { lt: today } } }),
        db.event.count({ where: { ...f.event, start: { gte: start, lt: end } } }),
      ]);
      return { ...u, acceptedHT: acc._sum.totalHT ?? 0, openDossiers, done, late, events };
    }),
  );
}

export type DashboardStats = Awaited<ReturnType<typeof dashboardStats>>;
export type { User };
