"use client";
import { useCallback, useEffect, useState } from "react";
import { submitSelection, toggleFavorite } from "./actions";

type F = { id: string; name: string; mime: string; size: number; url: string; thumbUrl: string | null; favorite: boolean; width: number | null; height: number | null };
const size = (n: number) => (n < 1024 ** 2 ? `${Math.round(n / 1024)} Ko` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1).replace(".", ",")} Mo` : `${(n / 1024 ** 3).toFixed(2).replace(".", ",")} Go`);

export function GalleryView({ token, kind, files: initial, allowDownload, allowFavorites }: { token: string; kind: string; files: F[]; allowDownload: boolean; allowFavorites: boolean }) {
  const [files, setFiles] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [onlyFav, setOnlyFav] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const photos = files.filter((f) => f.thumbUrl || f.mime.startsWith("image/"));
  const others = files.filter((f) => !photos.includes(f));
  const shown = onlyFav ? photos.filter((f) => f.favorite) : photos;
  const favCount = files.filter((f) => f.favorite).length;
  const total = files.reduce((a, f) => a + f.size, 0);

  const fav = async (id: string) => {
    setFiles((xs) => xs.map((x) => (x.id === id ? { ...x, favorite: !x.favorite } : x)));
    const r = await toggleFavorite(token, id);
    if (r !== null) setFiles((xs) => xs.map((x) => (x.id === id ? { ...x, favorite: r } : x)));
  };
  const nav = useCallback((d: number) => setOpen((o) => (o === null ? o : (o + d + shown.length) % shown.length)), [shown.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (open === null) return; if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") nav(1); if (e.key === "ArrowLeft") nav(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, nav]);

  const cur = open !== null ? shown[open] : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-zinc-400">{files.length} fichier(s) · {size(total)}</span>
        {allowFavorites && photos.length > 0 && (
          <div className="flex gap-1 rounded-full bg-zinc-900 p-1 text-sm">
            <button onClick={() => setOnlyFav(false)} className={`rounded-full px-3 py-1 ${!onlyFav ? "bg-zinc-700" : "text-zinc-400"}`}>Toutes</button>
            <button onClick={() => setOnlyFav(true)} className={`rounded-full px-3 py-1 ${onlyFav ? "bg-rose-600" : "text-zinc-400"}`}>♥ Mes favorites ({favCount})</button>
          </div>
        )}
        <span className="ml-auto" />
        {allowFavorites && favCount > 0 && (
          <button onClick={async () => { const r = await submitSelection(token); setSent(r.ok ? `Merci ! Votre sélection de ${r.n} photo(s) a été transmise.` : r.error ?? "Erreur"); }} className="rounded-full border border-rose-500 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10">Valider ma sélection</button>
        )}
        {allowDownload && favCount > 0 && <a href={`/api/g/${token}/zip?favoris=1`} className="rounded-full border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800">⬇ Favorites (ZIP)</a>}
        {allowDownload && files.length > 0 && <a href={`/api/g/${token}/zip`} className="rounded-full bg-[#fff] px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200">⬇ Tout télécharger</a>}
      </div>
      {sent && <p className="mb-4 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm text-emerald-300">{sent}</p>}

      {shown.length > 0 && (
        <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 [&>*]:mb-2">
          {shown.map((f, i) => (
            <div key={f.id} className="group relative break-inside-avoid overflow-hidden rounded-lg bg-zinc-900">
              <button onClick={() => setOpen(i)} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.thumbUrl ?? f.url} alt={f.name} loading="lazy" width={f.width ?? undefined} height={f.height ?? undefined} className="h-auto w-full transition group-hover:opacity-90" />
              </button>
              {allowFavorites && (
                <button onClick={() => fav(f.id)} aria-label="Favori" className={`absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-lg ${f.favorite ? "bg-rose-600 text-white" : "bg-black/40 text-white opacity-0 group-hover:opacity-100"}`}>♥</button>
              )}
            </div>
          ))}
        </div>
      )}
      {onlyFav && shown.length === 0 && <p className="py-16 text-center text-zinc-400">Touchez le ♥ sur vos photos préférées pour les retrouver ici.</p>}

      {others.length > 0 && !onlyFav && (
        <div className="mt-8 divide-y divide-zinc-800 rounded-xl bg-zinc-900">
          {others.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0"><div className="truncate">{f.mime.startsWith("video/") ? "🎬" : "📄"} {f.name}</div><div className="text-xs text-zinc-500">{size(f.size)}</div></div>
              {allowDownload && <a href={`/api/g/${token}/f/${f.id}`} className="shrink-0 rounded-full border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800">⬇ Télécharger</a>}
            </div>
          ))}
        </div>
      )}
      {files.length === 0 && <p className="py-16 text-center text-zinc-400">{kind === "TRANSFERT" ? "Aucun fichier pour le moment." : "Les photos arrivent bientôt."}</p>}

      {cur && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between gap-3 p-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <span className="truncate text-zinc-400">{open! + 1} / {shown.length} · {cur.name}</span>
            <div className="flex gap-2">
              {allowFavorites && <button onClick={() => fav(cur.id)} className={`rounded-full px-3 py-1.5 ${cur.favorite ? "bg-rose-600" : "bg-zinc-800"}`}>♥ {cur.favorite ? "Favorite" : "Ajouter aux favorites"}</button>}
              {allowDownload && <a href={`/api/g/${token}/f/${cur.id}`} className="rounded-full bg-zinc-800 px-3 py-1.5">⬇</a>}
              <button onClick={() => setOpen(null)} className="rounded-full bg-zinc-800 px-3 py-1.5">✕</button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
            <button onClick={(e) => { e.stopPropagation(); nav(-1); }} className="absolute left-2 z-10 rounded-full bg-zinc-800/80 px-3 py-2 text-xl">‹</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={cur.name} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full object-contain" />
            <button onClick={(e) => { e.stopPropagation(); nav(1); }} className="absolute right-2 z-10 rounded-full bg-zinc-800/80 px-3 py-2 text-xl">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
