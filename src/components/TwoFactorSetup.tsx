"use client";
import { useState, useTransition } from "react";
import { confirmTwoFactor, startTwoFactor } from "@/app/(staff)/parametres/actions";

/** Activation de la vérification en deux étapes : QR code, code de confirmation, codes de secours. */
export function TwoFactorSetup({ enabled, children }: { enabled: boolean; children?: React.ReactNode }) {
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();

  if (codes) return (
    <div className="space-y-3">
      <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Vérification en deux étapes activée.</p>
      <p className="text-sm text-slate-600">Gardez ces codes de secours en lieu sûr (gestionnaire de mots de passe, papier). Chacun permet une connexion si vous perdez votre téléphone. Ils ne seront plus affichés.</p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-3 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
      <button type="button" onClick={() => navigator.clipboard.writeText(codes.join("\n"))} className="btn-secondary">Copier les codes</button>
    </div>
  );

  // déjà activée (et codes de secours déjà montrés) : formulaire de désactivation
  if (enabled) return <>{children}</>;

  if (!setup) return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">À chaque connexion, un code à 6 chiffres vous sera demandé en plus du mot de passe. Il faut une application d&apos;authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator, 1Password…).</p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await startTwoFactor(); if ("error" in r) setError(r.error); else setSetup(r); })} className="btn-primary">Activer la vérification en deux étapes</button>
    </div>
  );

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Dans l&apos;application, ajoutez un compte et scannez ce QR code.</li>
        <li>Saisissez le code à 6 chiffres affiché pour confirmer.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qr} alt="QR code à scanner avec l'application d'authentification" width={180} height={180} className="rounded-lg bg-[#fff] p-2" />
        <div className="text-xs text-slate-500">Saisie manuelle :<div className="mt-1 font-mono text-sm break-all text-ink">{setup.secret.replace(/(.{4})/g, "$1 ")}</div></div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await confirmTwoFactor(code); if ("error" in r) setError(r.error); else setCodes(r.codes); }); }} className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" className="input w-36 text-center font-mono tracking-widest" />
        <button disabled={pending || code.length < 6} className="btn-primary">Confirmer</button>
      </form>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
