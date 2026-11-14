"use client";
import { useState } from "react";

type G = { title?: string; message?: string | null; kind?: string; password?: string | null; allowDownload?: boolean; allowFavorites?: boolean; externalUrl?: string | null; externalCode?: string | null; expiresAt?: string; clientId?: string | null; dossierId?: string | null };

export function GalleryForm({ action, g, clients, dossiers, submit, isNew = false }: {
  action: (f: FormData) => Promise<void>;
  g: G;
  clients: { id: string; name: string }[];
  dossiers: { id: string; label: string; clientId: string }[];
  submit: string;
  isNew?: boolean;
}) {
  const [clientId, setClientId] = useState(g.clientId ?? "");
  const [kind, setKind] = useState(g.kind ?? "GALERIE");
  const [usePw, setUsePw] = useState(isNew || !!g.password);
  const [ext, setExt] = useState(!!g.externalUrl);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex gap-2 sm:col-span-2">
        {[["GALERIE", "📷 Galerie photos", "Grille de photos, favoris, téléchargement"], ["TRANSFERT", "📦 Transfert de fichiers", "Envoi de fichiers lourds (vidéos, RAW, ZIP…)"]].map(([k, l, h]) => (
          <label key={k} className={`flex-1 cursor-pointer rounded-xl border p-3 ${kind === k ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            <div className="font-medium">{l}</div><div className="text-xs text-slate-500">{h}</div>
          </label>
        ))}
      </div>
      <label className="block sm:col-span-2"><span className="label">Titre *</span><input name="title" required defaultValue={g.title} placeholder="Mariage de Julie & Thomas" className="input" /></label>
      <label className="block">
        <span className="label">Client</span>
        <select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
          <option value="">Aucun</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Prestation</span>
        <select name="dossierId" defaultValue={g.dossierId ?? ""} className="input">
          <option value="">Aucune</option>
          {dossiers.filter((d) => !clientId || d.clientId === clientId).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>
      <label className="block sm:col-span-2"><span className="label">Message d&apos;accueil</span><textarea name="message" rows={2} defaultValue={g.message ?? ""} className="input" placeholder="Merci encore pour cette magnifique journée ! Voici vos photos…" /></label>
      <div className="space-y-2 text-sm sm:col-span-2">
        <label className="flex items-center gap-2"><input type="checkbox" name="usePassword" checked={usePw} onChange={(e) => setUsePw(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Protéger par un code d&apos;accès</label>
        {usePw && <input name="password" defaultValue={g.password ?? ""} placeholder="Laisser vide pour générer un code" className="input max-w-xs" />}
        <label className="flex items-center gap-2"><input type="checkbox" name="allowDownload" defaultChecked={g.allowDownload ?? true} className="h-4 w-4 accent-brand-600" /> Autoriser le téléchargement (photo par photo et ZIP complet)</label>
        {kind === "GALERIE" && <label className="flex items-center gap-2"><input type="checkbox" name="allowFavorites" defaultChecked={g.allowFavorites ?? true} className="h-4 w-4 accent-brand-600" /> Le client peut choisir ses photos préférées (sélection album / tirages)</label>}
      </div>
      <label className="block"><span className="label">En ligne jusqu&apos;au</span><input type="date" name="expiresAt" defaultValue={g.expiresAt ?? ""} className="input" /></label>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ext} onChange={(e) => setExt(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Les photos sont hébergées ailleurs (Jingoo, Pixieset…)</label>
        {ext && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <input name="externalUrl" defaultValue={g.externalUrl ?? ""} placeholder="https://www.jingoo.com/…" className="input" />
            <input name="externalCode" defaultValue={g.externalCode ?? ""} placeholder="Code d'accès de la galerie externe" className="input" />
          </div>
        )}
      </div>
      <div className="sm:col-span-2"><button className="btn-primary">{submit}</button></div>
    </form>
  );
}
