"use client";
import { useActionState, useState } from "react";
import { answerQuote } from "./actions";

export function QuoteAnswer({ token, defaultName }: { token: string; defaultName: string }) {
  const [state, run, pending] = useActionState(answerQuote.bind(null, token), null);
  const [mode, setMode] = useState<"accept" | "refuse">("accept");
  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="answer" value={mode} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("accept")} className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${mode === "accept" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200"}`}>J&apos;accepte ce devis</button>
        <button type="button" onClick={() => setMode("refuse")} className={`flex-1 rounded-lg border px-4 py-2 text-sm ${mode === "refuse" ? "border-slate-500 bg-slate-100" : "border-slate-200 text-slate-500"}`}>Je décline</button>
      </div>
      {mode === "accept" ? (
        <>
          <label className="block"><span className="label">Votre nom</span><input name="name" defaultValue={defaultName} className="input" /></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" className="mt-0.5 h-4 w-4 accent-brand-600" /> Bon pour accord. Je comprends que la date sera réservée à la signature du contrat et au versement de l&apos;acompte.</label>
          <button className="btn-primary w-full" disabled={pending}>{pending ? "…" : "Accepter le devis"}</button>
        </>
      ) : (
        <>
          <label className="block"><span className="label">Une raison ? (facultatif)</span><textarea name="reason" rows={2} className="input" placeholder="Budget, date, autre prestataire…" /></label>
          <button className="btn-secondary w-full" disabled={pending}>Décliner le devis</button>
        </>
      )}
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
    </form>
  );
}
