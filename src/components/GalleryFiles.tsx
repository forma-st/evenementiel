"use client";
import { useState, useTransition } from "react";

type F = { id: string; name: string; mime: string; size: number; url: string; thumbUrl: string | null; favorite: boolean };

const size = (n: number) => (n < 1024 ** 2 ? `${Math.round(n / 1024)} Ko` : `${(n / 1024 ** 2).toFixed(1).replace(".", ",")} Mo`);

/** Grille des fichiers d'une galerie (équipe) : sélection, suppression, couverture, favoris du client. */
export function GalleryFiles({ files, coverId, onDelete, onCover }: {
  files: F[];
  coverId: string | null;
  onDelete: (ids: string[]) => Promise<void>;
  onCover: (id: string) => Promise<void>;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [onlyFav, setOnlyFav] = useState(false);
  const [pending, start] = useTransition();
  const list = onlyFav ? files.filter((f) => f.favorite) : files;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const favCount = files.filter((f) => f.favorite).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setOnlyFav(false)} className={`badge px-3 py-1.5 ${!onlyFav ? "bg-ink text-paper" : "border border-slate-200"}`}>Tous ({files.length})</button>
        <button type="button" onClick={() => setOnlyFav(true)} className={`badge px-3 py-1.5 ${onlyFav ? "bg-rose-600 text-white" : "border border-slate-200"}`}>♥ Sélection du client ({favCount})</button>
        {onlyFav && favCount > 0 && (
          <button type="button" onClick={() => navigator.clipboard.writeText(files.filter((f) => f.favorite).map((f) => f.name).join("\n"))} className="text-xs text-link-600 hover:underline">Copier la liste des noms (pour Lightroom)</button>
        )}
        <span className="ml-auto" />
        {sel.size > 0 && (
          <>
            <span className="text-slate-500">{sel.size} sélectionné(s)</span>
            <button type="button" onClick={() => setSel(new Set())} className="btn-secondary py-1 text-xs">Désélectionner</button>
            <button type="button" disabled={pending} onClick={() => confirm(`Supprimer ${sel.size} fichier(s) ?`) && start(async () => { await onDelete([...sel]); setSel(new Set()); })} className="btn-danger py-1 text-xs">Supprimer</button>
          </>
        )}
        {sel.size === 0 && list.length > 0 && <button type="button" onClick={() => setSel(new Set(list.map((f) => f.id)))} className="btn-secondary py-1 text-xs">Tout sélectionner</button>}
      </div>
      {list.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">{onlyFav ? "Le client n'a pas encore choisi de photos." : "Aucun fichier pour le moment."}</p> : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {list.map((f) => (
            <div key={f.id} className={`group relative overflow-hidden rounded-lg border ${sel.has(f.id) ? "border-brand-600 ring-2 ring-brand-500" : "border-slate-200"}`}>
              <button type="button" onClick={() => toggle(f.id)} className="block aspect-square w-full bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.thumbUrl ? <img src={f.thumbUrl} alt={f.name} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-2 text-center text-[11px] break-all text-slate-500">📄 {f.name}</span>}
              </button>
              {f.favorite && <span className="absolute top-1 left-1 rounded-full bg-white/90 px-1.5 text-xs text-rose-600">♥</span>}
              {coverId === f.id && <span className="absolute top-1 right-1 rounded bg-brand-600 px-1 text-[10px] text-white">couverture</span>}
              <div className="flex items-center justify-between gap-1 bg-white px-1.5 py-1 text-[10px] text-slate-500">
                <span className="truncate" title={f.name}>{f.name}</span>
                <span className="shrink-0">{size(f.size)}</span>
              </div>
              {f.thumbUrl && coverId !== f.id && (
                <button type="button" onClick={() => start(() => onCover(f.id))} className="absolute right-1 bottom-7 hidden rounded bg-white/90 px-1.5 text-[10px] group-hover:block">Couverture</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
