"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "@/lib/toast";
import { previewBulk, sendBulk, type BulkFilters, type Recipient } from "@/app/(staff)/emails/actions";

type Opt = { id: string; label: string; icon?: string };
const day = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
const fill = (s: string, v: Record<string, string> | null) => (v ? s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => v[k] ?? m) : s);

/** Préréglages de période : jours relatifs à aujourd'hui. */
const PRESETS: [string, number, number][] = [["30 prochains jours", 0, 30], ["3 prochains mois", 0, 90], ["30 derniers jours", -30, 0], ["12 derniers mois", -365, 0]];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (n: number) => iso(new Date(Date.now() + n * 864e5));

export function BulkEmailComposer({ kinds, statuses, templates, vars }: {
  kinds: Opt[]; statuses: Opt[]; templates: { id: string; name: string; subject: string; body: string }[]; vars: [string, string][];
}) {
  const [f, setF] = useState<BulkFilters>({ from: shift(0), to: shift(90), types: [], statuses: ["CONFIRME"], onePerClient: true });
  const [list, setList] = useState<Recipient[] | null>(null);
  const [sample, setSample] = useState<Record<string, string> | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, run] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => run(async () => { const r = await previewBulk(f); setList(r.list); setSample(r.sample); setOff(new Set()); }), 300);
    return () => clearTimeout(t);
  }, [f]);

  const toggle = (k: "types" | "statuses", id: string) => setF((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((y) => y !== id) : [...x[k], id] }));
  const targets = useMemo(() => (list ?? []).filter((r) => r.email && !off.has(r.dossierId)), [list, off]);
  const noEmail = (list ?? []).filter((r) => !r.email).length;
  const insert = (k: string) => {
    const el = area.current; const tag = `{{${k}}}`;
    if (!el) return setBody((b) => b + tag);
    const s = el.selectionStart, e = el.selectionEnd;
    setBody((b) => b.slice(0, s) + tag + b.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tag.length, s + tag.length); });
  };
  const send = () => run(async () => { const r = await sendBulk(f, [...off], subject, body); setMsg(r); setConfirm(false); if (r.ok) { setSubject(""); setBody(""); toast("E-mail groupé envoyé", { body: r.ok, tone: "success" }); } });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">1. Les destinataires</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><span className="label">Prestations du</span><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="input" /></label>
            <label className="block"><span className="label">au</span><input type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} className="input" /></label>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map(([l, a, b]) => <button key={l} type="button" onClick={() => setF({ ...f, from: shift(a), to: shift(b) })} className="rounded-full px-2.5 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50">{l}</button>)}
            </div>
          </div>
          <div>
            <span className="label">Types (aucun = tous)</span>
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => <button key={k.id} type="button" aria-pressed={f.types.includes(k.id)} onClick={() => toggle("types", k.id)} className={`rounded-full px-3 py-1 text-sm ring-1 ${f.types.includes(k.id) ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>{k.icon} {k.label}</button>)}
            </div>
          </div>
          <div>
            <span className="label">Statuts (aucun = tous)</span>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((k) => <button key={k.id} type="button" aria-pressed={f.statuses.includes(k.id)} onClick={() => toggle("statuses", k.id)} className={`rounded-full px-3 py-1 text-sm ring-1 ${f.statuses.includes(k.id) ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>{k.label}</button>)}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.onePerClient} onChange={(e) => setF({ ...f, onePerClient: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Un seul e-mail par client (même s&apos;il a plusieurs prestations)</label>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">2. Le message</h2>
            {templates.length > 0 && (
              <select defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setSubject(t.subject); setBody(t.body); } e.target.value = ""; }} className="input w-auto py-1.5 text-sm">
                <option value="">Partir d&apos;un modèle…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <label className="block"><span className="label">Objet</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} placeholder="Votre soirée du {{prestation.date}} approche !" className="input" /></label>
          <label className="block"><span className="label">Message</span><textarea ref={area} value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder={"Bonjour {{client.nom}},\n\n…"} className="input" /></label>
          <div>
            <span className="text-xs text-slate-500">Insérer une variable (remplacée pour chaque client) :</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {vars.slice(0, 14).map(([k, l]) => <button key={k} type="button" title={l} onClick={() => insert(k)} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-brand-50 hover:text-brand-700">{`{{${k}}}`}</button>)}
            </div>
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/85 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
          {!confirm
            ? <button type="button" disabled={pending || !targets.length || !subject.trim() || !body.trim()} onClick={() => { setConfirm(true); setMsg(null); }} className="btn-primary">Envoyer à {targets.length} client{targets.length > 1 ? "s" : ""}</button>
            : <>
                <span className="text-sm font-medium">Envoyer maintenant à {targets.length} destinataire{targets.length > 1 ? "s" : ""} ?</span>
                <button type="button" disabled={pending} onClick={send} className="btn-primary">{pending ? "Envoi en cours…" : "Oui, envoyer"}</button>
                <button type="button" onClick={() => setConfirm(false)} className="btn-secondary">Annuler</button>
              </>}
          {msg?.ok && <span role="status" className="text-sm text-emerald-700">✓ {msg.ok}</span>}
          {msg?.error && <span role="alert" className="text-sm font-medium text-rose-700">⛔ {msg.error}</span>}
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm">
            <span className="font-medium">Destinataires <span className="badge ml-1 bg-slate-100 text-slate-600">{targets.length}</span></span>
            {pending && <span className="text-xs text-slate-400">mise à jour…</span>}
          </div>
          {list === null ? <p className="p-4 text-sm text-slate-500">Chargement…</p> : list.length === 0 ? <p className="p-4 text-sm text-slate-500">Aucune prestation ne correspond.</p> : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto text-sm">
              {list.map((r) => (
                <li key={r.dossierId} className={`flex items-center gap-2 px-4 py-2 ${!r.email || off.has(r.dossierId) ? "opacity-50" : ""}`}>
                  <input type="checkbox" disabled={!r.email} checked={!!r.email && !off.has(r.dossierId)} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(r.dossierId)) n.delete(r.dossierId); else n.add(r.dossierId); return n; })} className="h-4 w-4 accent-brand-600" aria-label={`Inclure ${r.client}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.client}</div>
                    <div className="truncate text-xs text-slate-500">{r.email ?? "pas d'e-mail"} · {r.date ? day(r.date) : "sans date"} · {r.reference}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {noEmail > 0 && <p className="border-t border-slate-100 px-4 py-2 text-xs text-amber-700">{noEmail} client(s) sans adresse e-mail ignoré(s).</p>}
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-medium">Aperçu {sample && <span className="font-normal text-slate-500">— pour {sample["client.nom"]}</span>}</div>
          <div className="space-y-2 p-4 text-sm">
            <div className="font-semibold">{fill(subject, sample) || <span className="text-slate-400">Objet</span>}</div>
            <div className="whitespace-pre-wrap text-slate-700">{fill(body, sample) || <span className="text-slate-400">Le message apparaîtra ici, variables remplacées.</span>}</div>
          </div>
        </section>
      </aside>
    </div>
  );
}
