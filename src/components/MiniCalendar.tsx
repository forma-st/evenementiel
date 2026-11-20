"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "./Icon";

export type CalItem = { id: string; title: string; day: string; endDay: string; href: string; tone: "presta" | "option" | "gear" | "rdv" };
const TONE: Record<CalItem["tone"], string> = {
  presta: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  option: "bg-amber-100 text-amber-800 ring-amber-200",
  gear: "bg-sky-100 text-sky-800 ring-sky-200",
  rdv: "bg-blue-100 text-blue-800 ring-blue-200",
};
const DOW = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Calendrier du mois : prestations, options, locations et rendez-vous. */
export function MiniCalendar({ items, today }: { items: CalItem[]; today: string }) {
  const [y0, m0] = today.split("-").map(Number);
  const [cur, setCur] = useState({ y: y0, m: m0 - 1 });
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cur.y, cur.m, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const n = new Date(Date.UTC(cur.y, cur.m + 1, 0)).getUTCDate();
    const out: { k: string; d: number; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const dt = new Date(Date.UTC(cur.y, cur.m, 1 - lead + i));
      out.push({ k: key(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()), d: dt.getUTCDate(), inMonth: dt.getUTCMonth() === cur.m });
    }
    return (lead + n > 35 ? out : out.slice(0, 35));
  }, [cur]);
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cur.y, cur.m, 1)));
  const go = (n: number) => setCur((c) => { const d = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} aria-label="Mois précédent" className="rounded-lg p-1.5 ring-1 ring-slate-200 hover:bg-slate-50"><Icon name="chevronLeft" className="h-4 w-4" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Mois suivant" className="rounded-lg p-1.5 ring-1 ring-slate-200 hover:bg-slate-50"><Icon name="chevronRight" className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCur({ y: y0, m: m0 - 1 })} className="rounded-lg px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50">Aujourd&apos;hui</button>
        </div>
        <div className="font-semibold first-letter:uppercase">{label}</div>
        <Link href="/agenda" className="text-xs text-link-600 hover:underline">Agenda complet →</Link>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-xl text-xs ring-1 ring-slate-200">
        {DOW.map((d) => <div key={d} className="border-b border-slate-200 bg-slate-50 py-1.5 text-center font-medium text-slate-500">{d}</div>)}
        {cells.map((c) => {
          const evs = items.filter((i) => i.day <= c.k && i.endDay >= c.k);
          return (
            <div key={c.k} className={`min-h-[68px] border-b border-r border-slate-100 p-1 ${c.inMonth ? "" : "bg-slate-50/60 text-slate-400"} [&:nth-child(7n)]:border-r-0`}>
              <div className={`mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${c.k === today ? "bg-brand-600 font-semibold text-white" : ""}`}>{c.d}</div>
              <div className="space-y-0.5">
                {evs.slice(0, 2).map((e) => <Link key={e.id} href={e.href} title={e.title} className={`block truncate rounded px-1 py-px text-[10.5px] ring-1 ${TONE[e.tone]}`}>{e.title}</Link>)}
                {evs.length > 2 && <div className="px-1 text-[10px] text-slate-500">+{evs.length - 2}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {([["presta", "Confirmée"], ["option", "Option / devis"], ["gear", "Location, prêt"], ["rdv", "Rendez-vous"]] as const).map(([k, l]) => <span key={k} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ring-1 ${TONE[k]}`} />{l}</span>)}
      </div>
    </div>
  );
}
