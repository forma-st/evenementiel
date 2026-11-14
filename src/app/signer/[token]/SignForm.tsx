"use client";
import { useActionState, useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import type { SignState } from "./actions";

export function SignForm({ sign, decline, signerName, signedUrl }: {
  sign: (s: SignState, f: FormData) => Promise<SignState>;
  decline: (s: SignState, f: FormData) => Promise<SignState>;
  signerName: string;
  signedUrl: string;
}) {
  const [state, run, pending] = useActionState(sign, null);
  const [dState, runDecline, declining] = useActionState(decline, null);
  const [showDecline, setShowDecline] = useState(false);
  // état contrôlé : la réinitialisation automatique du formulaire après une erreur ne doit pas décocher la case
  const [agree, setAgree] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (state?.done === "SIGNE")
    return (
      <div className="rounded-xl bg-emerald-50 p-6 text-center text-emerald-800">
        <div className="text-3xl">✓</div>
        <p className="mt-2 font-semibold">Merci {signerName.split(" ")[0]}, le document est signé.</p>
        <p className="mt-1 text-sm">Une fois toutes les signatures recueillies, la version signée sera disponible <a href={signedUrl} target="_blank" className="underline">ici</a>.</p>
      </div>
    );
  if (dState?.done === "REFUSE")
    return <div className="rounded-xl bg-slate-100 p-6 text-center text-slate-700">Votre refus a bien été transmis. Merci.</div>;

  return (
    <div className="space-y-4">
      <form
        action={run}
        onSubmit={(e) => {
          const sig = (e.currentTarget.elements.namedItem("signature") as HTMLInputElement | null)?.value ?? "";
          if (!agree) { e.preventDefault(); setLocalError("Cochez la case « J'ai lu et j'approuve le document »."); return; }
          if (!sig) { e.preventDefault(); setLocalError("Tracez votre signature dans le cadre."); return; }
          setLocalError(null);
        }}
        className="space-y-4"
      >
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
          <span>J'ai lu le document et je l'approuve. <b>Bon pour accord.</b> Je signe en tant que <b>{signerName}</b>.</span>
        </label>
        <SignaturePad />
        {(localError ?? state?.error) && <p role="alert" className="text-sm text-brand-600">{localError ?? state?.error}</p>}
        <button className="btn-primary w-full py-3 text-base" disabled={pending}>{pending ? "Signature en cours…" : "✍ Signer le document"}</button>
        <p className="text-xs text-slate-500">
          En signant, vous acceptez que votre signature électronique ait la même valeur qu'une signature manuscrite (art. 1367 du Code civil).
          La date, l'heure, votre adresse IP et votre navigateur sont enregistrés dans le dossier de preuve.
        </p>
      </form>
      <div className="border-t border-slate-200 pt-3 text-center">
        {!showDecline ? (
          <button type="button" onClick={() => setShowDecline(true)} className="text-sm text-slate-500 underline hover:text-slate-800">Je ne souhaite pas signer</button>
        ) : (
          <form action={runDecline} className="space-y-2 text-left">
            <label className="block text-sm font-medium">Motif (facultatif)</label>
            <textarea name="reason" rows={3} className="input" placeholder="Ex. : la date a changé…" />
            {dState?.error && <p className="text-sm text-brand-600">{dState.error}</p>}
            <button className="btn-secondary" disabled={declining}>Refuser de signer</button>
          </form>
        )}
      </div>
    </div>
  );
}
