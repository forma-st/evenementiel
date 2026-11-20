"use client";
import { useActionState, useState } from "react";
import { quickLoan } from "@/app/(staff)/materiel/sortie/actions";
import { GearPicker } from "./GearPicker";

type Who = { key: string; name: string; hint: string };
const pad = (n: number) => String(n).padStart(2, "0");
function defaults() {
  const now = new Date(Math.ceil(Date.now() / 9e5) * 9e5); // au quart d'heure
  const tom = new Date(now.getTime() + 864e5);
  const d = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  return { sd: d(now), st: `${pad(now.getHours())}:${pad(now.getMinutes())}`, ed: d(tom), et: "18:00" };
}

/** Sortie de matériel express : à qui, jusqu'à quand, quoi. */
export function QuickLoanForm({ recent, team, others }: { recent: Who[]; team: Who[]; others: Who[] }) {
  const [state, run, pending] = useActionState(quickLoan, null);
  const [who, setWho] = useState(recent[0]?.key ?? "");
  const [dt, setDt] = useState(defaults);
  const chips = [...recent, ...team.filter((t) => !recent.some((r) => r.key === t.key))];
  const setRet = (days: number) => { const b = new Date(`${dt.sd}T12:00:00`); b.setDate(b.getDate() + days); setDt({ ...dt, ed: `${b.getFullYear()}-${pad(b.getMonth() + 1)}-${pad(b.getDate())}` }); };

  return (
    <form action={run} className="space-y-5">
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">1. À qui ?</h2>
        <input type="hidden" name="borrower" value={who} />
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={() => setWho(c.key)} aria-pressed={who === c.key}
              className={`rounded-2xl px-4 py-2.5 text-left text-sm ring-1 transition ${who === c.key ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>
              <span className="block font-medium">{c.name}</span><span className={`block text-xs ${who === c.key ? "opacity-80" : "text-slate-500"}`}>{c.hint}</span>
            </button>
          ))}
          <button type="button" onClick={() => setWho("new")} aria-pressed={who === "new"} className={`rounded-2xl px-4 py-2.5 text-sm ring-1 ${who === "new" ? "bg-brand-600 text-white ring-brand-600" : "border-dashed ring-slate-300 hover:bg-slate-50"}`}>+ Nouvelle personne</button>
        </div>
        {others.length > 0 && (
          <select value={others.some((o) => o.key === who) ? who : ""} onChange={(e) => e.target.value && setWho(e.target.value)} className="input max-w-sm py-1.5 text-sm" aria-label="Autre emprunteur">
            <option value="">Autre client ou associé…</option>
            {others.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
          </select>
        )}
        {who === "new" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="newName" required autoFocus placeholder="Prénom et nom (ex. Steevy)" className="input" />
            <input name="newPhone" inputMode="tel" placeholder="Téléphone (facultatif)" className="input" />
          </div>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">2. Quand ?</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block"><span className="label">Sortie le</span><input name="startDate" type="date" required value={dt.sd} onChange={(e) => setDt({ ...dt, sd: e.target.value })} className="input" /></label>
          <label className="block"><span className="label">à</span><input name="startTime" type="time" required value={dt.st} onChange={(e) => setDt({ ...dt, st: e.target.value })} className="input" /></label>
          <label className="block"><span className="label">Retour prévu le</span><input name="endDate" type="date" required min={dt.sd} value={dt.ed} onChange={(e) => setDt({ ...dt, ed: e.target.value })} className="input" /></label>
          <label className="block"><span className="label">à</span><input name="endTime" type="time" required value={dt.et} onChange={(e) => setDt({ ...dt, et: e.target.value })} className="input" /></label>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="py-1 text-slate-500">Retour :</span>
          {[[0, "le jour même"], [1, "demain"], [2, "dans 2 jours"], [7, "dans 1 semaine"]].map(([n, l]) => <button key={n} type="button" onClick={() => setRet(n as number)} className="rounded-full px-2.5 py-1 ring-1 ring-slate-200 hover:bg-slate-50">{l}</button>)}
        </div>
        <input name="place" placeholder="Où va le matériel ? (facultatif : salle, événement…)" className="input" />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">3. Quel matériel ?</h2>
        <GearPicker date={dt.sd} start={dt.st} endDate={dt.ed} endTime={dt.et} />
        <textarea name="notes" rows={2} placeholder="Remarques : accessoires fournis, état, câbles, housses…" className="input" />
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="handNow" defaultChecked className="h-4 w-4 accent-brand-600" /> Le matériel part maintenant</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="signNow" defaultChecked className="h-4 w-4 accent-brand-600" /> Faire signer le bon de sortie</label>
        <button className="btn-primary ml-auto px-6" disabled={pending || !who}>{pending ? "Enregistrement…" : "🤝 Valider la sortie"}</button>
        {state?.error && <p role="alert" className="w-full text-sm font-medium text-rose-700">⛔ {state.error}</p>}
      </div>
    </form>
  );
}
