"use client";
import { useActionState, useState } from "react";
import type { Dossier } from "@prisma/client";
import { DOSSIER_STATUSES, PRIORITIES, parisParts } from "@/lib/format";
import { EVENT_KINDS, INTERNAL_CLIENT, SERVICES, SOURCES, isGearOnly, parseServices } from "@/lib/presta";
import { Field } from "./ui";
import { DateCheck } from "./DateCheck";
import { ClientPicker } from "./ClientPicker";
import { GearPicker } from "./GearPicker";

export type DossierFormState = { error?: string } | null;

const hm = (d: Date | null | undefined) => (d ? `${String(parisParts(d).h).padStart(2, "0")}:${String(parisParts(d).min).padStart(2, "0")}` : "");

export function DossierForm({ action, dossier, clients, users, defaultClientId, defaultType, submit }: {
  action: (s: DossierFormState, f: FormData) => Promise<DossierFormState>;
  dossier?: Dossier;
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
  defaultClientId?: string;
  defaultType?: string;
  submit: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  const sv = parseServices(dossier?.services ?? "DJ,SONO");
  const [type, setType] = useState(dossier?.eventType ?? defaultType ?? "MARIAGE");
  const [date, setDate] = useState(dossier?.eventStart ? parisParts(dossier.eventStart).key : "");
  const gear = isGearOnly(type);
  const loan = type === "PRET";
  const [start, setStart] = useState(hm(dossier?.eventStart) || (gear ? "10:00" : "18:00"));
  const [end, setEnd] = useState(hm(dossier?.eventEnd) || (gear ? "18:00" : "02:00"));
  const [endDate, setEndDate] = useState(dossier?.eventEnd && dossier.eventStart && dossier.eventEnd.getTime() - dossier.eventStart.getTime() > 864e5 ? parisParts(dossier.eventEnd).key : "");
  const internal = clients.find((c) => c.name === INTERNAL_CLIENT);
  const [loanTo, setLoanTo] = useState<"TEAM" | "PARTNER">(dossier && internal && dossier.clientId !== internal.id ? "PARTNER" : "TEAM");
  const pickType = (t: string) => {
    setType(t);
    if (isGearOnly(t) && !isGearOnly(type) && !dossier) { setStart("10:00"); setEnd("18:00"); }
  };

  return (
    <form action={run} className="space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">{gear ? (loan ? "Le prêt" : "La location") : "L'événement"}</h2>
        <div className="sm:col-span-2">
          <span className="label">Type</span>
          <div className="flex flex-wrap gap-2">
            {EVENT_KINDS.map((k) => (
              <label key={k.id} className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ring-1 transition ${type === k.id ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" name="eventType" value={k.id} checked={type === k.id} onChange={() => pickType(k.id)} className="sr-only" />
                {k.icon} {k.label}
              </label>
            ))}
          </div>
        </div>

        {loan ? (
          <div className="space-y-3 sm:col-span-2">
            <div className="flex gap-2" role="radiogroup" aria-label="Prêté à">
              {([["TEAM", "À un membre de l'équipe"], ["PARTNER", "À un associé ou partenaire"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={loanTo === k} onClick={() => setLoanTo(k)} className={`flex-1 rounded-lg px-3 py-2 text-sm ring-1 ${loanTo === k ? "bg-brand-50 font-medium ring-2 ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>{l}</button>
              ))}
            </div>
            <input type="hidden" name="loanTo" value={loanTo} />
            {loanTo === "TEAM" ? (
              <Field label="Emprunteur *">
                <select name="assigneeId" required defaultValue={dossier?.assigneeId ?? ""} className="input">
                  <option value="" disabled>Choisir…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
            ) : <ClientPicker clients={clients.filter((c) => c.name !== INTERNAL_CLIENT)} defaultValue={dossier?.clientId !== internal?.id ? dossier?.clientId : undefined} />}
          </div>
        ) : (
          <>
            <div className="sm:col-span-2 sm:max-w-md"><ClientPicker clients={clients.filter((c) => c.name !== INTERNAL_CLIENT)} defaultValue={dossier?.clientId ?? defaultClientId} /></div>
          </>
        )}

        <div className="sm:col-span-2">
          <Field label={dossier ? "Intitulé *" : "Intitulé (facultatif)"}><input name="title" required={!!dossier} defaultValue={dossier?.title} placeholder={gear ? (loan ? "Prêt pour la soirée de Karim" : "Location sono anniversaire") : "Mariage de Julie & Thomas"} className="input" /></Field>
        </div>

        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-4">
          <Field label={gear ? "Sortie le *" : "Date"}><input name="eventDate" type="date" required={gear} value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field>
          <Field label={gear ? "à" : "Début"}><input name="startTime" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="input" /></Field>
          <Field label={gear ? "Retour le *" : "Jusqu'au (plusieurs jours)"}><input name="endDate" type="date" required={gear} min={date || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" /></Field>
          <Field label={gear ? "à" : "Fin"}><input name="endTime" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="input" /></Field>
        </div>
        {!gear && <div className="sm:col-span-2"><DateCheck excludeId={dossier?.id} /></div>}

        {gear && !dossier && (
          <div className="sm:col-span-2"><GearPicker date={date} start={start} endDate={endDate} endTime={end} /></div>
        )}
        {gear && dossier && <p className="text-sm text-slate-500 sm:col-span-2">Le matériel se modifie sur la fiche, rubrique « Matériel réservé ».</p>}

        {!gear && (
          <>
            <Field label="Installation à partir de"><input name="setupTime" type="time" defaultValue={dossier?.setupTime ?? ""} className="input" /></Field>
            <Field label="Nombre d'invités"><input name="guests" type="number" min={0} defaultValue={dossier?.guests ?? ""} className="input" /></Field>
            <div className="sm:col-span-2">
              <span className="label">Prestations</span>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((x) => (
                  <label key={x.id} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                    <input type="checkbox" name="services" value={x.id} defaultChecked={sv.includes(x.id)} className="accent-brand-600" /> {x.icon} {x.label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {!loan && (
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{gear ? "Lieu d'utilisation (facultatif)" : "Le lieu"}</h2>
          <Field label="Nom du lieu"><input name="venueName" defaultValue={dossier?.venueName ?? ""} placeholder="Domaine des Oliviers" className="input" /></Field>
          <Field label="Ville"><input name="venueCity" defaultValue={dossier?.venueCity ?? ""} className="input" /></Field>
          <div className="sm:col-span-2"><Field label="Adresse"><input name="venueAddress" defaultValue={dossier?.venueAddress ?? ""} className="input" /></Field></div>
          {!gear && <div className="sm:col-span-2"><Field label="Contact sur place (coordinatrice, traiteur, témoin…)"><input name="venueContact" defaultValue={dossier?.venueContact ?? ""} placeholder="Sophie (wedding planner) 06 12 34 56 78" className="input" /></Field></div>}
        </section>
      )}

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Suivi</h2>
        <Field label="Statut">
          <select key={dossier ? "s" : type} name="status" defaultValue={dossier?.status ?? (loan ? "CONFIRME" : gear ? "OPTION" : "DEMANDE")} className="input">
            {DOSSIER_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        {!(loan && loanTo === "TEAM") && (
          <Field label={loan ? "Responsable du prêt" : "Prestataire / responsable"}>
            <select name="assigneeId" defaultValue={dossier?.assigneeId ?? ""} className="input">
              <option value="">Non assigné</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        )}
        {!loan && (
          <>
            <Field label="Origine du contact">
              <select name="source" defaultValue={dossier?.source ?? ""} className="input">
                <option value="">—</option>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Priorité">
              <select name="priority" defaultValue={dossier?.priority ?? "NORMALE"} className="input">
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Budget / montant estimé (€ TTC)"><input name="amount" inputMode="decimal" defaultValue={dossier?.amount ?? ""} className="input" /></Field>
            <Field label="Acompte (%)"><input name="depositPercent" type="number" min={0} max={100} defaultValue={dossier?.depositPercent ?? 30} className="input" /></Field>
          </>
        )}
        {type === "LOCATION" && <Field label="Caution demandée (€)"><input name="cautionAmount" inputMode="decimal" defaultValue={dossier?.cautionAmount ?? ""} placeholder="Ex. 500" className="input" /></Field>}
        {!gear && <Field label="Répondre avant le"><input name="dueDate" type="date" defaultValue={dossier?.dueDate?.toISOString().slice(0, 10)} className="input" /></Field>}
        {dossier?.status === "PERDU" && <Field label="Raison de la perte"><input name="lostReason" defaultValue={dossier?.lostReason ?? ""} className="input" /></Field>}
        <div className="sm:col-span-2">
          <Field label="Notes internes"><textarea name="description" rows={3} defaultValue={dossier?.description ?? ""} placeholder={gear ? "Accessoires prévus, conditions particulières…" : "Ambiance souhaitée, contraintes du lieu, budget…"} className="input" /></Field>
        </div>
      </section>
      {state?.error && <p role="alert" className="rounded-lg border-2 border-rose-500 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800">⛔ {state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Enregistrement…" : submit}</button>
    </form>
  );
}

