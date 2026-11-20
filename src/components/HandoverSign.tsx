"use client";
import { useActionState } from "react";
import { SignaturePad } from "./SignaturePad";

export function HandoverSign({ action, defaultName }: { action: (s: unknown, f: FormData) => Promise<{ error?: string; ok?: boolean }>; defaultName: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="space-y-3 print:hidden">
      <label className="block"><span className="label">Nom de la personne qui récupère le matériel</span><input name="name" defaultValue={defaultName} required className="input" /></label>
      <SignaturePad />
      <p className="text-xs text-slate-500">En signant, l&apos;emprunteur reconnaît avoir reçu le matériel ci-dessus en bon état et accepte les conditions.</p>
      <button className="btn-primary w-full py-3 text-base sm:w-auto" disabled={pending}>{pending ? "Enregistrement…" : "🖊 Signer et remettre le matériel"}</button>
      {state?.error && <p role="alert" className="text-sm font-medium text-rose-700">⛔ {state.error}</p>}
    </form>
  );
}
