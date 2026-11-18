import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EQUIPMENT_CATEGORIES, eventKind } from "@/lib/presta";
import { parisParts, time, TZ } from "@/lib/format";
import { startOfDay, addDays } from "@/lib/tasks";
import { HOLDING_STATUSES } from "@/lib/equipment";
import { deleteEquipment, saveEquipment } from "../catalogue/actions";

export const metadata = { title: "Matériel" };

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const WEEKDAY = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: TZ }).format(d).replace(".", "");
const PERIODS = [[30, "30 jours"], [90, "3 mois"], [180, "6 mois"], [365, "1 an"]] as const;
const MARGIN = 8 * 36e5;

/** Pastille de date (style calendrier). */
function DateBlock({ d, tone }: { d: Date; tone: string }) {
  const p = parisParts(d);
  return (
    <div className={`flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-md border text-center ${tone}`}>
      <div className="w-full bg-current/10 py-0.5 text-[9px] font-semibold uppercase">{MONTHS[p.m - 1]}</div>
      <div className="text-lg leading-6 font-bold">{p.d}</div>
      <div className="pb-0.5 text-[9px] uppercase opacity-70">{WEEKDAY(d)}</div>
    </div>
  );
}

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ jours?: string; tout?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const days = PERIODS.some(([n]) => String(n) === sp.jours) ? Number(sp.jours) : 90;
  const from = startOfDay();
  const to = addDays(from, days);
  const items = await db.equipment.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      bookings: {
        where: { dossier: { status: { in: HOLDING_STATUSES }, eventStart: { gte: from, lt: to } } },
        include: { dossier: { select: { id: true, reference: true, title: true, status: true, eventType: true, eventStart: true, eventEnd: true, venueCity: true, client: { select: { name: true } } } } },
      },
    },
  });

  type Item = (typeof items)[number];
  type Booking = Item["bookings"][number];
  /** Quantité totale sortie sur le créneau de cette réservation (chevauchements compris). */
  const usedAround = (i: Item, b: Booking) => {
    const s0 = b.dossier.eventStart!.getTime() - MARGIN, e0 = (b.dossier.eventEnd ?? b.dossier.eventStart!).getTime() + MARGIN;
    return i.bookings.filter((x) => x.dossier.eventStart!.getTime() < e0 && (x.dossier.eventEnd ?? x.dossier.eventStart!).getTime() > s0).reduce((a, x) => a + x.quantity, 0);
  };
  const tone = (i: Item, b: Booking) => (usedAround(i, b) > i.quantity ? "over" : b.dossier.status === "CONFIRME" ? "ok" : "option");
  const TONE = {
    over: "border-rose-400 bg-rose-50 text-rose-700",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
    option: "border-amber-300 bg-amber-50 text-amber-800",
    full: "border-violet-300 bg-violet-50 text-violet-800",
  };

  for (const i of items) i.bookings.sort((a, b) => +a.dossier.eventStart! - +b.dossier.eventStart!);
  // une alerte par matériel et par jour, avec toutes les prestations concernées
  const alerts = [...new Map(items.flatMap((i) => i.bookings.filter((b) => tone(i, b) === "over").map((b) => [`${i.id}|${parisParts(b.dossier.eventStart!).key}`, { i, b, all: i.bookings.filter((x) => parisParts(x.dossier.eventStart!).key === parisParts(b.dossier.eventStart!).key) }] as const))).values()];

  // colonnes du planning : une par jour où au moins un matériel sort
  const dayKey = (d: Date) => parisParts(d).key;
  const cols = [...new Map(items.flatMap((i) => i.bookings).map((b) => [dayKey(b.dossier.eventStart!), b.dossier.eventStart!])).entries()].sort((a, b) => +a[1] - +b[1]);
  const rows = sp.tout ? items.filter((i) => i.active) : items.filter((i) => i.bookings.length);
  const qs = (p: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ jours: String(days), tout: sp.tout, ...p }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parc matériel"
        subtitle="Planning des sorties et inventaire. Les prestations en option ou confirmées immobilisent le matériel (8 h de marge pour l'installation et le démontage)."
        actions={<div className="flex gap-1">{PERIODS.map(([n, l]) => <Link key={n} href={qs({ jours: String(n) })} className={`badge px-3 py-1.5 ${n === days ? "bg-slate-800 text-white" : "border border-slate-200 bg-white"}`}>{l}</Link>)}</div>}
      />

      {alerts.length > 0 && (
        <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <b>⛔ {alerts.length} surréservation(s) à corriger :</b>
          <ul className="mt-1 list-disc pl-5">{alerts.map(({ i, b, all }) => <li key={i.id + b.dossierId}><b>{i.name}</b> le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: TZ }).format(b.dossier.eventStart!)} : {usedAround(i, b)} demandé(s) pour {i.quantity} en stock — {all.map((x, k) => <span key={x.dossierId}>{k > 0 && ", "}<Link href={`/prestations/${x.dossier.id}#materiel`} className="underline">{x.dossier.reference} {x.dossier.title} ({x.quantity})</Link></span>)}</li>)}</ul>
        </div>
      )}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Planning des sorties <span className="text-sm font-normal text-slate-500">— {cols.length} date(s)</span></h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-100" /> confirmée</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-amber-300 bg-amber-100" /> option</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-violet-300 bg-violet-100" /> stock entièrement sorti</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-rose-400 bg-rose-100" /> surréservé</span>
            <Link href={qs({ tout: sp.tout ? "" : "1" })} className="text-link-600 hover:underline">{sp.tout ? "Masquer le matériel libre" : "Afficher tout le parc"}</Link>
          </div>
        </div>
        {cols.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucune sortie de matériel prévue sur cette période.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-48 border-b border-slate-200 bg-white px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Matériel</th>
                  {cols.map(([k, d]) => {
                    const evs = [...new Map(items.flatMap((i) => i.bookings).filter((b) => dayKey(b.dossier.eventStart!) === k).map((b) => [b.dossier.id, b.dossier])).values()];
                    return (
                      <th key={k} className="border-b border-l border-slate-200 bg-white px-2 py-2 align-top font-normal">
                        <div className="flex flex-col items-center gap-1">
                          <DateBlock d={d} tone="border-slate-200 text-slate-700" />
                          {evs.map((e) => <Link key={e.id} href={`/prestations/${e.id}#materiel`} title={`${e.title} — ${e.client.name}`} className={`max-w-28 truncate rounded px-1 text-[10px] ${e.status === "CONFIRME" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{eventKind(e.eventType).icon} {e.reference}</Link>)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2"><div className="font-medium">{i.name}</div><div className="text-xs text-slate-500">stock {i.quantity}</div></td>
                    {cols.map(([k]) => {
                      const bs = i.bookings.filter((b) => dayKey(b.dossier.eventStart!) === k);
                      if (!bs.length) return <td key={k} className="border-b border-l border-slate-100 text-center text-xs text-slate-300">—</td>;
                      const used = Math.max(...bs.map((b) => usedAround(i, b)));
                      const t = bs.some((b) => tone(i, b) === "over") ? "over" : used >= i.quantity ? "full" : bs.every((b) => b.dossier.status === "CONFIRME") ? "ok" : "option";
                      return (
                        <td key={k} className="border-b border-l border-slate-100 p-1 text-center">
                          <Link href={`/prestations/${bs[0].dossier.id}#materiel`} title={bs.map((b) => `${b.quantity} × ${b.dossier.reference} ${b.dossier.title}`).join("\n")} className={`block rounded-md border px-1 py-1 font-semibold tabular-nums ${TONE[t]}`}>
                            {t === "over" ? "⛔ " : ""}{used}/{i.quantity}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form action={saveEquipment.bind(null, null)} className="card grid gap-2 p-5 sm:grid-cols-[1fr_170px_90px_1fr_auto]">
        <input name="name" required placeholder="Ex. Enceinte 15&quot; 1200 W" className="input" />
        <select name="category" className="input">{EQUIPMENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <input name="quantity" type="number" min={0} defaultValue={1} className="input" />
        <input name="notes" placeholder="Notes (n° de série, état…)" className="input" />
        <button className="btn-primary">Ajouter au parc</button>
      </form>

      {EQUIPMENT_CATEGORIES.map((cat) => {
        const list = items.filter((i) => i.category === cat.id);
        if (!list.length) return null;
        return (
          <section key={cat.id} className="card">
            <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">{cat.label}</h2>
            <ul className="divide-y divide-slate-100">
              {list.map((i) => {
                const next = i.bookings[0];
                const hasOver = i.bookings.some((b) => tone(i, b) === "over");
                const status = hasOver ? { l: "⛔ Surréservé", c: "bg-rose-100 text-rose-700" } : next ? { l: `● Réservé — prochaine sortie le ${parisParts(next.dossier.eventStart!).d} ${MONTHS[parisParts(next.dossier.eventStart!).m - 1]}`, c: "bg-amber-100 text-amber-800" } : { l: "● Libre", c: "bg-emerald-100 text-emerald-700" };
                return (
                  <li key={i.id} className={`px-5 py-4 ${hasOver ? "bg-rose-50/40" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="min-w-0"><div className="font-medium">{i.name}</div><div className="text-xs text-slate-500">stock {i.quantity}{i.notes ? ` · ${i.notes}` : ""}</div></div>
                        <span className={`badge ${status.c}`}>{status.l}</span>
                      </div>
                      <details className="text-sm">
                        <summary className="cursor-pointer text-link-600">Modifier</summary>
                        <form action={saveEquipment.bind(null, i.id)} className="mt-2 grid items-center gap-2 sm:grid-cols-[1fr_160px_80px_1fr_auto_auto]">
                          <input name="name" defaultValue={i.name} className="input" />
                          <select name="category" defaultValue={i.category} className="input">{EQUIPMENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                          <input name="quantity" type="number" min={0} defaultValue={i.quantity} className="input" />
                          <input name="notes" defaultValue={i.notes ?? ""} className="input" />
                          <button className="btn-secondary py-1.5 text-xs">OK</button>
                          <button formAction={deleteEquipment.bind(null, i.id)} className="text-xs text-slate-400 hover:text-rose-600">Supprimer</button>
                        </form>
                      </details>
                    </div>
                    {i.bookings.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {i.bookings.map((b) => {
                          const t = tone(i, b);
                          const used = usedAround(i, b);
                          return (
                            <Link key={b.dossierId} href={`/prestations/${b.dossier.id}#materiel`} className={`flex shrink-0 items-center gap-2 rounded-lg border p-1.5 pr-3 hover:shadow-sm ${TONE[t]}`}>
                              <DateBlock d={b.dossier.eventStart!} tone="border-current/30 bg-white" />
                              <div className="text-xs leading-tight">
                                <div className="font-semibold">{t === "over" ? "⛔ " : ""}{b.quantity} réservé(s){used !== b.quantity ? ` · ${used}/${i.quantity} sortis` : ` / ${i.quantity}`}</div>
                                <div className="max-w-44 truncate">{eventKind(b.dossier.eventType).icon} {b.dossier.client.name}</div>
                                <div className="opacity-70">{time(b.dossier.eventStart!)}{b.dossier.venueCity ? ` · ${b.dossier.venueCity}` : ""} · {b.dossier.status === "CONFIRME" ? "confirmée" : "option"}</div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
