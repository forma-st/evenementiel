"use client";
import { useActionState, useEffect, useRef } from "react";
import { cancelSecondFactor, login, verifySecondFactor, type LoginState } from "./actions";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  const [state2, action2, pending2] = useActionState<LoginState, FormData>(verifySecondFactor, null);
  const step = state2?.step === "2fa" || (state?.step === "2fa" && !state2?.error?.startsWith("Délai")) ? "2fa" : "password";
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (step === "2fa") codeRef.current?.focus(); }, [step]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {step === "password" ? (
        <form action={action} className="card w-full max-w-sm space-y-4 p-6">
          <div>
            <Logo className="mb-3 h-11" />
            <p className="text-sm text-slate-500">Connexion équipe ou espace client</p>
          </div>
          <label className="block">
            <span className="label">E-mail</span>
            <input name="email" type="email" required className="input" autoComplete="username" maxLength={200} />
          </label>
          <label className="block">
            <span className="label">Mot de passe</span>
            <input name="password" type="password" required className="input" autoComplete="current-password" maxLength={200} />
          </label>
          {(state?.error || state2?.error) && <p role="alert" className="text-sm text-rose-600">{state?.error ?? state2?.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
        </form>
      ) : (
        <form action={action2} className="card w-full max-w-sm space-y-4 p-6">
          <div>
            <Logo className="mb-3 h-11" />
            <h1 className="text-lg font-semibold">Vérification en deux étapes</h1>
            <p className="text-sm text-slate-500">Saisissez le code à 6 chiffres affiché par votre application d&apos;authentification, ou un code de secours.</p>
          </div>
          <input ref={codeRef} name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={20} placeholder="123 456" className="input text-center font-mono text-2xl tracking-[0.3em]" />
          {state2?.error && <p role="alert" className="text-sm text-rose-600">{state2.error}</p>}
          <button className="btn-primary w-full" disabled={pending2}>{pending2 ? "Vérification…" : "Valider"}</button>
          <button type="button" onClick={async () => { await cancelSecondFactor(); location.reload(); }} className="w-full text-sm text-slate-500 hover:text-ink">Retour</button>
        </form>
      )}
    </div>
  );
}
