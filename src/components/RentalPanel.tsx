"use client";
import { useState, useTransition } from "react";
import { createRentalQuote, invoiceDamages, saveCheckin, saveCheckout, setCautionStatus } from "@/app/(staff)/prestations/rental-actions";
import type { Checkin, Checkout } from "@/lib/rental";
import { toast } from "@/lib/toast";
import { ReturnButton } from "./ReturnButton";

type Item = { id: string; name: string; qty: number; dailyRate: number | null; replacementValue: number | null };
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const when = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

const CAUTION: Record<string, { label: string; cls: string }> = {
  "": { label: "Non demandée", cls: "bg-slate-100 text-slate-600" },
  A_RECEVOIR: { label: "À recevoir", cls: "bg-amber-100 text-amber-800" },
  RECUE: { label: "Reçue", cls: "bg-blue-100 text-blue-800" },
  RESTITUEE: { label: "Restituée", cls: "bg-emerald-100 text-emerald-700" },
  RETENUE: { label: "Retenue", cls: "bg-rose-100 text-rose-700" },
};

/** Location de matériel : période, caution, état des lieux de départ et de retour, dommages. */
export function RentalPanel({ loan = false, dossierId, start, end, days, items, caution, cautionStatus, checkout, checkin }: {
  loan?: boolean; dossierId: string; start: string | null; end: string | null; days: number; items: Item[];
  caution: number | null; cautionStatus: string; checkout: Checkout | null; checkin: Checkin | null;
}) {
  const [pending, run] = useTransition();
  const [step, setStep] = useState<"" | "out" | "in">("");
  const [outItems, setOutItems] = useState(items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, ok: true })));
  const [inItems, setInItems] = useState(items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, returned: i.qty, damaged: 0, note: "" })));
  const [notes, setNotes] = useState("");
  const rentTotal = items.reduce((a, i) => a + (i.dailyRate ?? 0) * i.qty * days, 0);
  const missingPrice = items.filter((i) => i.dailyRate == null);
  const est = inItems.reduce((a, i) => a + ((i.qty - i.returned) + i.damaged) * (items.find((x) => x.id === i.id)?.replacementValue ?? 0), 0);
  const stage = checkin ? 4 : checkout ? 2 : 1;
  const c = CAUTION[cautionStatus] ?? CAUTION[""];

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">{loan ? "🤝 Prêt de matériel" : "📦 Location de matériel"}</h2>
        <p className="text-sm text-slate-600">{start && end ? <>Retrait le {when(start)}, retour le {when(end)} : <b>{days} jour{days > 1 ? "s" : ""}</b>{loan ? "" : ` facturé${days > 1 ? "s" : ""}`}.</> : "Indiquez les dates de retrait et de retour dans la fiche."}</p>
      </div>

      {/* étapes : préparation, remis au client, rendu */}
      <ol className="grid grid-cols-3 border-b border-slate-100 text-center text-xs">
        {["Préparation", loan ? "Prêté" : "Remis au client", "Rendu"].map((l, i) => (
          <li key={l} className={`py-2 ${stage > i + 1 ? "text-emerald-700" : stage === i + 1 ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-400"}`}>{stage > i + 1 ? "✓ " : ""}{l}</li>
        ))}
      </ol>

      <div className="space-y-5 p-5">
        {!loan && <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-slate-500">Location (tarifs du parc)</div>
            <div className="text-lg font-semibold tabular-nums">{eur(rentTotal)} HT</div>
            {missingPrice.length > 0 && <div className="text-xs text-amber-700">Sans tarif : {missingPrice.map((m) => m.name).join(", ")} (Matériel › Modifier)</div>}
            <button disabled={pending || !items.length} onClick={() => run(() => createRentalQuote(dossierId))} className="btn-secondary mt-2 py-1.5 text-xs">Créer le devis de location</button>
          </div>
          <div>
            <div className="text-xs text-slate-500">Caution</div>
            <div className="flex items-center gap-2"><span className="text-lg font-semibold tabular-nums">{caution ? eur(caution) : "—"}</span><span className={`badge ${c.cls}`}>{c.label}</span></div>
            {caution ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {(["A_RECEVOIR", "RECUE", "RESTITUEE", "RETENUE"] as const).filter((k) => k !== cautionStatus).map((k) => (
                  <form key={k} action={setCautionStatus.bind(null, dossierId, k)}><button disabled={pending} className="rounded-full px-2.5 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50">{CAUTION[k].label}</button></form>
                ))}
              </div>
            ) : <p className="text-xs text-slate-500">Montant à saisir dans « Modifier » (rubrique Suivi).</p>}
          </div>
        </div>}

        {items.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Réservez d&apos;abord le matériel {loan ? "prêté" : "loué"} dans la rubrique « Matériel réservé ».</p>}

        {/* départ */}
        {items.length > 0 && !checkout && step !== "out" && <button onClick={() => setStep("out")} className="btn-primary">{loan ? "Valider la sortie du matériel" : "Remettre le matériel au client"}</button>}
        {step === "out" && (
          <div className="rounded-xl ring-1 ring-slate-200">
            <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium">État des lieux de départ</div>
            <ul className="divide-y divide-slate-100">
              {outItems.map((i, k) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <input type="checkbox" checked={i.ok} onChange={(e) => setOutItems((x) => x.map((y, j) => (j === k ? { ...y, ok: e.target.checked } : y)))} className="h-4 w-4 accent-brand-600" aria-label={`${i.name} vérifié`} />
                  <span className="flex-1">{i.name}</span>
                  <input type="number" min={0} value={i.qty} onChange={(e) => setOutItems((x) => x.map((y, j) => (j === k ? { ...y, qty: Number(e.target.value) } : y)))} className="input w-16 py-1" aria-label="Quantité remise" />
                </li>
              ))}
            </ul>
            <div className="space-y-2 p-4">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="État constaté, accessoires fournis (câbles, housses, pieds)…" className="input" />
              <div className="flex gap-2">
                <button disabled={pending} onClick={() => run(async () => { await saveCheckout(dossierId, outItems, notes); setStep(""); setNotes(""); toast(loan ? "Sortie du matériel enregistrée" : "Matériel remis au client", { tone: "success" }); })} className="btn-primary">Valider la remise</button>
                <button onClick={() => setStep("")} className="btn-secondary">Annuler</button>
              </div>
            </div>
          </div>
        )}
        {checkout && (
          <div className="text-sm">
            <div className="font-medium text-emerald-700">✓ {loan ? "Sorti" : "Remis au client"} le {when(checkout.at)} par {checkout.by}</div>
            <div className="text-slate-600">{checkout.items.map((i) => `${i.qty} × ${i.name}${i.ok ? "" : " (réserve)"}`).join(", ")}</div>
            {checkout.notes && <div className="text-xs text-slate-500">{checkout.notes}</div>}
          </div>
        )}

        {/* retour */}
        {checkout && !checkin && step !== "in" && <div className="flex flex-wrap items-center gap-2"><ReturnButton dossierId={dossierId} label="✓ Tout est rendu en bon état" className="px-3.5 py-2 text-sm" /><button onClick={() => setStep("in")} className="btn-secondary">Retour détaillé (manquant, casse)</button></div>}
        {step === "in" && (
          <div className="rounded-xl ring-1 ring-slate-200">
            <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium">État des lieux de retour</div>
            <div className="hidden grid-cols-[1fr_70px_70px_1fr] gap-2 px-4 pt-2 text-xs text-slate-500 sm:grid"><span>Matériel</span><span>Rendus</span><span>Abîmés</span><span>Remarque</span></div>
            <ul className="divide-y divide-slate-100">
              {inItems.map((i, k) => (
                <li key={i.id} className={`grid items-center gap-2 px-4 py-2 text-sm sm:grid-cols-[1fr_70px_70px_1fr] ${i.returned < i.qty || i.damaged ? "bg-rose-50/60" : ""}`}>
                  <span>{i.name} <span className="text-xs text-slate-500">({i.qty} sortis)</span></span>
                  <input type="number" min={0} max={i.qty} value={i.returned} onChange={(e) => setInItems((x) => x.map((y, j) => (j === k ? { ...y, returned: Number(e.target.value) } : y)))} className="input py-1" aria-label="Quantité rendue" />
                  <input type="number" min={0} max={i.returned} value={i.damaged} onChange={(e) => setInItems((x) => x.map((y, j) => (j === k ? { ...y, damaged: Number(e.target.value) } : y)))} className="input py-1" aria-label="Quantité abîmée" />
                  <input value={i.note} onChange={(e) => setInItems((x) => x.map((y, j) => (j === k ? { ...y, note: e.target.value } : y)))} placeholder="Grille enfoncée, câble coupé…" className="input py-1" />
                </li>
              ))}
            </ul>
            <div className="space-y-2 p-4">
              {est > 0 && <p className="text-sm font-medium text-rose-700">Dommages estimés : {eur(est)} (valeur de remplacement)</p>}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Remarques sur le retour…" className="input" />
              <div className="flex gap-2">
                <button disabled={pending} onClick={() => run(async () => { await saveCheckin(dossierId, inItems, notes); setStep(""); toast("Retour du matériel enregistré", { tone: "success" }); })} className="btn-primary">Valider le retour</button>
                <button onClick={() => setStep("")} className="btn-secondary">Annuler</button>
              </div>
            </div>
          </div>
        )}
        {checkin && (
          <div className="space-y-2 text-sm">
            <div className={`font-medium ${checkin.damages > 0 ? "text-rose-700" : "text-emerald-700"}`}>{checkin.damages > 0 ? "⚠" : "✓"} Rendu le {when(checkin.at)} : {checkin.damages > 0 ? `dommages estimés ${eur(checkin.damages)}` : "tout est rendu en bon état"}</div>
            {checkin.items.filter((i) => i.returned < i.qty || i.damaged).map((i) => <div key={i.id} className="text-slate-600">{i.name} : {i.qty - i.returned} manquant(s), {i.damaged} abîmé(s){i.note ? `, ${i.note}` : ""}</div>)}
            <div className="flex flex-wrap gap-2">
              {checkin.damages > 0 && !loan && <button disabled={pending} onClick={() => run(() => invoiceDamages(dossierId))} className="btn-primary py-1.5 text-xs">Facturer les dommages</button>}
              {caution && cautionStatus === "RECUE" && <form action={setCautionStatus.bind(null, dossierId, checkin.damages > 0 ? "RETENUE" : "RESTITUEE")}><button className="btn-secondary py-1.5 text-xs">{checkin.damages > 0 ? "Retenir la caution" : "Restituer la caution"}</button></form>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
