import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { gearTracking } from "@/lib/gearTracking";
import { parisParts, TZ } from "@/lib/format";

export const metadata = { title: "Préparations" };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#102a5c" };

const inDays = (iso: string) => Math.round((Date.parse(parisParts(new Date(iso)).key) - Date.parse(parisParts(new Date()).key)) / 864e5);

/** Accueil « dépôt » sur téléphone : les préparations à venir, en grosses cartes. */
export default async function PrepIndex() {
  await requireStaff();
  const { toPrepare, out } = await gearTracking(21);
  return (
    <div className="mx-auto min-h-screen max-w-2xl">
      <header className="nav-navy px-4 pt-4 pb-5">
        <Link href="/" className="text-sm opacity-80">← Tableau de bord</Link>
        <h1 className="mt-2 text-2xl font-semibold">📋 Préparation du matériel</h1>
        <p className="text-sm opacity-80">Touchez une prestation pour cocher son matériel.</p>
      </header>
      <div className="space-y-3 p-4">
        {toPrepare.length === 0 && <p className="py-10 text-center text-slate-500">Rien à préparer dans les 3 prochaines semaines.</p>}
        {toPrepare.map((r) => {
          const n = inDays(r.start);
          const ready = r.hasList && r.total > 0 && r.done === r.total;
          const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
          return (
            <Link key={r.id} href={`/preparer/${r.id}`} className="card block p-4 active:scale-[.99]">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${n <= 1 ? "bg-amber-100 text-amber-800" : "bg-brand-50 text-brand-700"}`}>{n <= 0 ? "Aujourd'hui" : n === 1 ? "Demain" : `J-${n}`}</span>
                <span className={`text-sm font-medium ${ready ? "text-emerald-700" : "text-slate-500"}`}>{ready ? "✓ prêt" : r.hasList ? `${r.done}/${r.total}` : "liste à créer"}</span>
              </div>
              <div className="mt-2 text-lg font-semibold">{r.icon} {r.title}</div>
              <div className="text-sm text-slate-500 first-letter:uppercase">{new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(r.start))} · {r.units} unité{r.units > 1 ? "s" : ""}</div>
              {r.hasList && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${ready ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} /></div>}
            </Link>
          );
        })}
        {out.length > 0 && (
          <>
            <h2 className="pt-4 text-sm font-semibold text-slate-500">Matériel dehors</h2>
            {out.map((r) => (
              <Link key={r.id} href={`/prestations/${r.id}`} className={`card block p-4 ${r.late ? "ring-2 ring-rose-400" : ""}`}>
                <div className="font-semibold">{r.icon} {r.title}</div>
                <div className={`text-sm ${r.late ? "font-medium text-rose-700" : "text-slate-500"}`}>{r.late ? "Retour en retard" : "Retour prévu"} : {new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(r.end))}</div>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
