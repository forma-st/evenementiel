"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/lib/toast";
import { saveMusicPlan, setMusicClientEdit } from "@/app/music-actions";
import { spotifyEmbed, uid, type Moment, type MusicData, type Track } from "@/lib/music";

type Hit = { title: string; artist: string; url: string; image: string | null };

/** Champ titre avec suggestions Spotify (si l'application Spotify est configurée), sinon saisie libre « Titre — Artiste ». */
function TrackInput({ onAdd, placeholder, spotify }: { onAdd: (t: Track) => void; placeholder: string; spotify: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    if (!spotify || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j) => setHits(j.items ?? [])).catch(() => setHits([])), 300);
    return () => clearTimeout(t);
  }, [q, spotify]);
  const addFree = () => {
    const v = q.trim(); if (!v) return;
    const [title, ...rest] = v.split(/\s+[—–-]\s+/);
    onAdd({ id: uid(), title: title.trim(), artist: rest.join(" - ").trim() }); setQ(""); setHits([]);
  };
  return (
    <div className="relative">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFree(); } }} placeholder={placeholder} className="input py-1.5" />
        <button type="button" onClick={addFree} disabled={!q.trim()} className="btn-secondary shrink-0 py-1.5">Ajouter</button>
      </div>
      {hits.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
          {hits.map((h) => (
            <li key={h.url}>
              <button type="button" onClick={() => { onAdd({ id: uid(), title: h.title, artist: h.artist, url: h.url }); setQ(""); setHits([]); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                {h.image ? <img src={h.image} alt="" className="h-8 w-8 rounded" /> : <span className="h-8 w-8 rounded bg-slate-100" />}
                <span className="min-w-0"><span className="block truncate font-medium">{h.title}</span><span className="block truncate text-xs text-slate-500">{h.artist}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrackList({ items, onRemove, tone }: { items: Track[]; onRemove: (id: string) => void; tone: "ok" | "no" }) {
  if (!items.length) return <p className="text-sm text-slate-400">Aucun titre pour l&apos;instant.</p>;
  return (
    <ul className="space-y-1">
      {items.map((t) => (
        <li key={t.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${tone === "ok" ? "bg-emerald-50" : "bg-rose-50"}`}>
          <span aria-hidden>{tone === "ok" ? "♥" : "✕"}</span>
          <span className="min-w-0 flex-1 truncate"><span className="font-medium">{t.title}</span>{t.artist && <span className="text-slate-500"> — {t.artist}</span>}</span>
          {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-xs text-link-600 hover:underline">Écouter</a>}
          <button type="button" onClick={() => onRemove(t.id)} aria-label={`Retirer ${t.title}`} className="text-slate-400 hover:text-rose-600">×</button>
        </li>
      ))}
    </ul>
  );
}

export function MusicPlanner({ dossierId, initial, role, clientCanEdit, spotify, updatedBy, updatedAt }: {
  dossierId: string; initial: MusicData; role: "staff" | "client"; clientCanEdit: boolean; spotify: boolean; updatedBy?: string | null; updatedAt?: string | null;
}) {
  const [m, setM] = useState<MusicData>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState("");
  const [pending, run] = useTransition();
  const readOnly = role === "client" && !clientCanEdit;
  const dirty = JSON.stringify(m) !== saved;
  const embed = spotifyEmbed(m.playlistUrl);
  const drag = useRef<number | null>(null);

  const set = <K extends keyof MusicData>(k: K, v: MusicData[K]) => { setM((x) => ({ ...x, [k]: v })); setMsg(""); setErr(""); };
  const setMoment = (i: number, p: Partial<Moment>) => set("moments", m.moments.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const save = () => run(async () => {
    const r = await saveMusicPlan(dossierId, m);
    if (r.error) setErr(r.error); else { setSaved(JSON.stringify(m)); setMsg("Planning enregistré."); toast("Planning musical enregistré", { tone: "success" }); }
  });
  const move = (from: number, to: number) => { if (from === to || to < 0 || to >= m.moments.length) return; const a = [...m.moments]; const [x] = a.splice(from, 1); a.splice(to, 0, x); set("moments", a); };

  return (
    <div className="space-y-5">
      {readOnly && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Le planning a été validé par votre DJ : il est en lecture seule. Contactez-le pour une modification.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="block"><span className="label">Playlist Spotify partagée</span>
            <input value={m.playlistUrl} onChange={(e) => set("playlistUrl", e.target.value)} disabled={readOnly} placeholder="https://open.spotify.com/playlist/…" className="input" />
          </label>
          <p className="text-xs text-slate-500">Dans Spotify : playlist › ⋯ › <b>Inviter des collaborateurs</b> pour la remplir à plusieurs, puis <b>Partager › Copier le lien</b> et collez-le ici.</p>
          {m.playlistUrl && !embed && <p className="text-xs text-rose-700">Ce lien n&apos;est pas un lien de playlist, d&apos;album ou de titre Spotify.</p>}
        </div>
        {embed ? <iframe src={embed} title="Playlist Spotify" className="h-[232px] w-full rounded-xl" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /> : (
          <div className="flex h-[152px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400 ring-1 ring-slate-200/60">Le lecteur de la playlist s&apos;affichera ici.</div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">Moments clés</h3>
          {!readOnly && <button type="button" onClick={() => set("moments", [...m.moments, { id: uid(), label: "", time: "", song: "", note: "" }])} className="text-sm text-link-600 hover:underline">+ Ajouter un moment</button>}
        </div>
        {m.moments.length === 0 ? <p className="text-sm text-slate-400">Aucun moment défini.</p> : (
          <ol className="space-y-2">
            {m.moments.map((x, i) => (
              <li key={x.id} draggable={!readOnly} onDragStart={() => { drag.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag.current !== null) move(drag.current, i); drag.current = null; }}
                className="grid gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/60 sm:grid-cols-[auto_90px_1fr_1.2fr_auto] sm:items-center">
                <span className="hidden cursor-grab select-none text-slate-400 sm:block" title="Glisser pour réordonner" aria-hidden>⋮⋮</span>
                <input type="time" value={x.time} disabled={readOnly} onChange={(e) => setMoment(i, { time: e.target.value })} className="input py-1.5" aria-label="Heure" />
                <input value={x.label} disabled={readOnly} onChange={(e) => setMoment(i, { label: e.target.value })} placeholder="Moment (ouverture de bal…)" className="input py-1.5 font-medium" aria-label="Moment" />
                <input value={x.song} disabled={readOnly} onChange={(e) => setMoment(i, { song: e.target.value })} placeholder="Morceau (titre — artiste)" className="input py-1.5" aria-label="Morceau" />
                {!readOnly ? (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Monter" className="h-8 w-8 rounded-lg ring-1 ring-slate-200 hover:bg-white disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === m.moments.length - 1} aria-label="Descendre" className="h-8 w-8 rounded-lg ring-1 ring-slate-200 hover:bg-white disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => set("moments", m.moments.filter((_, j) => j !== i))} aria-label="Supprimer" className="h-8 w-8 rounded-lg text-slate-400 ring-1 ring-slate-200 hover:bg-white hover:text-rose-600">×</button>
                  </div>
                ) : <span />}
                <input value={x.note} disabled={readOnly} onChange={(e) => setMoment(i, { note: e.target.value })} placeholder="Précision (version, à partir de 0:45, fondu…)" className="input py-1 text-xs sm:col-span-5 sm:col-start-3 sm:w-auto" aria-label="Précision" />
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="font-medium">À passer absolument <span className="text-sm font-normal text-slate-500">({m.mustPlay.length})</span></h3>
          {!readOnly && <TrackInput spotify={spotify} placeholder={spotify ? "Rechercher un titre…" : "Titre — Artiste"} onAdd={(t) => set("mustPlay", [...m.mustPlay, t])} />}
          <TrackList tone="ok" items={m.mustPlay} onRemove={(id) => !readOnly && set("mustPlay", m.mustPlay.filter((t) => t.id !== id))} />
        </div>
        <div className="space-y-2">
          <h3 className="font-medium">À ne pas passer <span className="text-sm font-normal text-slate-500">({m.doNotPlay.length})</span></h3>
          {!readOnly && <TrackInput spotify={spotify} placeholder={spotify ? "Rechercher un titre…" : "Titre — Artiste"} onAdd={(t) => set("doNotPlay", [...m.doNotPlay, t])} />}
          <TrackList tone="no" items={m.doNotPlay} onRemove={(id) => !readOnly && set("doNotPlay", m.doNotPlay.filter((t) => t.id !== id))} />
        </div>
      </div>

      <label className="block"><span className="label">Ambiance, styles, consignes</span>
        <textarea value={m.notes} disabled={readOnly} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Années 80 et disco en début de soirée, pas de rap, la grand-mère adore Dalida…" className="input" />
      </label>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending || !dirty} className="btn-primary">{pending ? "Enregistrement…" : "Enregistrer le planning"}</button>
          {role === "staff" && (
            <form action={setMusicClientEdit.bind(null, dossierId, !clientCanEdit)}>
              <button className="btn-secondary">{clientCanEdit ? "🔒 Valider et verrouiller pour le client" : "🔓 Rouvrir au client"}</button>
            </form>
          )}
          {msg && <span role="status" className="text-sm text-emerald-700">✓ {msg}</span>}
          {err && <span role="alert" className="text-sm font-medium text-rose-700">⛔ {err}</span>}
          {!msg && !err && updatedBy && updatedAt && <span className="text-xs text-slate-500">Dernière modification : {updatedBy}, {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(updatedAt))}</span>}
        </div>
      )}
      {role === "staff" && readOnly === false && !clientCanEdit && <p className="text-xs text-slate-500">Verrouillé : le client voit le planning sans pouvoir le modifier.</p>}
    </div>
  );
}
