"use client";
import { useState } from "react";
import { EVENT_TYPES } from "@/lib/events";

export type EventDefaults = {
  title?: string; type?: string; day: string; endDay?: string; startTime?: string; endTime?: string; allDay?: boolean;
  location?: string; description?: string; clientId?: string; dossierId?: string; attendees?: string[];
};

const addMinutes = (hm: string, n: number) => {
  const [h, m] = hm.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + n);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function EventForm({ action, defaults, clients, dossiers, users, me, submit }: {
  action: (f: FormData) => void;
  defaults: EventDefaults;
  clients: { id: string; name: string }[];
  dossiers: { id: string; label: string; clientId: string }[];
  users: { id: string; name: string }[];
  me: string;
  submit: string;
}) {
  const [type, setType] = useState(defaults.type ?? "REUNION");
  const [clientId, setClientId] = useState(defaults.clientId ?? "");
  const [allDay, setAllDay] = useState(!!defaults.allDay);
  const [multi, setMulti] = useState(!!defaults.endDay && defaults.endDay !== defaults.day);
  const [start, setStart] = useState(defaults.startTime ?? "09:00");
  const [end, setEnd] = useState(defaults.endTime ?? "10:00");
  const [pending, setPending] = useState(false);

  return (
    <form action={action} onSubmit={() => setPending(true)} className="card space-y-5 p-6">
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map((t) => (
          <label key={t.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${type === t.id ? t.chip + " font-medium" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            <input type="radio" name="type" value={t.id} checked={type === t.id} onChange={() => setType(t.id)} className="sr-only" />
            {t.icon} {t.label}
          </label>
        ))}
      </div>

      <label className="block">
        <span className="label">Titre *</span>
        <input name="title" required defaultValue={defaults.title} placeholder="Ex. : Rendez-vous de préparation, visite du lieu…" className="input" />
      </label>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block">
          <span className="label">{multi ? "Du" : "Date"}</span>
          <input type="date" name="day" required defaultValue={defaults.day} className="input" />
        </label>
        {multi && (
          <label className="block">
            <span className="label">Au</span>
            <input type="date" name="endDay" defaultValue={defaults.endDay ?? defaults.day} className="input" />
          </label>
        )}
        {!allDay && (
          <>
            <label className="block">
              <span className="label">Début</span>
              <input type="time" name="startTime" value={start} onChange={(e) => {
                const prevDur = (() => { const [a, b] = start.split(":").map(Number); const [c, d] = end.split(":").map(Number); return c * 60 + d - (a * 60 + b); })();
                setStart(e.target.value);
                if (!multi && e.target.value) setEnd(addMinutes(e.target.value, prevDur > 0 ? prevDur : 60));
              }} className="input" />
            </label>
            <label className="block">
              <span className="label">Fin</span>
              <input type="time" name="endTime" value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
            </label>
          </>
        )}
        <div className="flex flex-col justify-end gap-1.5 pb-1 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-brand-600" /> Journée entière</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="accent-brand-600" /> Sur plusieurs jours</label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Client</span>
          <select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
            <option value="">Aucun (événement interne)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Prestation</span>
          <select name="dossierId" defaultValue={defaults.dossierId ?? ""} className="input" disabled={!clientId}>
            <option value="">Aucun</option>
            {dossiers.filter((d) => d.clientId === clientId).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">{type === "VISIO" ? "Lien de la visio" : type === "APPEL" ? "Numéro à appeler" : "Lieu"}</span>
          <input name="location" defaultValue={defaults.location} placeholder={type === "VISIO" ? "https://meet.google.com/…" : type === "APPEL" ? "06 …" : "Adresse, salle…"} className="input" />
        </label>
      </div>

      <div>
        <span className="label">Participants de l'équipe</span>
        <div className="flex flex-wrap gap-2">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-link-500 has-[:checked]:bg-link-100/40">
              <input type="checkbox" name="attendees" value={u.id} defaultChecked={u.id === me || defaults.attendees?.includes(u.id)} className="accent-link-600" />
              {u.name}{u.id === me && " (moi)"}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Chaque participant reçoit une notification et voit l'événement dans son agenda.</p>
      </div>

      <label className="block">
        <span className="label">Ordre du jour / notes de préparation</span>
        <textarea name="description" rows={4} defaultValue={defaults.description} className="input" />
      </label>

      <button className="btn-primary" disabled={pending}>{pending ? "Enregistrement…" : submit}</button>
    </form>
  );
}
