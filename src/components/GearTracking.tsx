import Link from "next/link";
import type { OutRow, PrepRow } from "@/lib/gearTracking";
import { parisParts } from "@/lib/format";
import { Fold } from "./Fold";

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...o }).format(new Date(iso));
const day = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
const hour = (iso: string) => fmt(iso, { hour: "2-digit", minute: "2-digit" });
/** Écart en jours calendaires (heure de Paris) entre aujourd'hui et la date. */
const inDays = (iso: string) => Math.round((Date.parse(parisParts(new Date(iso)).key) - Date.parse(parisParts(new Date()).key)) / 864e5);
const when = (n: number) => (n <= 0 ? "aujourd'hui" : n === 1 ? "demain" : `J-${n}`);
const KIND: Record<OutRow["kind"], string> = { LOCATION: "Location", PRET: "Prêt", PRESTATION: "En prestation" };

function PrepLine({ r }: { r: PrepRow }) {
  const n = inDays(r.start);
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  const ready = r.hasList && r.total > 0 && r.done === r.total;
  return (
    <li>
      <Link href={`/preparer/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
        <span className={`w-20 shrink-0 rounded-md px-2 py-1 text-center text-xs font-semibold ${n <= 1 ? "bg-amber-100 text-amber-800" : n <= 3 ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"}`}>{when(n)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{r.icon} {r.title}</div>
          <div className="truncate text-xs text-slate-500">{day(r.start)} · {hour(r.start)} · {r.units} unité{r.units > 1 ? "s" : ""}, {r.lines} article{r.lines > 1 ? "s" : ""}</div>
        </div>
        <div className="w-24 shrink-0 text-right">
          {ready ? <span className="badge bg-emerald-100 text-emerald-700">✓ prêt</span>
            : r.hasList ? (
              <>
                <div className="text-xs tabular-nums text-slate-600">{r.done}/{r.total}</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} /></div>
              </>
            ) : <span className="text-xs text-slate-400">{r.gearOnly ? "à remettre" : "liste à créer"}</span>}
        </div>
      </Link>
    </li>
  );
}

function OutLine({ r }: { r: OutRow }) {
  const n = inDays(r.end);
  return (
    <li>
      <Link href={`/prestations/${r.id}`} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 ${r.late ? "bg-rose-50/70" : ""}`}>
        <span className={`w-24 shrink-0 rounded-md px-2 py-1 text-center text-xs font-semibold ${r.late ? "bg-rose-600 text-white" : r.kind === "PRESTATION" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{r.late ? "En retard" : KIND[r.kind]}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{r.icon} {r.title}</div>
          <div className="truncate text-xs text-slate-500">{r.summary}</div>
        </div>
        <div className="shrink-0 text-right text-xs">
          <div className={r.late ? "font-semibold text-rose-700" : "text-slate-600"}>{r.late ? `retour prévu ${day(r.end)}` : `retour ${n <= 0 ? "aujourd'hui" : n === 1 ? "demain" : day(r.end)}`}</div>
          <div className="text-slate-400">{hour(r.end)}</div>
        </div>
      </Link>
    </li>
  );
}

/** Listes « à préparer » et « sorti » (page Matériel). */
export function GearTracking({ toPrepare, out, horizon }: { toPrepare: PrepRow[]; out: OutRow[]; horizon: number }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Fold id="gt-prep" title={<>📋 Matériel à préparer <span className="ml-1 badge bg-slate-100 text-slate-600">{toPrepare.length}</span></>}
        summary={toPrepare.length ? `prochaine : ${toPrepare[0].title} (${when(inDays(toPrepare[0].start))})` : `rien dans les ${horizon} jours`}
        actions={toPrepare.some((r) => inDays(r.start) <= 1 && !(r.hasList && r.done === r.total && r.total > 0)) ? <span className="badge bg-amber-100 text-amber-800">urgent</span> : <Link href="/preparer" className="text-xs text-link-600 hover:underline">Mode préparation</Link>}>
        {toPrepare.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Rien à préparer pour l&apos;instant.</p>
          : <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">{toPrepare.map((r) => <PrepLine key={r.id} r={r} />)}</ul>}
      </Fold>
      <Fold id="gt-out" title={<>🚚 Matériel sorti <span className="ml-1 badge bg-slate-100 text-slate-600">{out.length}</span></>}
        summary={out.length ? `${out.reduce((a, o) => a + o.units, 0)} unité(s) dehors` : "tout est au dépôt"}
        actions={out.some((o) => o.late) ? <span className="badge bg-rose-100 text-rose-700">{out.filter((o) => o.late).length} en retard</span> : undefined}>
        {out.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Tout le matériel est au dépôt.</p>
          : <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">{out.map((r) => <OutLine key={r.id} r={r} />)}</ul>}
      </Fold>
    </div>
  );
}

/** Widget compact du tableau de bord. */
export function GearTrackingWidget({ toPrepare, out, late, unitsOut, repair }: { toPrepare: PrepRow[]; out: OutRow[]; late: number; unitsOut: number; repair: number }) {
  const soon = toPrepare.filter((r) => inDays(r.start) <= 3);
  const notReady = soon.filter((r) => !(r.hasList && r.done === r.total && r.total > 0));
  const tiles = [
    { label: "À préparer (J-3)", value: soon.length, sub: notReady.length ? `${notReady.length} pas prêt${notReady.length > 1 ? "s" : ""}` : soon.length ? "tout est prêt" : "rien d'ici 3 jours", tone: notReady.length ? "text-amber-700" : "text-slate-500" },
    { label: "Sorties en cours", value: out.length, sub: `${unitsOut} unité${unitsOut > 1 ? "s" : ""} dehors`, tone: "text-slate-500" },
    { label: "Retours en retard", value: late, sub: late ? "à relancer" : "aucun", tone: late ? "text-rose-700 font-medium" : "text-slate-500" },
    { label: "En réparation", value: repair, sub: repair ? "unité(s) indisponible(s)" : "parc complet", tone: "text-slate-500" },
  ];
  const next = [...out.filter((o) => o.late), ...notReady].slice(0, 3);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href="/materiel" className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/60 transition hover:ring-brand-300">
            <div className="text-xs text-slate-500">{t.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{t.value}</div>
            <div className={`truncate text-xs ${t.tone}`}>{t.sub}</div>
          </Link>
        ))}
      </div>
      {next.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200/60">
          {next.map((r) => ("late" in r ? <OutLine key={r.id} r={r} /> : <PrepLine key={r.id} r={r} />))}
        </ul>
      )}
    </div>
  );
}
