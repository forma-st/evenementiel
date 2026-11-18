"use client";
import { useActionState } from "react";
import { unlockGallery } from "./actions";

export function Unlock({ token, title }: { token: string; title: string }) {
  const [state, run, pending] = useActionState(unlockGallery.bind(null, token), null);
  return (
    <form action={run} className="mx-auto mt-20 max-w-sm space-y-4 rounded-2xl bg-zinc-900 p-8 text-center">
      <div className="text-3xl">🔒</div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-zinc-400">Saisissez le code d&apos;accès reçu par e-mail.</p>
      <input name="code" autoFocus autoComplete="off" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] uppercase outline-none focus:border-blue-500" />
      {state?.error && <p className="text-sm text-rose-400">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium hover:bg-blue-500">{pending ? "…" : "Accéder"}</button>
    </form>
  );
}
