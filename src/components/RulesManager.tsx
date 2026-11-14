"use client";
import { useState, useTransition } from "react";
import { deleteRule, runNow, toggleRule } from "@/app/(staff)/parametres/automatisations/actions";
import { TRIGGERS, describeAction, describeTrigger, type AutomationAction } from "@/lib/automations";
import { RuleEditor, type RuleData } from "./RuleEditor";

type Rule = RuleData & { id: string; runs: number };
type Ctx = { users: { id: string; name: string }[]; questionnaires: { id: string; title: string }[]; templates: { id: string; name: string }[] };

export function RulesManager({ rules, lastRun, mail, ...ctx }: Ctx & { rules: Rule[]; lastRun: string | null; mail: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-1 text-sm text-slate-600">
          <p>Les règles s&apos;exécutent seules : au changement de statut, quand le client accepte un devis ou signe un contrat, à la publication d&apos;une galerie, et chaque matin pour les rappels datés (J-45, J-7, J+2…), les devis sans réponse et les paiements en retard. Chaque action est notée dans le journal de la prestation.</p>
          <p className="text-xs">Dernière vérification quotidienne : {lastRun ?? "jamais"} · E-mails : {mail ? "envoi réel" : "mode simulation (enregistrés sans être envoyés)"}</p>
        </div>
        <div className="flex gap-2">
          <button disabled={pending} onClick={() => start(async () => { const r = await runNow(); setResult(`${r.executed} règle(s) exécutée(s).`); })} className="btn-secondary">{pending ? "…" : "▶ Lancer la vérification"}</button>
          {editing !== "new" && <button onClick={() => setEditing("new")} className="btn-primary">+ Nouvelle règle</button>}
        </div>
      </div>
      {result && <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{result}</p>}
      {editing === "new" && <RuleEditor {...ctx} onDone={() => setEditing(null)} />}

      {TRIGGERS.map((t) => {
        const list = rules.filter((r) => r.trigger === t.id);
        if (!list.length) return null;
        return (
          <section key={t.id}>
            <h2 className="mb-2 text-sm font-semibold">{t.label} <span className="font-normal text-slate-500">— {t.help}</span></h2>
            <div className="space-y-3">
              {list.map((r) =>
                editing === r.id ? (
                  <RuleEditor key={r.id} rule={r} {...ctx} onDone={() => setEditing(null)} />
                ) : (
                  <div key={r.id} className={`card p-4 ${r.active ? "" : "opacity-60"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><span className="font-medium">⚡ {r.name}</span> <span className="badge ml-2 bg-brand-50 text-brand-700">{describeTrigger(r)}</span>{r.runs > 0 && <span className="ml-2 text-xs text-slate-500">exécutée {r.runs} fois</span>}</div>
                      <div className="flex items-center gap-3 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={r.active} onChange={(e) => start(() => toggleRule(r.id, e.target.checked))} className="h-4 w-4 accent-brand-600" />{r.active ? "Active" : "Désactivée"}</label>
                        <button onClick={() => setEditing(r.id)} className="text-link-600 hover:underline">Modifier</button>
                        <button onClick={() => confirm(`Supprimer la règle « ${r.name} » ?`) && start(() => deleteRule(r.id))} className="text-slate-400 hover:text-rose-600">Supprimer</button>
                      </div>
                    </div>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
                      {r.actions.map((a: AutomationAction, i: number) => <li key={i}>{describeAction(a, ctx)}</li>)}
                    </ul>
                  </div>
                ),
              )}
            </div>
          </section>
        );
      })}
      {rules.length === 0 && editing !== "new" && <div className="card p-8 text-center text-sm text-slate-500">Aucune règle pour l&apos;instant.</div>}
    </div>
  );
}
