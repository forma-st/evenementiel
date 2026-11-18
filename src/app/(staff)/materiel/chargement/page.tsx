import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fromParis, time, TZ } from "@/lib/format";
import { EQUIPMENT_CATEGORIES, eventKind, servicesLabel } from "@/lib/presta";
import { HOLDING_STATUSES } from "@/lib/equipment";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Liste de chargement" };

/** Liste de chargement d'une journée : tout ce qui sort, prestation par prestation, à cocher (imprimable). */
export default async function LoadingList({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : new Date().toISOString().slice(0, 10);
  const start = fromParis(day, "00:00");
  const end = new Date(start.getTime() + 864e5);
  const dossiers = await db.dossier.findMany({
    where: { status: { in: HOLDING_STATUSES }, eventStart: { gte: start, lt: end } },
    include: { client: true, assignee: true, equipment: { include: { equipment: true } } },
    orderBy: { eventStart: "asc" },
  });
  const label = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: TZ }).format(start);
  const shift = (n: number) => new Date(start.getTime() + n * 864e5 + 12 * 36e5).toISOString().slice(0, 10);
  const catOrder = EQUIPMENT_CATEGORIES.map((c) => c.id as string);
  const totals = new Map<string, { name: string; category: string; qty: number }>();
  for (const d of dossiers) for (const e of d.equipment) {
    const t = totals.get(e.equipmentId) ?? { name: e.equipment.name, category: e.equipment.category, qty: 0 };
    t.qty += e.quantity;
    totals.set(e.equipmentId, t);
  }
  const summary = [...totals.values()].sort((a, b) => catOrder.indexOf(a.category) - catOrder.indexOf(b.category) || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/materiel" className="text-sm text-slate-500 hover:text-slate-800">← Matériel</Link>
        <div className="flex items-center gap-2">
          <Link href={`?date=${shift(-1)}`} className="btn-secondary px-2.5" aria-label="Jour précédent">‹</Link>
          <Link href={`?date=${shift(1)}`} className="btn-secondary px-2.5" aria-label="Jour suivant">›</Link>
          <PrintButton />
        </div>
      </div>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight first-letter:uppercase">{label}</h1>
        <p className="mt-1 text-slate-600">{dossiers.length ? `Liste de chargement : ${dossiers.length} prestation${dossiers.length > 1 ? "s" : ""}, ${summary.reduce((a, s) => a + s.qty, 0)} unités.` : "Aucune prestation avec du matériel ce jour-là."}</p>
      </header>

      {summary.length > 0 && (
        <section className="card p-5 print:border-0 print:p-0 print:shadow-none">
          <h2 className="mb-3 font-semibold">Total à charger</h2>
          <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {summary.map((s) => (
              <li key={s.name} className="flex items-center gap-3 text-sm">
                <span className="h-4 w-4 shrink-0 rounded border-2 border-slate-400" aria-hidden />
                <span className="w-8 text-right font-semibold tabular-nums">{s.qty}</span>
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dossiers.map((d) => (
        <section key={d.id} className="card break-inside-avoid p-5 print:border print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{eventKind(d.eventType).icon} {d.title}</h2>
              <p className="text-sm text-slate-600">{d.client.name}{d.client.phone ? `, ${d.client.phone}` : ""}</p>
            </div>
            <div className="text-right text-sm">
              <div className="font-medium">{d.setupTime ? `Installation ${d.setupTime}` : `Début ${time(d.eventStart!)}`}</div>
              <div className="text-slate-500">{d.status === "CONFIRME" ? "Confirmée" : "En option"}{d.assignee ? `, ${d.assignee.name}` : ""}</div>
            </div>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-slate-500">Lieu : </dt><dd className="inline">{[d.venueName, d.venueAddress, d.venueCity].filter(Boolean).join(", ") || "à préciser"}</dd></div>
            <div><dt className="inline text-slate-500">Horaires : </dt><dd className="inline">{time(d.eventStart!)}{d.eventEnd ? ` à ${time(d.eventEnd)}` : ""}</dd></div>
            {d.venueContact && <div><dt className="inline text-slate-500">Contact sur place : </dt><dd className="inline">{d.venueContact}</dd></div>}
            {d.services && <div><dt className="inline text-slate-500">Prestations : </dt><dd className="inline">{servicesLabel(d.services)}</dd></div>}
          </dl>
          {d.equipment.length === 0 ? <p className="mt-3 text-sm text-amber-700">Aucun matériel affecté. <Link href={`/prestations/${d.id}#materiel`} className="underline print:no-underline">Ajouter du matériel</Link></p> : (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {d.equipment.sort((a, b) => catOrder.indexOf(a.equipment.category) - catOrder.indexOf(b.equipment.category) || a.equipment.name.localeCompare(b.equipment.name)).map((e) => (
                <li key={e.equipmentId} className="flex items-center gap-3 py-2 text-sm">
                  <span className="h-4 w-4 shrink-0 rounded border-2 border-slate-400" aria-hidden />
                  <span className="w-8 text-right font-semibold tabular-nums">{e.quantity}</span>
                  <span className="flex-1">{e.equipment.name}</span>
                  <span className="text-xs text-slate-400">retour ☐</span>
                </li>
              ))}
            </ul>
          )}
          {d.description && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-600 print:bg-white print:p-0">{d.description}</p>}
        </section>
      ))}
    </div>
  );
}
