"use client";
import { useState, useTransition } from "react";
import { toast } from "@/lib/toast";

type Item = { id: string; label: string; description: string | null; unitPrice: number; unit: string; category: string };
type Req = { id: string; label: string; quantity: number; unitPrice: number; status: string; note: string | null };
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const ST: Record<string, [string, string]> = { DEMANDE: ["En attente de validation", "bg-amber-100 text-amber-800"], ACCEPTEE: ["Acceptée", "bg-emerald-100 text-emerald-700"], REFUSEE: ["Non retenue", "bg-slate-100 text-slate-600"] };

/** Options à ajouter à la prestation, côté client. */
export function OptionShop({ items, requests, editable, vatExempt, request, cancel }: {
  items: Item[]; requests: Req[]; editable: boolean; vatExempt: boolean;
  request: (i: { catalogItemId?: string; label?: string; quantity?: number; note?: string }) => Promise<{ error?: string; ok?: boolean }>;
  cancel: (id: string) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const [pending, run] = useTransition();
  const [err, setErr] = useState("");
  const [free, setFree] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const go = (p: Parameters<typeof request>[0], what: string) => run(async () => {
    const r = await request(p); if (r.error) setErr(r.error); else { setErr(""); setFree(""); toast("Demande envoyée", { body: `${what} : nous revenons vers vous rapidement.`, tone: "success" }); }
  });
  const ht = vatExempt ? "" : " HT";
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">Envie d&apos;un petit plus ? Faites votre demande : nous la validons et vous envoyons un devis complémentaire.</p>
      {requests.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1"><b>{r.quantity > 1 ? `${r.quantity} × ` : ""}{r.label}</b>{r.unitPrice > 0 && <span className="text-slate-500"> · {eur(r.unitPrice * r.quantity)}{ht}</span>}{r.note && <span className="block text-xs text-slate-500">{r.note}</span>}</span>
              <span className={`badge ${ST[r.status]?.[1]}`}>{ST[r.status]?.[0] ?? r.status}</span>
              {r.status === "DEMANDE" && editable && <button disabled={pending} onClick={() => run(async () => { await cancel(r.id); })} className="text-xs text-slate-500 hover:text-rose-600">Annuler</button>}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <>
          {items.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((i) => (
                <div key={i.id} className="flex flex-col rounded-xl p-4 ring-1 ring-slate-200">
                  <div className="font-medium">{i.label}</div>
                  {i.description && <p className="mt-1 line-clamp-3 text-sm text-slate-500">{i.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="font-semibold tabular-nums">{eur(i.unitPrice)}{ht}<span className="text-xs font-normal text-slate-500"> / {i.unit}</span></span>
                    <span className="flex items-center gap-1">
                      {i.unit !== "forfait" && <input type="number" min={1} value={qty[i.id] ?? 1} onChange={(e) => setQty({ ...qty, [i.id]: Number(e.target.value) })} className="input w-16 py-1" aria-label={`Quantité ${i.label}`} />}
                      <button disabled={pending} onClick={() => go({ catalogItemId: i.id, quantity: qty[i.id] ?? 1 }, i.label)} className="btn-primary py-1.5 text-sm">Demander</button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/60">
            <label className="block"><span className="label">Autre demande</span>
              <div className="flex gap-2"><input value={free} onChange={(e) => setFree(e.target.value)} maxLength={200} placeholder="Une heure de plus, une machine à fumée, une animation enfants…" className="input" />
                <button disabled={pending || !free.trim()} onClick={() => go({ label: free }, free)} className="btn-secondary shrink-0">Envoyer</button></div>
            </label>
          </div>
        </>
      ) : <p className="text-sm text-slate-500">Les demandes en ligne sont closes : contactez-nous directement.</p>}
      {err && <p role="alert" className="text-sm font-medium text-rose-700">⛔ {err}</p>}
    </div>
  );
}
