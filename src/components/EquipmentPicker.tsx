"use client";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type { Availability } from "@/lib/equipment";
import type { EquipmentState } from "@/app/(staff)/actions";

const CAT: Record<string, string> = { SONO: "Sonorisation", DJ: "Régie DJ", LUMIERE: "Éclairage", PHOTO: "Photo / vidéo", STRUCTURE: "Structures / scène", AUTRE: "Autre" };

/** Réservation du matériel : options indisponibles ou déjà ajoutées bloquées, quantité plafonnée au stock libre. */
export function EquipmentPicker({ items, action, remove, dated }: {
  items: Availability[];
  action: (s: EquipmentState, f: FormData) => Promise<EquipmentState>;
  remove: (equipmentId: string) => Promise<void>;
  dated: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  const [, start] = useTransition();
  const [sel, setSel] = useState("");
  const [qty, setQty] = useState(1);
  const reserved = items.filter((i) => i.mine > 0);
  const current = items.find((i) => i.id === sel);
  const max = current ? current.available : 0;
  const tooMany = !!current && qty > max;
  const groups = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  useEffect(() => { if (state?.ok) { setSel(""); setQty(1); } }, [state]);

  return (
    <div className="space-y-3">
      {reserved.some((r) => r.overbooked) && (
        <div role="alert" className="rounded-lg border-2 border-rose-500 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="font-semibold">⛔ Matériel en surréservation sur ce créneau</div>
          <ul className="mt-1 list-disc pl-5">
            {reserved.filter((r) => r.overbooked).map((r) => (
              <li key={r.id}>{r.name} : {r.mine} demandé(s), {r.stock - r.elsewhere < 0 ? 0 : r.stock - r.elsewhere} libre(s) sur {r.stock} — aussi pris par {r.conflicts.map((c) => <a key={c.dossierId} href={`/prestations/${c.dossierId}`} className="underline">{c.reference}</a>)}</li>
            ))}
          </ul>
          <div className="mt-1 text-xs">Réduisez la quantité, changez de matériel ou louez un complément.</div>
        </div>
      )}

      {reserved.length === 0 ? <p className="text-sm text-slate-500">Aucun matériel affecté.</p> : (
        <ul className="space-y-1.5 text-sm">
          {reserved.map((r) => (
            <li key={r.id} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${r.overbooked ? "bg-rose-50" : ""}`}>
              <form action={run} className="flex min-w-0 items-center gap-2">
                <input type="hidden" name="equipmentId" value={r.id} />
                <input type="hidden" name="mode" value="update" />
                <input name="quantity" type="number" min={0} max={r.stock} defaultValue={r.mine} className="input w-16 py-1" onBlur={(e) => { if (Number(e.target.value) !== r.mine) e.target.form?.requestSubmit(); }} />
                <span className="truncate">× {r.name}</span>
              </form>
              <span className={`shrink-0 text-xs ${r.overbooked ? "font-semibold text-rose-700" : "text-slate-400"}`}>{r.overbooked ? "⛔ stock dépassé" : `stock ${r.stock}`}</span>
              <button type="button" onClick={() => start(() => remove(r.id))} className="shrink-0 text-xs text-slate-400 hover:text-rose-600" title="Retirer">✕</button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <form action={run} className="space-y-2">
          <input type="hidden" name="mode" value="add" />
          <div className="flex gap-2">
            <select name="equipmentId" value={sel} onChange={(e) => { setSel(e.target.value); setQty(1); }} className="input text-sm">
              <option value="">+ Ajouter du matériel…</option>
              {groups.map((g) => (
                <optgroup key={g} label={CAT[g] ?? g}>
                  {items.filter((i) => i.category === g).map((i) => (
                    <option key={i.id} value={i.id} disabled={i.mine > 0 || i.available === 0}>
                      {i.name} — {i.mine > 0 ? "déjà ajouté" : i.available === 0 ? "indisponible ce jour" : `${i.available} dispo / ${i.stock}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input name="quantity" type="number" min={1} max={max || undefined} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={`input w-16 ${tooMany ? "border-rose-500 ring-2 ring-rose-200" : ""}`} />
            <button className="btn-secondary" disabled={!sel || tooMany || pending}>{pending ? "…" : "Ajouter"}</button>
          </div>
          {tooMany && <p className="text-xs font-medium text-rose-700">⛔ {max} disponible(s) seulement sur ce créneau.</p>}
          {current && current.conflicts.length > 0 && !tooMany && <p className="text-xs text-amber-700">Déjà pris ce jour-là : {current.conflicts.map((c) => `${c.quantity} par ${c.reference}`).join(", ")}.</p>}
        </form>
      )}
      {state?.error && <div role="alert" className="rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">⛔ {state.error}</div>}
      {state?.ok && <p className="text-xs text-emerald-700">✓ {state.ok}</p>}
      {!dated && <p className="text-xs text-amber-700">Sans date, la disponibilité ne peut pas être vérifiée.</p>}
    </div>
  );
}
