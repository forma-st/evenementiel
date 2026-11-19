"use client";
import { useState, useTransition } from "react";
import { saveRule } from "@/app/(staff)/parametres/automatisations/actions";
import { ACTION_KINDS, TARGETS, TRIGGERS, type AutomationAction, type Target } from "@/lib/automationDefs";
import { DOSSIER_STATUSES } from "@/lib/format";
import { EVENT_KINDS } from "@/lib/presta";
import { TASK_PRIORITIES, TASK_TYPES } from "@/lib/tasks";

type Opt = { id: string; name: string };
export type RuleData = { id?: string; name: string; trigger: string; toStatus: string; offsetDays: number; onlyStatuses: string; eventTypes: string; active: boolean; actions: AutomationAction[] };

const blank = (kind: AutomationAction["kind"], c: { q?: string; t?: string }): AutomationAction =>
  kind === "CREATE_TASK" ? { kind, title: "", type: "TACHE", priority: "NORMALE", dueInDays: 2, assignTo: "DOSSIER_ASSIGNEE" }
  : kind === "NOTIFY" ? { kind, to: "DOSSIER_ASSIGNEE", message: "" }
  : kind === "SEND_QUESTIONNAIRE" ? { kind, questionnaireId: c.q ?? "" }
  : kind === "SEND_EMAIL" ? { kind, templateId: c.t ?? "" }
  : kind === "SET_STATUS" ? { kind, status: "CONFIRME" }
  : kind === "CREATE_PAYMENTS" ? { kind, balanceDaysBefore: 7 }
  : { kind, message: "" };

function TargetSelect({ value, onChange, users }: { value: Target; onChange: (t: Target) => void; users: Opt[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Target)} className="input">
      {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      <optgroup label="Un membre précis">{users.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}</optgroup>
    </select>
  );
}

function Multi({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const sel = value ? value.split(",") : [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange((sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id]).join(","))} className={`rounded-full border px-2.5 py-1 text-xs ${sel.includes(o.id) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function RuleEditor({ rule, users, questionnaires, templates, onDone }: {
  rule?: RuleData;
  users: Opt[];
  questionnaires: { id: string; title: string }[];
  templates: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [r, setR] = useState<RuleData>(rule ?? { name: "", trigger: "STATUS", toStatus: "CONFIRME", offsetDays: -7, onlyStatuses: "", eventTypes: "", active: true, actions: [blank("SEND_EMAIL", { t: templates[0]?.id })] });
  const [pending, start] = useTransition();
  const up = (p: Partial<RuleData>) => setR((x) => ({ ...x, ...p }));
  const set = (i: number, patch: Partial<AutomationAction>) => up({ actions: r.actions.map((x, j) => (j === i ? ({ ...x, ...patch } as AutomationAction) : x)) });
  const before = r.offsetDays < 0;

  return (
    <div className="card space-y-5 border-l-4 border-l-brand-600 p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block"><span className="label">Nom de la règle</span><input value={r.name} onChange={(e) => up({ name: e.target.value })} placeholder="Ex. : J-30 : questionnaire de préparation" className="input" /></label>
        <label className="flex items-end gap-2 pb-2.5 text-sm"><input type="checkbox" checked={r.active} onChange={(e) => up({ active: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Active</label>
      </div>

      <div className="space-y-3 rounded-lg bg-slate-50 p-4">
        <div className="text-sm font-semibold">Quand :</div>
        <select value={r.trigger} onChange={(e) => up({ trigger: e.target.value, offsetDays: e.target.value === "EVENT_OFFSET" ? -7 : e.target.value === "QUOTE_NO_REPLY" ? 7 : 3 })} className="input">
          {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {r.trigger === "STATUS" && (
          <select value={r.toStatus} onChange={(e) => up({ toStatus: e.target.value })} className="input">{DOSSIER_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        )}
        {r.trigger === "EVENT_OFFSET" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input type="number" min={0} max={365} value={Math.abs(r.offsetDays)} onChange={(e) => up({ offsetDays: (before ? -1 : 1) * Math.abs(Number(e.target.value)) })} className="input w-24" /> jour(s)
            <select value={before ? "avant" : "apres"} onChange={(e) => up({ offsetDays: (e.target.value === "avant" ? -1 : 1) * Math.abs(r.offsetDays) })} className="input w-auto">
              <option value="avant">avant l&apos;événement</option><option value="apres">après l&apos;événement</option>
            </select>
            <span className="text-slate-500">(0 = le jour J)</span>
          </div>
        )}
        {(r.trigger === "QUOTE_NO_REPLY" || r.trigger === "PAYMENT_LATE") && (
          <label className="flex items-center gap-2 text-sm">après <input type="number" min={0} max={90} value={r.offsetDays} onChange={(e) => up({ offsetDays: Number(e.target.value) })} className="input w-24" /> jour(s) {r.trigger === "QUOTE_NO_REPLY" ? "sans réponse à un devis envoyé" : "de retard sur une échéance"}</label>
        )}
        {r.trigger === "EVENT_OFFSET" && (
          <div><div className="mb-1 text-xs text-slate-500">Seulement pour les prestations au statut (vide = confirmées, réalisées, clôturées) :</div><Multi options={DOSSIER_STATUSES.map((s) => ({ id: s.id, label: s.label }))} value={r.onlyStatuses} onChange={(v) => up({ onlyStatuses: v })} /></div>
        )}
        <div><div className="mb-1 text-xs text-slate-500">Seulement pour ces types d&apos;événements (vide = tous) :</div><Multi options={EVENT_KINDS.map((k) => ({ id: k.id, label: `${k.icon} ${k.label}` }))} value={r.eventTypes} onChange={(v) => up({ eventTypes: v })} /></div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold">Alors :</div>
        {r.actions.map((a, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>{i + 1}. {ACTION_KINDS.find((k) => k.id === a.kind)?.label}</span>
              <button type="button" onClick={() => up({ actions: r.actions.filter((_, j) => j !== i) })} className="text-xs text-slate-400 hover:text-rose-600">Retirer</button>
            </div>
            {a.kind === "SEND_EMAIL" && (
              <select value={a.templateId} onChange={(e) => set(i, { templateId: e.target.value })} className="input">
                <option value="">Choisir un modèle d&apos;e-mail…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            {a.kind === "CREATE_TASK" && (
              <div className="grid gap-2 sm:grid-cols-6">
                <input value={a.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Titre, ex. : Appeler {{client.nom}}" className="input sm:col-span-6" />
                <select value={a.type} onChange={(e) => set(i, { type: e.target.value })} className="input">{TASK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}</select>
                <select value={a.priority} onChange={(e) => set(i, { priority: e.target.value })} className="input">{TASK_PRIORITIES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                <label className="flex items-center gap-2 text-sm">J+<input type="number" min={0} max={365} value={a.dueInDays} onChange={(e) => set(i, { dueInDays: Number(e.target.value) })} className="input w-20" /></label>
                <div className="sm:col-span-3"><TargetSelect value={a.assignTo} onChange={(t) => set(i, { assignTo: t })} users={users} /></div>
              </div>
            )}
            {a.kind === "NOTIFY" && (
              <div className="grid gap-2 sm:grid-cols-3">
                <TargetSelect value={a.to} onChange={(t) => set(i, { to: t })} users={users} />
                <input value={a.message} onChange={(e) => set(i, { message: e.target.value })} placeholder="Message" className="input sm:col-span-2" />
              </div>
            )}
            {a.kind === "SEND_QUESTIONNAIRE" && (
              <select value={a.questionnaireId} onChange={(e) => set(i, { questionnaireId: e.target.value })} className="input">
                <option value="">Choisir un questionnaire…</option>
                {questionnaires.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            )}
            {a.kind === "SET_STATUS" && (
              <select value={a.status} onChange={(e) => set(i, { status: e.target.value })} className="input">{DOSSIER_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            )}
            {a.kind === "CREATE_PAYMENTS" && (
              <label className="flex items-center gap-2 text-sm">Acompte selon le devis, solde dû <input type="number" min={0} max={90} value={a.balanceDaysBefore} onChange={(e) => set(i, { balanceDaysBefore: Number(e.target.value) })} className="input w-20" /> jours avant l&apos;événement</label>
            )}
            {a.kind === "POST_CHANNEL" && <input value={a.message} onChange={(e) => set(i, { message: e.target.value })} placeholder="Ex. : 🎉 {{prestation.titre}} confirmé !" className="input" />}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {ACTION_KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => up({ actions: [...r.actions, blank(k.id, { q: questionnaires[0]?.id, t: templates[0]?.id })] })} className="btn-secondary py-1.5 text-xs">+ {k.label}</button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Dans les textes : variables {"{{client.nom}}"}, {"{{prestation.date}}"}, {"{{prestation.reference}}"}… (liste complète dans Modèles d&apos;e-mails).</p>
      </div>

      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => start(async () => { await saveRule(rule?.id ?? null, r); onDone(); })} className="btn-primary">{pending ? "Enregistrement…" : "Enregistrer la règle"}</button>
        <button type="button" onClick={onDone} className="btn-secondary">Annuler</button>
      </div>
    </div>
  );
}
