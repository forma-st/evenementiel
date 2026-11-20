"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { syncPrepList, togglePrepItem } from "@/app/(staff)/prestations/prep-actions";
import type { PrepList } from "@/lib/prep";

const CAT: Record<string, string> = { SONO: "Sonorisation", DJ: "Régie DJ", LUMIERE: "Éclairage", PHOTO: "Photo / vidéo", STRUCTURE: "Structures / scène", AUTRE: "Autre" };
const when = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Liste de préparation du matériel : à cocher en chargeant, progression, impression. */
export function PrepChecklist({ dossierId, list, outdated, hasEquipment, day, autoDays, qr }: {
  qr?: string; dossierId: string; list: PrepList | null; outdated: boolean; hasEquipment: boolean; day: string | null; autoDays: number | null;
}) {
  const [pending, start] = useTransition();
  const [items, toggle] = useOptimistic(list?.items ?? [], (state, { id, done }: { id: string; done: boolean }) => state.map((i) => (i.id === id ? { ...i, done } : i)));
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const cats = [...new Set(items.map((i) => i.category))];

  return (
    <section id="preparation" className="card scroll-mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">Préparation du matériel</h2>
        {list && (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/preparer/${dossierId}`} className="font-medium text-link-600 hover:underline">📱 Plein écran</Link>
            {day && <Link href={`/materiel/chargement?date=${day}&prestation=${dossierId}`} className="text-link-600 hover:underline">Imprimer</Link>}
            <button disabled={pending} onClick={() => start(() => syncPrepList(dossierId))} className="text-link-600 hover:underline">Actualiser</button>
          </div>
        )}
      </div>

      {!list ? (
        <div className="space-y-3 p-5 text-sm">
          <p className="text-slate-600">{hasEquipment ? "La liste reprend le matériel réservé, à cocher pendant le chargement." : "Réservez d'abord le matériel de la prestation."}{autoDays !== null && autoDays > 3 ? ` Elle sera créée automatiquement à J-3 (dans ${autoDays - 3} jour${autoDays - 3 > 1 ? "s" : ""}).` : ""}</p>
          <button disabled={pending || !hasEquipment} onClick={() => start(() => syncPrepList(dossierId))} className="btn-primary">Créer la liste maintenant</button>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className={pct === 100 ? "font-medium text-emerald-700" : "text-slate-600"}>{pct === 100 ? "✓ Tout est prêt" : `${done} sur ${items.length} préparé${done > 1 ? "s" : ""}`}</span>
              <span className="text-xs text-slate-500">créée le {when(list.createdAt)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          {outdated && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Le matériel réservé a changé depuis la création de la liste. <button onClick={() => start(() => syncPrepList(dossierId))} className="font-medium underline">Mettre à jour</button> (les cases cochées sont conservées).</p>
          )}
          {qr && (
            <details className="rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200/60">
              <summary className="cursor-pointer text-slate-600">📱 Cocher depuis un téléphone ou une tablette</summary>
              <div className="mt-2 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code de la liste de préparation" className="h-32 w-32 rounded bg-[#fff] p-1" />
                <p className="text-xs text-slate-500">Scannez avec l&apos;appareil photo : la liste s&apos;ouvre en grand, à cocher du doigt (connexion avec votre compte). Astuce : « Ajouter à l&apos;écran d&apos;accueil » pour l&apos;avoir comme une appli.</p>
              </div>
            </details>
          )}
          {items.length === 0 && <p className="text-sm text-slate-500">Aucun matériel réservé pour cette prestation.</p>}
          {cats.map((c) => (
            <div key={c}>
              <div className="mb-1 text-xs font-medium text-slate-500">{CAT[c] ?? c}</div>
              <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                {items.filter((i) => i.category === c).map((i) => (
                  <li key={i.id}>
                    <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors ${i.done ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={i.done}
                        onChange={(e) => { const v = e.target.checked; start(async () => { toggle({ id: i.id, done: v }); await togglePrepItem(dossierId, i.id, v); }); }}
                        className="h-5 w-5 shrink-0 accent-emerald-600"
                      />
                      <span className="w-8 text-right font-semibold tabular-nums">{i.qty}</span>
                      <span className={`flex-1 ${i.done ? "text-slate-500 line-through" : ""}`}>{i.name}</span>
                      {i.done && i.doneBy && <span className="text-xs text-slate-400">{i.doneBy}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
