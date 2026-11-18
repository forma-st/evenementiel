import type { Dossier } from "@prisma/client";
import { DOSSIER_STATUSES, PRIORITIES, parisParts } from "@/lib/format";
import { EVENT_KINDS, SERVICES, SOURCES, parseServices } from "@/lib/presta";
import { Field } from "./ui";
import { DateCheck } from "./DateCheck";
import { ClientPicker } from "./ClientPicker";

const hm = (d: Date | null | undefined) => (d ? `${String(parisParts(d).h).padStart(2, "0")}:${String(parisParts(d).min).padStart(2, "0")}` : "");

export function DossierForm({ action, dossier, clients, users, defaultClientId, submit }: {
  action: (f: FormData) => void;
  dossier?: Dossier;
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
  defaultClientId?: string;
  submit: string;
}) {
  const sv = parseServices(dossier?.services ?? "DJ,SONO");
  return (
    <form action={action} className="space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">L&apos;événement</h2>
        <div className="sm:col-span-2">
          <Field label={dossier ? "Intitulé *" : "Intitulé (facultatif : « Type — Client » par défaut)"}><input name="title" required={!!dossier} defaultValue={dossier?.title} placeholder="Mariage de Julie & Thomas" className="input" /></Field>
        </div>
        <div className="sm:row-span-2"><ClientPicker clients={clients} defaultValue={dossier?.clientId ?? defaultClientId} /></div>
        <Field label="Type d'événement">
          <select name="eventType" defaultValue={dossier?.eventType ?? "MARIAGE"} className="input">
            {EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Date"><input name="eventDate" type="date" defaultValue={dossier?.eventStart ? parisParts(dossier.eventStart).key : ""} className="input" /></Field>
          <Field label="Début"><input name="startTime" type="time" defaultValue={hm(dossier?.eventStart) || "18:00"} className="input" /></Field>
          <Field label="Fin"><input name="endTime" type="time" defaultValue={hm(dossier?.eventEnd) || "02:00"} className="input" /></Field>
        </div>
        <div className="sm:col-span-2"><DateCheck excludeId={dossier?.id} /></div>
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
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Le lieu</h2>
        <Field label="Nom du lieu"><input name="venueName" defaultValue={dossier?.venueName ?? ""} placeholder="Domaine des Oliviers" className="input" /></Field>
        <Field label="Ville"><input name="venueCity" defaultValue={dossier?.venueCity ?? ""} className="input" /></Field>
        <div className="sm:col-span-2"><Field label="Adresse"><input name="venueAddress" defaultValue={dossier?.venueAddress ?? ""} className="input" /></Field></div>
        <div className="sm:col-span-2"><Field label="Contact sur place (coordinatrice, traiteur, témoin…)"><input name="venueContact" defaultValue={dossier?.venueContact ?? ""} placeholder="Sophie (wedding planner) 06 12 34 56 78" className="input" /></Field></div>
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Suivi</h2>
        <Field label="Statut">
          <select name="status" defaultValue={dossier?.status ?? "DEMANDE"} className="input">
            {DOSSIER_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Prestataire / responsable">
          <select name="assigneeId" defaultValue={dossier?.assigneeId ?? ""} className="input">
            <option value="">Non assigné</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
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
        <Field label="Répondre avant le"><input name="dueDate" type="date" defaultValue={dossier?.dueDate?.toISOString().slice(0, 10)} className="input" /></Field>
        {dossier?.status === "PERDU" && <Field label="Raison de la perte"><input name="lostReason" defaultValue={dossier?.lostReason ?? ""} className="input" /></Field>}
        <div className="sm:col-span-2">
          <Field label="Notes internes"><textarea name="description" rows={4} defaultValue={dossier?.description ?? ""} placeholder="Ambiance souhaitée, contraintes du lieu, budget…" className="input" /></Field>
        </div>
      </section>
      <button className="btn-primary">{submit}</button>
    </form>
  );
}
