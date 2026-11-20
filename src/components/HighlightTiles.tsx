"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";

type Counts = { week: number; month: number; quarter: number; year: number };
const PER: [keyof Counts, string, string][] = [["week", "Semaine", "Cette semaine"], ["month", "Mois", "Ce mois-ci"], ["quarter", "Trim.", "Ce trimestre"], ["year", "Année", "Cette année"]];

function Tile({ title, counts, href, initial }: { title: string; counts: Counts; href: string; initial: keyof Counts }) {
  const [p, setP] = useState<keyof Counts>(initial);
  return (
    <div className="tile-navy flex min-h-[220px] flex-col rounded-[26px] p-6 shadow-[0_20px_40px_-24px_rgba(11,26,61,.9)]">
      <div className="text-lg font-semibold leading-tight">{title}</div>
      <div className="muted text-xs">{PER.find((x) => x[0] === p)?.[2]}</div>
      <div className="my-auto py-3 text-7xl font-bold tracking-tight tabular-nums">{counts[p]}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 text-xs">
          {PER.map(([k, l]) => <button key={k} type="button" onClick={() => setP(k)} aria-pressed={p === k} className={p === k ? "font-semibold text-white" : "muted hover:text-[#fff]"}>{l}</button>)}
        </div>
        <Link href={href} className="rounded-lg px-3 py-1 text-xs ring-1 ring-[rgba(255,255,255,.40)] hover:bg-[rgba(255,255,255,.10)]">Voir</Link>
      </div>
    </div>
  );
}

/** Tuiles façon « cockpit » : prestations et locations à venir, création rapide. */
export function HighlightTiles({ events, rentals, totals }: { events: Counts; rentals: Counts; totals: { dossiers: number; clients: number } }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <Tile title="Prestations à venir" counts={events} href="/prestations" initial="month" />
      <Tile title="Locations et prêts à venir" counts={rentals} href="/materiel" initial="year" />
      <div className="tile-glow flex min-h-[220px] flex-col rounded-[26px] p-6 shadow-[0_20px_40px_-24px_rgba(29,85,192,.9)] sm:col-span-2 xl:col-span-1">
        <div className="text-lg font-semibold">Quelque chose de nouveau ?</div>
        <div className="mt-4 flex gap-6">
          {[["layers", "Prestations", totals.dossiers], ["users", "Clients", totals.clients]].map(([ic, l, n]) => (
            <div key={l as string} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,.20)]"><Icon name={ic as string} className="h-5 w-5" /></span>
              <div><div className="muted text-xs">{l}</div><div className="text-lg font-semibold tabular-nums">{n}</div></div>
            </div>
          ))}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
          {[["/prestations/nouveau", "Une prestation"], ["/prestations/nouveau?type=LOCATION", "Une location"], ["/materiel/sortie", "Un prêt"], ["/clients/nouveau", "Un client"]].map(([h, l]) => (
            <Link key={h} href={h} className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-[rgba(255,255,255,.50)] transition hover:bg-[rgba(255,255,255,.15)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fff] text-[#1d55c0]"><Icon name="plus" className="h-3.5 w-3.5" /></span>{l}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
