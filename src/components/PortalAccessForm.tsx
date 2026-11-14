"use client";
import { useActionState } from "react";

type State = { error?: string; email?: string; password?: string } | null;

export function PortalAccessForm({ action, defaultEmail, defaultName }: {
  action: (s: State, f: FormData) => Promise<State>;
  defaultEmail?: string | null;
  defaultName?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" placeholder="Nom" defaultValue={defaultName} className="input" />
        <input name="email" type="email" placeholder="E-mail" defaultValue={defaultEmail ?? ""} required className="input" />
      </div>
      <button className="btn-secondary" disabled={pending}>Créer / réinitialiser l'accès</button>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state?.password && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Accès créé. Transmettez ces identifiants au client :<br />
          <b>{state.email}</b> / mot de passe <code className="rounded bg-white px-1">{state.password}</code>
        </div>
      )}
    </form>
  );
}
