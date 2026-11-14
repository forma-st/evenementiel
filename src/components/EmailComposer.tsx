"use client";
import { useRef, useState } from "react";

/** Rédaction d'un e-mail au client, à partir d'un modèle déjà personnalisé. */
export function EmailComposer({ action, to, templates, simulated }: {
  action: (f: FormData) => Promise<void>;
  to: string;
  templates: { id: string; name: string; subject: string; body: string }[];
  simulated: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={async (f) => { await action(f); setSent(true); setSubject(""); setBody(""); }} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="to" defaultValue={to} placeholder="Destinataire" className="input" />
        <select onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setSubject(t.subject); setBody(t.body); setSent(false); } }} defaultValue="" className="input">
          <option value="">Partir d&apos;un modèle…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet" required className="input" />
      <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Votre message…" required className="input" />
      <div className="flex items-center gap-3">
        <button className="btn-primary">Envoyer</button>
        {sent && <span className="text-sm text-emerald-700">✓ {simulated ? "Enregistré (mode simulation, non envoyé)" : "Envoyé"}</span>}
        {simulated && !sent && <span className="text-xs text-amber-700">Mode simulation : configurez l&apos;envoi dans Paramètres › Intégrations.</span>}
      </div>
    </form>
  );
}
