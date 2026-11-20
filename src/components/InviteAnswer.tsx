"use client";
import { useState, useTransition } from "react";

const OPTS: [string, string, string][] = [["DISPO", "✅ Je suis dispo", "bg-emerald-600 text-white"], ["PEUT_ETRE", "🤔 Peut-être", "bg-amber-500 text-white"], ["PAS_DISPO", "❌ Pas dispo", "bg-slate-600 text-white"]];

export function InviteAnswer({ current, comment: initial, answer }: { current: string | null; comment: string; answer: (a: string, c: string) => Promise<{ error?: string; ok?: boolean }> }) {
  const [pending, run] = useTransition();
  const [sel, setSel] = useState(current);
  const [comment, setComment] = useState(initial);
  const [msg, setMsg] = useState("");
  const send = (a: string) => run(async () => { const r = await answer(a, comment); if (r.error) setMsg(r.error); else { setSel(a); setMsg("Merci, c'est transmis !"); } });
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTS.map(([k, l, c]) => <button key={k} type="button" disabled={pending} onClick={() => send(k)} className={`rounded-2xl px-4 py-4 text-base font-semibold ring-1 transition ${sel === k ? `${c} ring-transparent` : "bg-white ring-slate-200 hover:bg-slate-50"}`}>{l}</button>)}
      </div>
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Un mot ? (ex. dispo à partir de 19 h, j'ai mon véhicule)" className="input" />
      {sel && comment !== initial && <button type="button" disabled={pending} onClick={() => send(sel)} className="text-sm text-link-600 hover:underline">Envoyer le mot</button>}
      {msg && <p role="status" className="text-sm font-medium text-emerald-700">{msg}</p>}
    </div>
  );
}
