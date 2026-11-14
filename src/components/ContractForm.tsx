"use client";
import { useActionState, useRef, useState } from "react";
import { generateContract } from "@/app/(staff)/contrats/actions";

type Signer = { name: string; email: string };

export function ContractForm(p: {
  dossierId: string; templateId: string; title: string; body: string; hasUnfilled: boolean;
  quotes: { id: string; label: string }[]; defaultQuoteId: string; signers: Signer[];
}) {
  const [state, run, pending] = useActionState(generateContract, null);
  const [signers, setSigners] = useState<Signer[]>(p.signers);
  const formRef = useRef<HTMLFormElement>(null);

  /** Ouvre l'aperçu PDF dans un nouvel onglet (formulaire temporaire). */
  const preview = () => {
    const src = new FormData(formRef.current!);
    const f = document.createElement("form");
    f.method = "POST"; f.action = "/api/contrats/apercu"; f.target = "_blank";
    for (const k of ["title", "body", "quoteId"]) {
      const i = document.createElement(k === "body" ? "textarea" : "input") as HTMLInputElement;
      i.name = k; i.value = String(src.get(k) ?? "");
      f.appendChild(i);
    }
    document.body.appendChild(f); f.submit(); f.remove();
  };

  return (
    <form ref={formRef} action={run} className="space-y-4">
      <input type="hidden" name="dossierId" value={p.dossierId} />
      <input type="hidden" name="templateId" value={p.templateId} />
      {p.hasUnfilled && <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">Certaines variables {"{{…}}"} n&apos;ont pas pu être remplies (information manquante). Complétez la fiche de la prestation ou corrigez le texte ci-dessous.</p>}
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="label">Titre du document</span><input name="title" defaultValue={p.title} className="input" /></label>
        <label className="block sm:col-span-2">
          <span className="label">Devis joint en annexe</span>
          <select name="quoteId" defaultValue={p.defaultQuoteId} className="input">
            <option value="">Aucune annexe</option>
            {p.quotes.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        </label>
      </div>
      <div className="card p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Texte du contrat <span className="text-sm font-normal text-slate-500">— relisez et ajustez si besoin</span></h2>
          <button type="button" onClick={preview} className="btn-secondary py-1.5 text-xs">👁 Aperçu PDF</button>
        </div>
        <textarea name="body" defaultValue={p.body} rows={28} className="block w-full resize-y border-0 p-5 font-mono text-[13px] leading-relaxed outline-none" />
      </div>
      <div className="card space-y-3 p-6">
        <div className="font-semibold">Signataires</div>
        {signers.map((s, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input name="signerName" required placeholder="Nom et prénom" value={s.name} onChange={(e) => setSigners((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} className="input" />
            <input name="signerEmail" type="email" placeholder="E-mail" value={s.email} onChange={(e) => setSigners((x) => x.map((y, j) => (j === i ? { ...y, email: e.target.value } : y)))} className="input" />
            <button type="button" disabled={signers.length === 1} onClick={() => setSigners((x) => x.filter((_, j) => j !== i))} className="px-2 text-sm text-slate-400 hover:text-rose-600 disabled:opacity-30">Retirer</button>
          </div>
        ))}
        <button type="button" onClick={() => setSigners((x) => [...x, { name: "", email: "" }])} className="btn-secondary py-1.5 text-xs">+ Ajouter un signataire (ex. le/la conjoint·e)</button>
      </div>
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="label">Message au client</span><textarea name="message" rows={2} className="input" defaultValue="Voici le contrat de réservation de votre date. Il vous suffit de le relire et de le signer en ligne." /></label>
        <label className="block">
          <span className="label">Validité du lien</span>
          <select name="expiresInDays" defaultValue="15" className="input">{[7, 15, 30, 60].map((d) => <option key={d} value={d}>{d} jours</option>)}</select>
        </label>
        <div className="space-y-2 pt-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="sendEmail" defaultChecked className="h-4 w-4 accent-brand-600" /> Envoyer le lien de signature par e-mail</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="winOnSign" defaultChecked className="h-4 w-4 accent-brand-600" /> Passer la prestation à « Confirmée » une fois signé</label>
        </div>
      </div>
      {state?.error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Génération…" : "✍ Générer et envoyer en signature"}</button>
    </form>
  );
}
