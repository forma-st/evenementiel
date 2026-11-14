"use client";
import { useActionState } from "react";
import { FormRenderer } from "@/components/FormRenderer";
import type { Field } from "@/lib/questionnaire";
import type { SubmitState } from "./actions";

export function PublicForm({ fields, action }: { fields: Field[]; action: (s: SubmitState, f: FormData) => Promise<SubmitState> }) {
  const [state, run, pending] = useActionState(action, null);
  if (state?.done)
    return <div className="rounded-lg bg-emerald-50 p-6 text-center text-emerald-800">Merci ! Vos réponses ont bien été envoyées.</div>;
  const nbErr = Object.keys(state?.errors ?? {}).length;
  return (
    <form action={run} className="space-y-6">
      <FormRenderer fields={fields} errors={state?.errors} defaults={state?.answers} key={JSON.stringify(state?.answers ?? {})} />
      {nbErr > 0 && <p className="text-sm text-rose-600">Merci de corriger {nbErr} champ(s).</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Envoi…" : "Envoyer mes réponses"}</button>
    </form>
  );
}
