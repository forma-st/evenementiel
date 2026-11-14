"use client";
import { useActionState, useMemo, useState } from "react";
type QuoteFormState = { error?: string } | null;
import { UNITS, totals, type QuoteLine } from "@/lib/quotes";

type Line = QuoteLine & { unit: string; description?: string };
type CatalogOpt = { id: string; category: string; categoryLabel: string; label: string; description: string | null; unit: string; unitPrice: number; vatRate: number };

const empty = (vat: number): Line => ({ label: "", description: "", quantity: 1, unitPrice: 0, vatRate: vat, unit: "forfait" });
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export function QuoteEditor({ action, clients, dossiers, catalog, initial, vatExempt, mode = "quote" }: {
  mode?: "quote" | "invoice";
  action: (s: QuoteFormState, f: FormData) => Promise<QuoteFormState>;
  clients: { id: string; name: string }[];
  dossiers: { id: string; label: string; clientId: string; title: string }[];
  catalog: CatalogOpt[];
  vatExempt: boolean;
  initial?: { label?: string; clientId?: string; dossierId?: string; lines?: Line[]; discount?: number; depositPercent?: number; notes?: string | null; validUntil?: string; dueDate?: string; serviceDate?: string; isNew: boolean };
}) {
  const defVat = vatExempt ? 0 : 20;
  const [state, run, pending] = useActionState(action, null);
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [dossierId, setDossierId] = useState(initial?.dossierId ?? "");
  const [label, setLabel] = useState(initial?.label ?? (dossiers.find((d) => d.id === initial?.dossierId)?.title ?? ""));
  const [lines, setLines] = useState<Line[]>(initial?.lines?.length ? initial.lines : [empty(defVat)]);
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [deposit, setDeposit] = useState(initial?.depositPercent ?? 30);
  const [pick, setPick] = useState("");
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: number) => setLines((ls) => { const c = [...ls]; const [x] = c.splice(i, 1); c.splice(Math.max(0, Math.min(c.length, i + d)), 0, x); return c; });
  const t = useMemo(() => totals(lines, discount), [lines, discount]);
  const total = vatExempt ? t.totalHT : t.totalTTC;
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  const addFromCatalog = (id: string) => {
    const c = catalog.find((x) => x.id === id);
    if (!c) return;
    const line: Line = { label: c.label, description: c.description ?? "", quantity: 1, unitPrice: c.unitPrice, vatRate: vatExempt ? 0 : c.vatRate, unit: c.unit };
    setLines((ls) => (ls.length === 1 && !ls[0].label && !ls[0].unitPrice ? [line] : [...ls, line]));
    setPick("");
  };
  const groups = [...new Set(catalog.map((c) => c.categoryLabel))];

  return (
    <form action={run} className="space-y-6">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">{mode === "invoice" ? "Objet de la facture *" : "Objet du devis *"}</span>
          <input name="label" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder={mode === "invoice" ? "Ex. Mariage du 12 juin — DJ et sonorisation" : "Ex. Mariage de Julie et Thomas — DJ et sonorisation"} className="input" />
        </label>
        <label className="block">
          <span className="label">Client *</span>
          <select name="clientId" required value={clientId} onChange={(e) => { setClientId(e.target.value); setDossierId(""); }} className="input">
            <option value="" disabled>Choisir…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Prestation liée</span>
          <select name="dossierId" value={dossierId} onChange={(e) => { setDossierId(e.target.value); if (!label) setLabel(dossiers.find((d) => d.id === e.target.value)?.title ?? ""); }} className="input">
            <option value="">Aucune</option>
            {dossiers.filter((d) => d.clientId === clientId).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        {mode === "invoice" ? (
          <>
            <label className="block"><span className="label">Date de la prestation</span><input name="serviceDate" type="date" defaultValue={initial?.serviceDate ?? ""} className="input" /></label>
            <label className="block"><span className="label">Échéance de paiement</span><input name="dueDate" type="date" defaultValue={initial?.dueDate ?? new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10)} className="input" /></label>
          </>
        ) : (
          <>
            <label className="block">
              <span className="label">Valable jusqu&apos;au</span>
              <input name="validUntil" type="date" defaultValue={initial?.validUntil ?? in30} className="input" />
            </label>
            <label className="block">
              <span className="label">Acompte à la réservation (%)</span>
              <input name="depositPercent" type="number" min={0} max={100} step="1" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} className="input" />
            </label>
          </>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <select value={pick} onChange={(e) => addFromCatalog(e.target.value)} className="input max-w-md">
            <option value="">➕ Ajouter depuis le catalogue…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {catalog.filter((c) => c.categoryLabel === g).map((c) => <option key={c.id} value={c.id}>{c.label} — {eur(c.unitPrice)}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" onClick={() => setLines((ls) => [...ls, empty(defVat)])} className="btn-secondary">+ Ligne libre</button>
        </div>
        <table className="table min-w-[820px]">
          <thead><tr><th className="w-[42%]">Désignation</th><th>Qté</th><th>Unité</th><th>PU HT</th>{!vatExempt && <th>TVA</th>}<th className="text-right">Total HT</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="align-top">
                <td>
                  <input value={l.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Prestation…" className="input font-medium" />
                  <textarea value={l.description ?? ""} onChange={(e) => set(i, { description: e.target.value })} placeholder="Détail (facultatif)" rows={1} className="input mt-1 text-xs text-slate-600" />
                </td>
                <td><input type="number" min={0} step="any" value={l.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} className="input w-20" /></td>
                <td>
                  <select value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} className="input w-28">
                    {UNITS.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
                  </select>
                </td>
                <td><input type="number" step="0.01" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} className="input w-28" /></td>
                {!vatExempt && (
                  <td>
                    <select value={l.vatRate} onChange={(e) => set(i, { vatRate: Number(e.target.value) })} className="input w-24">
                      {[20, 10, 5.5, 2.1, 0].map((r) => <option key={r} value={r}>{r} %</option>)}
                    </select>
                  </td>
                )}
                <td className="pt-5 text-right font-medium whitespace-nowrap">{eur(l.quantity * l.unitPrice)}</td>
                <td className="pt-4 whitespace-nowrap text-slate-400">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 hover:text-slate-700 disabled:opacity-30" title="Monter">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === lines.length - 1} className="px-1 hover:text-slate-700 disabled:opacity-30" title="Descendre">↓</button>
                  {lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="px-1 hover:text-rose-600" title="Supprimer">✕</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-start justify-between gap-6 border-t border-slate-100 p-4">
          <label className="block w-full max-w-md">
            <span className="label">{mode === "invoice" ? "Mentions complémentaires" : "Conditions particulières"}</span>
            <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} className="input" placeholder="Ex. Repas prestataire à prévoir. Prise 16 A à proximité de l'emplacement DJ." />
          </label>
          <dl className="min-w-64 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Sous-total HT</dt><dd>{eur(t.grossHT)}</dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Remise HT</dt>
              <dd><input name="discount" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="input w-28 py-1 text-right" /></dd>
            </div>
            {vatExempt ? (
              <div className="flex justify-between text-base font-semibold"><dt>Total net</dt><dd>{eur(t.totalHT)}</dd></div>
            ) : (
              <>
                <div className="flex justify-between"><dt className="text-slate-500">Total HT</dt><dd>{eur(t.totalHT)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">TVA</dt><dd>{eur(t.vat)}</dd></div>
                <div className="flex justify-between text-base font-semibold"><dt>Total TTC</dt><dd>{eur(t.totalTTC)}</dd></div>
              </>
            )}
            {mode === "quote" && deposit > 0 && <div className="flex justify-between border-t border-slate-100 pt-1.5 text-brand-700"><dt>Acompte {deposit} %</dt><dd>{eur(Math.round(total * deposit) / 100)}</dd></div>}
          </dl>
        </div>
      </div>

      {state?.error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button name="andSend" value="0" className="btn-secondary" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
        {mode === "invoice" ? (
          <button name="andSend" value="1" className="btn-primary" disabled={pending}>Enregistrer et émettre (numéro définitif)</button>
        ) : initial?.isNew !== false && (
          <>
            <button name="andSend" value="1" className="btn-primary" disabled={pending}>Enregistrer et envoyer au client</button>
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="email" defaultChecked className="h-4 w-4 accent-brand-600" /> par e-mail</label>
          </>
        )}
      </div>
    </form>
  );
}
