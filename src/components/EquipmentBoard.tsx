"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

export type BoardBooking = {
  dossierId: string; reference: string; title: string; status: string; icon: string;
  start: string; end: string; city: string | null; venue: string | null; client: string; quantity: number;
};
export type BoardItem = { id: string; name: string; category: string; quantity: number; outOfService: number; notes: string | null; dailyRate: number | null; replacementValue: number | null; bookings: BoardBooking[] };
type Cat = { id: string; label: string; icon: string };

const MARGIN = 8 * 36e5;
const TZ = "Europe/Paris";
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...o });
const dayKey = (iso: string) => fmt({ year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)).split("/").reverse().join("-");
/** Jours occupés : une soirée (moins de 24 h) compte pour son jour de début, une location pour chaque jour. */
function spanDays(b: { start: string; end: string }) {
  const s0 = new Date(b.start), e0 = new Date(b.end);
  if (+e0 - +s0 < 864e5) return [{ key: dayKey(b.start), iso: b.start }];
  const out: { key: string; iso: string }[] = [];
  for (let t = +s0; t <= +e0 && out.length < 62; t += 864e5) {
    const iso = new Date(t).toISOString();
    if (!out.some((x) => x.key === dayKey(iso))) out.push({ key: dayKey(iso), iso });
  }
  if (!out.some((x) => x.key === dayKey(b.end))) out.push({ key: dayKey(b.end), iso: b.end });
  return out;
}
const covers = (b: { start: string; end: string }, key: string) => spanDays(b).some((d) => d.key === key);
const weekday = (iso: string) => fmt({ weekday: "long" }).format(new Date(iso));
const dayNum = (iso: string) => fmt({ day: "numeric" }).format(new Date(iso));
const month = (iso: string) => fmt({ month: "short" }).format(new Date(iso)).replace(".", "");
const monthLong = (iso: string) => fmt({ month: "long", year: "numeric" }).format(new Date(iso));
const hour = (iso: string) => fmt({ hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const isWeekend = (iso: string) => ["samedi", "dimanche"].includes(weekday(iso));
const daysUntil = (iso: string) => Math.round((new Date(iso).setHours(12) - new Date().setHours(12)) / 864e5);

type Tone = "ok" | "option" | "full" | "over";
const TONE: Record<Tone, { cell: string; dot: string; text: string; label: string }> = {
  ok: { cell: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700", label: "confirmée" },
  option: { cell: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-400", text: "text-amber-700", label: "en option" },
  full: { cell: "bg-cyan-50 text-cyan-800 ring-cyan-200", dot: "bg-cyan-500", text: "text-cyan-700", label: "tout le stock sort" },
  over: { cell: "bg-rose-100 text-rose-800 ring-rose-300", dot: "bg-rose-500", text: "text-rose-700", label: "surréservé" },
};

/** Quantité sortie sur le créneau d'une réservation (chevauchements compris). */
function usedAround(i: BoardItem, b: BoardBooking) {
  const s0 = +new Date(b.start) - MARGIN, e0 = +new Date(b.end) + MARGIN;
  return i.bookings.filter((x) => +new Date(x.start) < e0 && +new Date(x.end) > s0).reduce((a, x) => a + x.quantity, 0);
}
const usable = (i: BoardItem) => Math.max(0, i.quantity - i.outOfService);

export function EquipmentBoard({ items, cats, days, periods, save, remove, top }: {
  top?: React.ReactNode;
  items: BoardItem[];
  cats: Cat[];
  days: number;
  periods: readonly (readonly [number, string])[];
  save: (id: string | null, f: FormData) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [showFree, setShowFree] = useState(false);
  const [open, setOpen] = useState<string | null>(null); // case du planning ouverte
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const match = (i: BoardItem) => (!cat || i.category === cat) && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()));
  const filtered = items.filter(match);

  const tone = (i: BoardItem, bs: BoardBooking[]): Tone => {
    const used = Math.max(...bs.map((b) => usedAround(i, b)));
    if (used > usable(i)) return "over";
    if (used >= usable(i)) return "full";
    return bs.every((b) => b.status === "CONFIRME") ? "ok" : "option";
  };

  // dates de sortie (toutes catégories, pour la frise) et colonnes du planning (selon les filtres)
  const outings = useMemo(() => {
    const map = new Map<string, { key: string; iso: string; events: Map<string, BoardBooking>; units: number; overItems: Set<string>; over: number }>();
    for (const i of items) for (const b of i.bookings) for (const day of spanDays(b)) {
      const k = day.key;
      const o = map.get(k) ?? { key: k, iso: day.iso, events: new Map(), units: 0, overItems: new Set<string>(), over: 0 };
      o.events.set(b.dossierId, b);
      o.units += b.quantity;
      if (usedAround(i, b) > usable(i)) o.overItems.add(i.id);
      o.over = o.overItems.size;
      map.set(k, o);
    }
    return [...map.values()].sort((a, b) => +new Date(a.iso) - +new Date(b.iso));
  }, [items]);
  const cols = outings.filter((o) => filtered.some((i) => i.bookings.some((b) => covers(b, o.key))));
  const rows = filtered.filter((i) => showFree || i.bookings.length);

  const totalUnits = items.reduce((a, i) => a + i.quantity, 0);
  const repair = items.reduce((a, i) => a + i.outOfService, 0);
  const conflicts = outings.reduce((a, o) => a + o.over, 0);
  const next = outings[0];

  return (
    <div className="space-y-8">
      {/* En-tête : l'état du parc en une phrase */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">Parc matériel</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            {items.length} articles, {totalUnits} unités{repair > 0 && <>, dont <span className="font-medium text-slate-800">{repair} en réparation</span></>}.{" "}
            {next ? <>Prochaine sortie <span className="font-medium text-slate-800">{weekday(next.iso)} {dayNum(next.iso)} {month(next.iso)}</span>{daysUntil(next.iso) <= 1 ? (daysUntil(next.iso) === 0 ? ", aujourd'hui" : ", demain") : `, dans ${daysUntil(next.iso)} jours`}.</> : "Aucune sortie prévue sur la période."}
            {conflicts > 0 && <> <span className="font-semibold text-rose-700">{conflicts} conflit{conflicts > 1 ? "s" : ""} de stock à régler.</span></>}
          </p>
        </div>
        <button onClick={() => setAdding((x) => !x)} className="btn-primary">{adding ? "Fermer" : "Ajouter du matériel"}</button>
      </div>

      {adding && (
        <form action={async (f) => { await save(null, f); setAdding(false); }} className="card grid gap-3 p-5 sm:grid-cols-[1fr_180px_100px_1fr_auto] sm:items-end">
          <label className="block"><span className="label">Désignation</span><input name="name" required autoFocus placeholder="Enceinte 15 pouces 1200 W" className="input" /></label>
          <label className="block"><span className="label">Catégorie</span><select name="category" defaultValue={cat || "SONO"} className="input">{cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label className="block"><span className="label">Quantité</span><input name="quantity" type="number" min={0} defaultValue={1} className="input" /></label>
          <label className="block"><span className="label">Notes</span><input name="notes" placeholder="N° de série, état, emplacement…" className="input" /></label>
          <button className="btn-primary">Ajouter</button>
        </form>
      )}

      {top}

      {/* Frise des prochaines sorties */}
      {outings.length > 0 && (
        <section aria-label="Prochaines sorties">
          <h2 className="mb-3 text-lg font-semibold">Prochaines sorties</h2>
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {outings.map((o) => {
              const evs = [...o.events.values()];
              const d = daysUntil(o.iso);
              return (
                <article key={o.key} className={`flex w-64 shrink-0 snap-start flex-col rounded-2xl border bg-white p-4 shadow-sm ${o.over ? "border-rose-300" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500 capitalize">{weekday(o.iso)}</div>
                      <div className="font-display text-3xl leading-none font-semibold">{dayNum(o.iso)} <span className="text-lg font-medium text-slate-500">{month(o.iso)}</span></div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d <= 3 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>{d === 0 ? "aujourd'hui" : d === 1 ? "demain" : `J-${d}`}</span>
                  </div>
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                    {evs.map((e) => (
                      <li key={e.dossierId}>
                        <Link href={`/prestations/${e.dossierId}#materiel`} className="flex items-center gap-2 hover:text-brand-700">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${e.status === "CONFIRME" ? TONE.ok.dot : TONE.option.dot}`} title={e.status === "CONFIRME" ? "confirmée" : "en option"} />
                          <span className="truncate">{e.icon} {e.client}</span>
                          <span className="ml-auto shrink-0 text-xs text-slate-500">{hour(e.start)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                    <span className={o.over ? "font-medium text-rose-700" : "text-slate-600"}>{o.over ? `⛔ ${o.over} conflit${o.over > 1 ? "s" : ""}` : `${o.units} unités`}</span>
                    <Link href={`/materiel/chargement?date=${o.key}`} className="font-medium text-link-600 hover:underline">Liste de chargement</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Filtres communs au planning et à l'inventaire */}
      <div className="-mx-4 flex flex-wrap items-center gap-2 border-b md:sticky md:top-0 md:z-20 border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Rechercher un matériel" className="input w-full md:w-56" aria-label="Rechercher un matériel" />
        <div className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 md:mx-0 md:w-auto md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Catégorie">
          <button onClick={() => setCat("")} aria-pressed={!cat} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${!cat ? "bg-ink text-paper" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}>Tout</button>
          {cats.filter((c) => items.some((i) => i.category === c.id)).map((c) => (
            <button key={c.id} onClick={() => setCat(c.id === cat ? "" : c.id)} aria-pressed={cat === c.id} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${cat === c.id ? "bg-ink text-paper" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}>{c.icon} {c.label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <span className="mr-1 text-slate-500">Période</span>
          {periods.map(([n, l]) => <Link key={n} href={`?jours=${n}`} className={`rounded-full px-3 py-1.5 ${n === days ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}>{l}</Link>)}
        </div>
      </div>

      {/* Planning */}
      <section aria-labelledby="planning" className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 id="planning" className="font-semibold">Planning</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            {(["ok", "option", "full", "over"] as Tone[]).map((t) => <span key={t} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${TONE[t].dot}`} />{TONE[t].label}</span>)}
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={showFree} onChange={(e) => setShowFree(e.target.checked)} className="accent-brand-600" /> afficher le matériel libre</label>
          </div>
        </div>
        {cols.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">{q || cat ? "Aucune sortie pour ce filtre." : "Rien ne sort sur la période. Le matériel est réservé depuis la fiche d'une prestation."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-56 min-w-56 bg-white" />
                  {cols.map((o, k) => {
                    const newMonth = k === 0 || monthLong(cols[k - 1].iso) !== monthLong(o.iso);
                    return <th key={o.key} className={`bg-white px-1 pt-3 text-left text-xs font-medium whitespace-nowrap text-slate-500 first-letter:uppercase ${newMonth ? "border-l border-slate-200" : ""}`}>{newMonth ? monthLong(o.iso) : ""}</th>;
                  })}
                  <th className="w-full bg-white" />
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-white px-5 pb-2 text-left text-xs font-medium text-slate-500">Matériel</th>
                  {cols.map((o) => (
                    <th key={o.key} className={`w-24 min-w-24 border-b border-slate-200 px-1 pb-2 text-center font-normal ${isWeekend(o.iso) ? "bg-slate-50" : "bg-white"}`}>
                      <Link href={`/materiel/chargement?date=${o.key}`} title="Liste de chargement" className="inline-flex flex-col items-center rounded-lg px-2 py-1 hover:bg-brand-50">
                        <span className="text-[11px] text-slate-500">{weekday(o.iso).slice(0, 3)}</span>
                        <span className="text-base leading-5 font-semibold">{dayNum(o.iso)}</span>
                      </Link>
                    </th>
                  ))}
                  <th className="border-b border-slate-200 bg-white" />
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="group">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-5 py-2 group-hover:bg-slate-50">
                      <div className="truncate font-medium">{i.name}</div>
                      <div className="text-xs text-slate-500">{usable(i)} utilisable{usable(i) > 1 ? "s" : ""}{i.outOfService ? `, ${i.outOfService} en réparation` : ""}</div>
                    </td>
                    {cols.map((o) => {
                      const bs = i.bookings.filter((b) => covers(b, o.key));
                      const cellId = `${i.id}|${o.key}`;
                      if (!bs.length) return <td key={o.key} className={`border-b border-slate-100 ${isWeekend(o.iso) ? "bg-slate-50" : ""}`} />;
                      const t = tone(i, bs);
                      const used = Math.max(...bs.map((b) => usedAround(i, b)));
                      return (
                        <td key={o.key} className={`relative border-b border-slate-100 p-1 ${isWeekend(o.iso) ? "bg-slate-50" : ""}`}>
                          <button
                            onClick={() => setOpen(open === cellId ? null : cellId)}
                            aria-expanded={open === cellId}
                            className={`w-full rounded-md px-1 py-1.5 text-center font-semibold tabular-nums ring-1 transition hover:brightness-95 ${TONE[t].cell} ${open === cellId ? "ring-2 ring-ink" : ""}`}
                          >
                            {t === "over" ? "⛔ " : ""}{used}<span className="font-normal opacity-60">/{usable(i)}</span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-slate-100" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(() => {
          if (!open) return null;
          const [itemId, key] = open.split("|");
          const i = items.find((x) => x.id === itemId);
          const bs = i?.bookings.filter((b) => covers(b, key)) ?? [];
          if (!i || !bs.length) return null;
          const used = Math.max(...bs.map((b) => usedAround(i, b)));
          const t = tone(i, bs);
          return (
            <div className={`border-t-2 px-5 py-4 ${t === "over" ? "border-rose-300 bg-rose-50/60" : "border-brand-100 bg-brand-50/40"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{i.name}, {weekday(bs[0].start)} {dayNum(bs[0].start)} {month(bs[0].start)}</h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className={TONE[t].text}>{used} sur {usable(i)} utilisable{usable(i) > 1 ? "s" : ""}, {TONE[t].label}</span>
                  <button onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-700" aria-label="Fermer le détail">✕</button>
                </div>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {bs.map((b) => (
                  <li key={b.dossierId}>
                    <Link href={`/prestations/${b.dossierId}#materiel`} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 hover:ring-brand-500">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{b.icon} {b.client}</div>
                        <div className="text-xs text-slate-500">{b.reference}, {hour(b.start)}{b.city ? `, ${b.city}` : ""}, {b.status === "CONFIRME" ? "confirmée" : "en option"}</div>
                      </div>
                      <span className="text-lg font-semibold tabular-nums">× {b.quantity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {t === "over" && <p className="mt-3 text-sm text-rose-800">Il manque {used - usable(i)} unité{used - usable(i) > 1 ? "s" : ""} : réduisez une réservation depuis la prestation, ou prévoyez une location.</p>}
            </div>
          );
        })()}
      </section>

      {/* Inventaire */}
      <section aria-labelledby="inventaire" className="space-y-4">
        <h2 id="inventaire" className="text-lg font-semibold">Inventaire <span className="text-sm font-normal text-slate-500">{filtered.length} article{filtered.length > 1 ? "s" : ""}</span></h2>
        {filtered.length === 0 && <p className="card p-8 text-center text-sm text-slate-500">Aucun matériel ne correspond. <button onClick={() => { setQ(""); setCat(""); }} className="text-link-600 hover:underline">Effacer les filtres</button></p>}
        {cats.map((c) => {
          const list = filtered.filter((i) => i.category === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id} className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-sm font-medium text-slate-700"><span aria-hidden>{c.icon}</span>{c.label}</div>
              <ul className="divide-y divide-slate-100">
                {list.map((i) => {
                  const peak = i.bookings.length ? Math.max(...i.bookings.map((b) => usedAround(i, b))) : 0;
                  const u = usable(i);
                  const over = peak > u;
                  const nextB = i.bookings[0];
                  return (
                    <li key={i.id} className={over ? "bg-rose-50/50" : ""}>
                      <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="font-medium">{i.name}</div>
                          <div className="truncate text-xs text-slate-500">{i.notes || " "}</div>
                        </div>
                        {/* jauge : utilisé au pic / libre / en réparation */}
                        <div>
                          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${Math.min(peak, u)} sur ${u} réservés au plus fort, ${i.outOfService} en réparation`}>
                            <div className={over ? "bg-rose-500" : peak >= u && u > 0 ? "bg-cyan-500" : "bg-brand-500"} style={{ width: `${i.quantity ? (Math.min(peak, u) / i.quantity) * 100 : 0}%` }} />
                            <div className="flex-1" />
                            {i.outOfService > 0 && <div className="bg-[repeating-linear-gradient(45deg,#cbd5e1_0_3px,#f1f5f9_3px_6px)]" style={{ width: `${(i.outOfService / i.quantity) * 100}%` }} />}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {over ? <span className="font-medium text-rose-700">⛔ {peak} demandés pour {u}</span> : peak ? `${peak}/${u} au plus fort` : `${u} libre${u > 1 ? "s" : ""}`}
                            {i.outOfService > 0 && `, ${i.outOfService} en réparation`}
                          </div>
                        </div>
                        <div className="flex min-w-0 gap-1.5 overflow-x-auto">
                          {i.bookings.length === 0 ? <span className="text-xs text-slate-400">Aucune sortie prévue</span> : i.bookings.map((b) => {
                            const t: Tone = usedAround(i, b) > u ? "over" : b.status === "CONFIRME" ? "ok" : "option";
                            return (
                              <Link key={b.dossierId} href={`/prestations/${b.dossierId}#materiel`} title={`${b.client}, ${b.reference}, ${hour(b.start)}`} className={`shrink-0 rounded-lg px-2 py-1 text-xs ring-1 ${TONE[t].cell} ${b === nextB ? "font-semibold" : ""}`}>
                                {dayNum(b.start)} {month(b.start)} <span className="opacity-70">× {b.quantity}</span>
                              </Link>
                            );
                          })}
                        </div>
                        <button onClick={() => setEditing(editing === i.id ? null : i.id)} aria-expanded={editing === i.id} className="justify-self-start text-sm text-link-600 hover:underline md:justify-self-end">{editing === i.id ? "Fermer" : "Modifier"}</button>
                      </div>
                      {editing === i.id && (
                        <form action={async (f) => { await save(i.id, f); setEditing(null); }} className="grid gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:grid-cols-[1fr_170px_90px_110px_1fr] sm:items-end">
                          <label className="block"><span className="label">Désignation</span><input name="name" defaultValue={i.name} className="input" /></label>
                          <label className="block"><span className="label">Catégorie</span><select name="category" defaultValue={i.category} className="input">{cats.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
                          <label className="block"><span className="label">Quantité</span><input name="quantity" type="number" min={0} defaultValue={i.quantity} className="input" /></label>
                          <label className="block"><span className="label">En réparation</span><input name="outOfService" type="number" min={0} max={i.quantity} defaultValue={i.outOfService} className="input" /></label>
                          <label className="block"><span className="label">Notes</span><input name="notes" defaultValue={i.notes ?? ""} className="input" /></label>
                          <label className="block"><span className="label">Location / jour (€ HT)</span><input name="dailyRate" inputMode="decimal" defaultValue={i.dailyRate ?? ""} placeholder="Ex. 60" className="input" /></label>
                          <label className="block"><span className="label">Valeur de remplacement (€)</span><input name="replacementValue" inputMode="decimal" defaultValue={i.replacementValue ?? ""} placeholder="Ex. 900" className="input" /></label>
                          <div className="flex items-center gap-3 sm:col-span-5">
                            <button className="btn-primary">Enregistrer</button>
                            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Annuler</button>
                            <button type="button" onClick={() => confirm(`Supprimer « ${i.name} » du parc ? Ses réservations seront retirées des prestations.`) && remove(i.id)} className="ml-auto text-sm text-rose-600 hover:underline">Supprimer du parc</button>
                          </div>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
