import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { eventWhere, permsFor } from "@/lib/permissions";
import { EVENT_TYPES, eventType } from "@/lib/events";
import { fromParis, longDate, parisParts, time } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";

export const metadata = { title: "Agenda" };

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export default async function Agenda({ searchParams }: { searchParams: Promise<{ mois?: string; vue?: string; membre?: string; type?: string }> }) {
  const user = await requireStaff();
  const perms = await permsFor(user);
  const sp = await searchParams;
  const today = parisParts(new Date());
  const [y, m] = (sp.mois ?? `${today.y}-${pad(today.m)}`).split("-").map(Number);
  const vue = sp.vue === "liste" ? "liste" : "mois";
  const membre = perms.eventsScope === "all" ? sp.membre ?? "" : "";

  // grille : du lundi précédant le 1er, sur 6 semaines
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(y, m - 1, 1 - offset));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getTime() + i * 864e5);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), key: keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) };
  });
  const rangeStart = vue === "mois" ? fromParis(days[0].key) : fromParis(today.key);
  const rangeEnd = vue === "mois" ? fromParis(days[41].key, "23:59") : new Date(rangeStart.getTime() + 60 * 864e5);

  const where: Prisma.EventWhereInput = {
    AND: [
      eventWhere(user, perms),
      { start: { lt: rangeEnd }, end: { gt: rangeStart } },
      membre ? { attendees: { some: { userId: membre } } } : {},
      sp.type ? { type: sp.type } : {},
    ],
  };
  const [events, users] = await Promise.all([
    db.event.findMany({ where, include: { client: { select: { name: true } }, attendees: { include: { user: { select: { name: true } } } } }, orderBy: { start: "asc" } }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // répartit chaque événement sur les jours qu'il couvre
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    let d = parisParts(e.start);
    const last = parisParts(new Date(e.end.getTime() - 1)).key;
    for (let guard = 0; guard < 62; guard++) {
      byDay.set(d.key, [...(byDay.get(d.key) ?? []), e]);
      if (d.key >= last) break;
      d = parisParts(new Date(fromParis(d.key, "12:00").getTime() + 864e5));
    }
  }

  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ mois: `${y}-${pad(m)}`, vue, membre, type: sp.type, ...patch })) if (v) p.set(k, v);
    return `/agenda?${p}`;
  };
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={<Link href="/parametres/integrations#google" className="text-link-600 hover:underline">Afficher cet agenda dans Google Agenda →</Link>}
        actions={
          <>
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
              <Link href={qs({ vue: "mois" })} className={`rounded-md px-3 py-1.5 ${vue === "mois" ? "bg-slate-100 font-medium" : ""}`}>Mois</Link>
              <Link href={qs({ vue: "liste" })} className={`rounded-md px-3 py-1.5 ${vue === "liste" ? "bg-slate-100 font-medium" : ""}`}>À venir</Link>
            </div>
            <Link href="/agenda/nouveau" className="btn-primary">+ Nouvel événement</Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {vue === "mois" && (
          <div className="flex items-center gap-1">
            <Link href={qs({ mois: prev })} className="btn-secondary px-2.5" aria-label="Mois précédent">‹</Link>
            <Link href={qs({ mois: `${today.y}-${pad(today.m)}` })} className="btn-secondary">Aujourd'hui</Link>
            <Link href={qs({ mois: next })} className="btn-secondary px-2.5" aria-label="Mois suivant">›</Link>
            <h2 className="ml-2 text-lg font-semibold first-letter:uppercase">{monthName}</h2>
          </div>
        )}
        <form className="ml-auto flex flex-wrap gap-2">
          <input type="hidden" name="mois" value={`${y}-${pad(m)}`} />
          <input type="hidden" name="vue" value={vue} />
          {perms.eventsScope === "all" && (
            <select name="membre" defaultValue={membre} className="input w-48">
              <option value="">Toute l'équipe</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.id === user.id ? "Mon agenda" : u.name}</option>)}
            </select>
          )}
          <select name="type" defaultValue={sp.type ?? ""} className="input w-48">
            <option value="">Tous les types</option>
            {EVENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button className="btn-secondary">Filtrer</button>
        </form>
      </div>

      {vue === "mois" ? (
        <div className="card overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7">
            {WEEKDAYS.map((d) => <div key={d} className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase">{d}</div>)}
            {days.map((d, i) => {
              const list = byDay.get(d.key) ?? [];
              const inMonth = d.m === m;
              const isToday = d.key === today.key;
              return (
                <div key={d.key} className={`group min-h-28 border-slate-100 p-1.5 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${inMonth ? "" : "bg-slate-50/70"}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? "bg-brand-600 font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-400"}`}>{d.d}</span>
                    <Link href={`/agenda/nouveau?date=${d.key}`} className="rounded px-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100" title="Ajouter un événement">+</Link>
                  </div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((e) => {
                      const t = eventType(e.type);
                      return (
                        <Link key={e.id} href={`/agenda/${e.id}`} title={`${e.title}${e.client ? ` — ${e.client.name}` : ""}`} className={`block truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] leading-tight hover:brightness-95 ${t.chip}`}>
                          {!e.allDay && <span className="font-semibold">{time(e.start)} </span>}{e.title}
                        </Link>
                      );
                    })}
                    {list.length > 3 && <Link href={qs({ vue: "liste" })} className="block px-1 text-[11px] text-slate-500 hover:underline">+{list.length - 3} autre(s)</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="card"><Empty>Aucun événement dans les 60 prochains jours.</Empty></div>
      ) : (
        <div className="space-y-5">
          {[...new Set(events.map((e) => parisParts(e.start).key))].map((k) => (
            <section key={k}>
              <h3 className="mb-2 text-sm font-semibold first-letter:uppercase">{longDate(fromParis(k, "12:00"))}{k === today.key && <span className="ml-2 text-brand-600">· aujourd'hui</span>}</h3>
              <div className="card divide-y divide-slate-100">
                {events.filter((e) => parisParts(e.start).key === k).map((e) => {
                  const t = eventType(e.type);
                  return (
                    <Link key={e.id} href={`/agenda/${e.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                      <span className="w-24 shrink-0 text-sm font-medium">{e.allDay ? "Journée" : `${time(e.start)} – ${time(e.end)}`}</span>
                      <span className={`h-8 w-1 shrink-0 rounded ${t.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{t.icon} {e.title}</div>
                        <div className="truncate text-xs text-slate-500">{[e.client?.name, e.location, e.attendees.map((a) => a.user.name.split(" ")[0]).join(", ")].filter(Boolean).join(" · ")}</div>
                      </div>
                      {e.report && <span className="badge bg-emerald-100 text-emerald-700">Compte-rendu</span>}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
