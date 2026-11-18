"use client";
import { useActionState } from "react";
import { setupAdmin } from "./actions";
import { Logo } from "@/components/Logo";

export function SetupForm({ needsToken = false }: { needsToken?: boolean }) {
  const [error, action, pending] = useActionState(setupAdmin, null);
  return (
    <form action={action} className="card w-full max-w-sm space-y-4 p-6">
      <div>
        <Logo className="mb-3 h-11" />
        <div className="text-lg font-semibold">Première connexion</div>
        <p className="text-sm text-slate-500">Créez le compte administrateur.</p>
      </div>
      <label className="block"><span className="label">Nom</span><input name="name" required className="input" /></label>
      <label className="block"><span className="label">E-mail</span><input name="email" type="email" required className="input" /></label>
      <label className="block"><span className="label">Mot de passe (10 caractères minimum)</span><input name="password" type="password" minLength={10} required autoComplete="new-password" className="input" /></label>
      {needsToken && <label className="block"><span className="label">Code d&apos;installation</span><input name="setupToken" required className="input" /></label>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>Créer et se connecter</button>
    </form>
  );
}
