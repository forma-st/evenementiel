"use client";
import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; category: string; stock: number; available: number; conflicts: string[] };
const CAT: Record<string, string> = { SONO: "🔊 Sonorisation", DJ: "🎛 Régie DJ", LUMIERE: "💡 Éclairage", PHOTO: "📷 Photo / vidéo", STRUCTURE: "🏗 Structures / scène", AUTRE: "📦 Autre" };

/** Choix du matériel dès la création d'une location ou d'un prêt, avec la disponibilité sur les dates saisies. */
export function GearPicker({ date, start, endDate, endTime }: { date: string; start: string; endDate: string; endTime: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!date) { setItems(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/materiel/dispo?${new URLSearchParams({ date, debut: start, fin: endDate || date, heureFin: endTime })}`).then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(t);
  }, [date, start, endDate, endTime]);

  const chosen = Object.entries(qty).filter(([, n]) => n > 0);
  const over = chosen.filter(([id, n]) => n > (items?.find((i) => i.id === id)?.available ?? 0));
  const list = useMemo(() => (items ?? []).filter((i) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())), [items, q]);
  const cats = [...new Set(list.map((i) => i.category))];
  const set = (id: string, n: number, max: number) => setQty((x) => ({ ...x, [id]: Math.max(0, Math.min(max, Math.round(n) || 0)) }));

  return (
    <div className="space-y-3">
      <input type="hidden" name="equipment" value={JSON.stringify(chosen.map(([id, n]) => ({ id, qty: n })))} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label mb-0">Matériel {chosen.length > 0 && <span className="font-normal text-slate-500">— {chosen.reduce((a, [, n]) => a + n, 0)} unité(s) choisie(s)</span>}</span>
        {items && items.length > 6 && <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Rechercher" className="input w-48 py-1.5" />}
      </div>
      {!date ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Indiquez la date de sortie pour voir le matériel disponible.</p>
        : items === null ? <p className="text-sm text-slate-500">Vérification des disponibilités…</p>
        : items.length === 0 ? <p className="text-sm text-slate-500">Aucun matériel dans le parc. Ajoutez-le dans Matériel.</p>
        : (
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {cats.map((c) => (
              <div key={c}>
                <div className="mb-1 text-xs font-medium text-slate-500">{CAT[c] ?? c}</div>
                <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                  {list.filter((i) => i.category === c).map((i) => {
                    const n = qty[i.id] ?? 0;
                    const none = i.available <= 0;
                    return (
                      <li key={i.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${n > 0 ? "bg-brand-50/60" : ""} ${none ? "opacity-60" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{i.name}</div>
                          <div className={`text-xs ${none ? "text-rose-600" : "text-slate-500"}`}>{none ? `indisponible (pris par ${i.conflicts.join(", ")})` : `${i.available} disponible${i.available > 1 ? "s" : ""} sur ${i.stock}`}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" disabled={n <= 0} onClick={() => set(i.id, n - 1, i.available)} className="h-8 w-8 rounded-lg ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-30" aria-label={`Retirer un ${i.name}`}>−</button>
                          <input value={n} onChange={(e) => set(i.id, Number(e.target.value), i.available)} inputMode="numeric" className="input w-12 px-1 py-1.5 text-center tabular-nums" aria-label={`Quantité ${i.name}`} />
                          <button type="button" disabled={none || n >= i.available} onClick={() => set(i.id, n + 1, i.available)} className="h-8 w-8 rounded-lg ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-30" aria-label={`Ajouter un ${i.name}`}>+</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      {over.length > 0 && <p role="alert" className="rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-800">⛔ Les nouvelles dates réduisent la disponibilité : ajustez les quantités en rouge.</p>}
    </div>
  );
}
