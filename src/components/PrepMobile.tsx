"use client";
import Link from "next/link";
import { useEffect, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncPrepList, togglePrepItem } from "@/app/(staff)/prestations/prep-actions";
import type { PrepItem } from "@/lib/prep";

const CAT: Record<string, string> = { SONO: "🔊 Sonorisation", DJ: "🎛 Régie DJ", LUMIERE: "💡 Éclairage", PHOTO: "📷 Photo / vidéo", STRUCTURE: "🏗 Structures / scène", AUTRE: "📦 Autre" };

/** Liste à cocher plein écran, pensée pour le téléphone ou la tablette au dépôt. */
export function PrepMobile({ dossierId, items: initial, hasList, hasEquipment, outdated }: { dossierId: string; items: PrepItem[]; hasList: boolean; hasEquipment: boolean; outdated: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, toggle] = useOptimistic(initial, (s, { id, done }: { id: string; done: boolean }) => s.map((i) => (i.id === id ? { ...i, done } : i)));
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const cats = [...new Set(items.map((i) => i.category))];
  const todo = items.filter((i) => !i.done);

  // à plusieurs sur le chargement : la liste se met à jour toute seule
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [router]);

  const tap = (i: PrepItem) => start(async () => {
    toggle({ id: i.id, done: !i.done });
    if (!i.done) navigator.vibrate?.(15);
    await togglePrepItem(dossierId, i.id, !i.done);
  });

  if (!hasList) return (
    <div className="space-y-4 p-4 text-center">
      <p className="text-slate-600">{hasEquipment ? "La liste de préparation n'existe pas encore." : "Aucun matériel n'est réservé pour cette prestation."}</p>
      {hasEquipment && <button disabled={pending} onClick={() => start(() => syncPrepList(dossierId))} className="btn-primary w-full py-4 text-base">Créer la liste maintenant</button>}
      <Link href={`/prestations/${dossierId}#materiel`} className="block text-sm text-link-600">Ouvrir la fiche de la prestation</Link>
    </div>
  );

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <span className={`text-lg font-semibold ${pct === 100 ? "text-emerald-700" : ""}`}>{pct === 100 ? "✓ Tout est prêt" : `${done} / ${items.length} préparés`}</span>
          <span className="text-sm tabular-nums text-slate-500">{pct} %</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} /></div>
        {todo.length > 0 && todo.length <= 3 && <p className="mt-1.5 truncate text-xs text-slate-500">Reste : {todo.map((i) => `${i.qty} × ${i.name}`).join(", ")}</p>}
      </div>
      {outdated && <p className="m-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Le matériel réservé a changé. <button onClick={() => start(() => syncPrepList(dossierId))} className="font-semibold underline">Mettre à jour la liste</button></p>}
      <div className="space-y-5 p-4">
        {cats.map((c) => (
          <section key={c}>
            <h2 className="mb-2 text-sm font-semibold text-slate-500">{CAT[c] ?? c}</h2>
            <ul className="space-y-2">
              {items.filter((i) => i.category === c).map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => tap(i)} aria-pressed={i.done}
                    className={`flex min-h-16 w-full items-center gap-4 rounded-2xl px-4 py-3 text-left ring-1 transition active:scale-[.98] ${i.done ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200"}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${i.done ? "bg-emerald-500 text-white" : "ring-2 ring-slate-300"}`} aria-hidden>{i.done ? "✓" : ""}</span>
                    <span className="w-10 shrink-0 text-xl font-bold tabular-nums">{i.qty}×</span>
                    <span className={`flex-1 text-base ${i.done ? "text-slate-500 line-through" : "font-medium"}`}>{i.name}</span>
                    {i.done && i.doneBy && <span className="shrink-0 text-xs text-slate-400">{i.doneBy.split(" ")[0]}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
