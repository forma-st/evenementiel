"use client";
import { useActionState, useEffect, useState } from "react";
import { EVENT_KINDS, SERVICES, SOURCES } from "@/lib/presta";
import { submitLead } from "./actions";

export function LeadForm() {
  const [state, run, pending] = useActionState(submitLead, null);
  const [day, setDay] = useState("");
  const [free, setFree] = useState<boolean | null>(null);
  useEffect(() => {
    if (!day) return setFree(null);
    fetch(`/api/disponibilite?date=${day}`).then((r) => r.json()).then((j) => setFree(j.available ?? null)).catch(() => setFree(null));
  }, [day]);
  if (state?.ok) return <div className="py-10 text-center"><div className="text-4xl">🎉</div><p className="mt-3 font-semibold">Merci, votre demande est bien partie !</p><p className="text-sm text-slate-500">Vous allez recevoir un e-mail de confirmation.</p></div>;
  return (
    <form action={run} className="grid gap-4 sm:grid-cols-2">
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" />
      <label className="block"><span className="label">Nom et prénom *</span><input name="name" required className="input" /></label>
      <label className="block"><span className="label">E-mail *</span><input name="email" type="email" required className="input" /></label>
      <label className="block"><span className="label">Téléphone</span><input name="phone" type="tel" className="input" /></label>
      <label className="block"><span className="label">Type d&apos;événement</span><select name="eventType" className="input">{EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
      <label className="block">
        <span className="label">Date</span><input name="date" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input" />
        {free === true && <span className="mt-1 block text-xs text-emerald-700">✓ Cette date est disponible</span>}
        {free === false && <span className="mt-1 block text-xs text-amber-700">Cette date est déjà très demandée : envoyez quand même, nous vous proposerons une solution.</span>}
      </label>
      <label className="block"><span className="label">Nombre d&apos;invités</span><input name="guests" type="number" min={0} className="input" /></label>
      <label className="block"><span className="label">Lieu de réception</span><input name="venue" className="input" /></label>
      <label className="block"><span className="label">Ville</span><input name="city" className="input" /></label>
      <div className="sm:col-span-2">
        <span className="label">Prestations souhaitées</span>
        <div className="flex flex-wrap gap-2">{SERVICES.map((x) => <label key={x.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"><input type="checkbox" name="services" value={x.id} className="accent-brand-600" /> {x.icon} {x.label}</label>)}</div>
      </div>
      <label className="block"><span className="label">Budget envisagé (€)</span><input name="budget" inputMode="numeric" className="input" /></label>
      <label className="block"><span className="label">Comment nous avez-vous connus ?</span><select name="source" className="input"><option value="">—</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="block sm:col-span-2"><span className="label">Votre projet</span><textarea name="message" rows={4} className="input" placeholder="Ambiance, styles de musique, déroulé, attentes photo…" /></label>
      {state?.error && <p className="text-sm text-rose-600 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2"><button className="btn-primary w-full" disabled={pending}>{pending ? "Envoi…" : "Envoyer ma demande"}</button></div>
    </form>
  );
}
