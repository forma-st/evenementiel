"use client";
import { useState, useTransition } from "react";
import { applySuggestion, loadSuggestion } from "@/app/(staff)/prestations/gear-suggest-actions";
import type { Suggestion } from "@/lib/gearSuggest";
import { toast } from "@/lib/toast";

/** « ✨ Proposer le matériel » : liste pré-remplie, quantités modifiables, validation en un clic. */
export function GearSuggest({ dossierId, highlight }: { dossierId: string; highlight: boolean }) {
  const [list, setList] = useState<(Suggestion & { on: boolean })[] | null>(null);
  const [pending, run] = useTransition();
  const open = () => run(async () => { const s = await loadSuggestion(dossierId); setList(s.map((x) => ({ ...x, on: x.qty > 0 && x.qty !== x.current }))); });
  const set = (id: string, p: Partial<Suggestion & { on: boolean }>) => setList((l) => l!.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const apply = () => run(async () => {
    const r = await applySuggestion(dossierId, list!.filter((x) => x.on).map((x) => ({ id: x.id, qty: x.qty })));
    toast("Matériel réservé", { body: `${r.ok} article(s)${r.skipped.length ? ` · limité par le stock : ${r.skipped.join(", ")}` : ""}`, tone: "success" });
    setList(null);
  });

  if (!list) return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ${highlight ? "bg-brand-50 ring-1 ring-brand-100" : ""}`}>
      <button type="button" onClick={open} disabled={pending} className={highlight ? "btn-primary" : "btn-secondary py-1.5 text-sm"}>{pending ? "Calcul…" : "✨ Proposer le matériel"}</button>
      {highlight && <span className="text-sm text-slate-600">D&apos;après les prestations cochées, le type d&apos;événement, le nombre d&apos;invités et les options du devis.</span>}
    </div>
  );
  return (
    <div className="space-y-3 rounded-xl p-3 ring-2 ring-brand-200">
      <div className="flex items-center justify-between"><h3 className="font-medium">✨ Matériel proposé</h3><button type="button" onClick={() => setList(null)} className="text-sm text-slate-500 hover:text-ink">Fermer</button></div>
      {list.length === 0 ? <p className="text-sm text-slate-500">Rien à proposer : cochez les prestations (DJ, sono…) dans « Modifier », ou réglez la « proposition automatique » des articles dans Matériel › Modifier.</p> : (
        <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {list.map((x) => (
            <li key={x.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${x.on ? "" : "opacity-60"}`}>
              <input type="checkbox" checked={x.on} onChange={(e) => set(x.id, { on: e.target.checked })} className="h-4 w-4 accent-brand-600" aria-label={`Réserver ${x.name}`} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{x.name}{x.brand && <span className="ml-1 text-xs font-normal text-slate-500">{x.brand}</span>}</div>
                <div className="text-xs text-slate-500">{x.why}{x.current ? ` · déjà réservé : ${x.current}` : ""}{x.qty < x.wanted && <span className="font-medium text-amber-700"> · {x.wanted} conseillé(s), {x.available} libre(s)</span>}</div>
              </div>
              <input type="number" min={0} max={x.available} value={x.qty} onChange={(e) => set(x.id, { qty: Math.max(0, Math.min(x.available, Number(e.target.value) || 0)), on: true })} className="input w-16 py-1 text-center" aria-label={`Quantité ${x.name}`} />
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && <button type="button" onClick={apply} disabled={pending || !list.some((x) => x.on)} className="btn-primary">{pending ? "Réservation…" : `Valider et réserver (${list.filter((x) => x.on).length})`}</button>}
    </div>
  );
}
