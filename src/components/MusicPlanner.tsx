"use client";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { saveMusicPlan, setPlanAccess } from "@/app/music-actions";
import { spotifyEmbed, uid, type Contact, type Moment, type MusicData, type PlanInfo, type Track } from "@/lib/music";

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

export type PlanAccess = { clientCanEdit: boolean; forceOpen: boolean; deadlineDays: number; deadline: string | null; editable: boolean; reason: "locked" | "deadline" | null };
const fmtDay = (iso: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

const INFO_FIELDS: [keyof PlanInfo, string, string][] = [
  ["arrival", "Accès à la salle pour l'installation", "À partir de 15 h, clés auprès du gardien"],
  ["access", "Accès au lieu (étage, escaliers, monte-charge)", "Rez-de-chaussée, porte de service à l'arrière"],
  ["parking", "Stationnement du véhicule", "Parking du domaine, place réservée près de la cuisine"],
  ["power", "Électricité disponible", "Prises 16 A près de la piste"],
  ["guests", "Nombre d'invités (adultes / enfants)", "110 adultes, 15 enfants"],
  ["kids", "Animations enfants, âges", "Des enfants de 4 à 12 ans"],
  ["micro", "Discours, micro, vidéo projection", "3 discours au dessert, un diaporama de 5 min"],
  ["meal", "Repas prévu pour l'équipe", "Oui, menu prestataire servi à 21 h"],
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

/** Organisation de la prestation : déroulé, musique, infos pratiques (et options côté client). */
export function MusicPlanner({ dossierId, initial, role, access, spotify, updatedBy, updatedAt, save, extraTab }: {
  dossierId: string; initial: MusicData; role: "staff" | "client"; access: PlanAccess; spotify: boolean;
  updatedBy?: string | null; updatedAt?: string | null;
  save?: (data: MusicData) => Promise<{ error?: string; ok?: boolean }>;
  extraTab?: { label: string; content: ReactNode };
}) {
  const [m, setM] = useState<MusicData>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState(0);
  const [pending, run] = useTransition();
  const readOnly = role === "client" && !access.editable;
  const dirty = JSON.stringify(m) !== saved;
  const embed = spotifyEmbed(m.playlistUrl);
  const drag = useRef<number | null>(null);

  const set = <K extends keyof MusicData>(k: K, v: MusicData[K]) => { setM((x) => ({ ...x, [k]: v })); setMsg(""); setErr(""); };
  const setInfo = <K extends keyof PlanInfo>(k: K, v: PlanInfo[K]) => set("info", { ...m.info, [k]: v });
  const setMoment = (i: number, p: Partial<Moment>) => set("moments", m.moments.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setContact = (i: number, p: Partial<Contact>) => setInfo("contacts", m.info.contacts.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const doSave = () => run(async () => {
    const r = save ? await save(m) : await saveMusicPlan(dossierId, m);
    if (r.error) setErr(r.error); else { setSaved(JSON.stringify(m)); setMsg("Enregistré."); toast(role === "client" ? "Merci, c'est enregistré !" : "Organisation enregistrée", { tone: "success" }); }
  });
  const move = (from: number, to: number) => { if (from === to || to < 0 || to >= m.moments.length) return; const a = [...m.moments]; const [x] = a.splice(from, 1); a.splice(to, 0, x); set("moments", a); };
  const tabs = ["🗓 Déroulé", "🎵 Musique", "📍 Infos pratiques", ...(extraTab ? [extraTab.label] : [])];

  // avertir avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return (
    <div className="space-y-5">
      {role === "client" && (access.editable
        ? access.deadline && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">Vous pouvez modifier ces informations jusqu&apos;au <b>{fmtDay(access.deadline)}</b>. Pensez à enregistrer !</p>
        : <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{access.reason === "deadline" ? "La date limite de modification est passée" : "L'organisation a été validée"} : les informations sont en lecture seule. Contactez-nous pour tout changement.</p>)}
      {role === "staff" && <StaffAccess dossierId={dossierId} access={access} />}

      <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {tabs.map((l, i) => (
          <button key={l} role="tab" type="button" aria-selected={tab === i} onClick={() => setTab(i)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ring-1 ${tab === i ? "bg-ink text-paper ring-ink" : "ring-slate-200 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>

      {tab === 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-slate-500">Les grands moments de la journée, avec l&apos;heure et le morceau souhaité.</p>
            {!readOnly && <button type="button" onClick={() => set("moments", [...m.moments, { id: uid(), label: "", time: "", song: "", note: "" }])} className="shrink-0 text-sm text-link-600 hover:underline">+ Ajouter un moment</button>}
          </div>
          {m.moments.length === 0 ? <p className="text-sm text-slate-400">Aucun moment défini.</p> : (
            <ol className="space-y-2">
              {m.moments.map((x, i) => (
                <li key={x.id} draggable={!readOnly} onDragStart={() => { drag.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag.current !== null) move(drag.current, i); drag.current = null; }}
                  className="grid gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/60 sm:grid-cols-[auto_100px_1fr_1.2fr_auto] sm:items-center">
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
                  <input value={x.note} disabled={readOnly} onChange={(e) => setMoment(i, { note: e.target.value })} placeholder="Précision (version, à partir de 0:45, fondu, qui fait le discours…)" className="input py-1 text-xs sm:col-span-3 sm:col-start-3" aria-label="Précision" />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Field label="Playlist Spotify partagée"><input value={m.playlistUrl} onChange={(e) => set("playlistUrl", e.target.value)} disabled={readOnly} placeholder="https://open.spotify.com/playlist/…" className="input" /></Field>
              <p className="text-xs text-slate-500">Dans Spotify : playlist › ⋯ › <b>Inviter des collaborateurs</b> pour la remplir à plusieurs, puis <b>Partager › Copier le lien</b> et collez-le ici. La playlist reste modifiable dans Spotify à tout moment.</p>
              {m.playlistUrl && !embed && <p className="text-xs text-rose-700">Ce lien n&apos;est pas un lien de playlist, d&apos;album ou de titre Spotify.</p>}
            </div>
            {embed ? <iframe src={embed} title="Playlist Spotify" className="h-[232px] w-full rounded-xl" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /> : (
              <div className="flex h-[152px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400 ring-1 ring-slate-200/60">Le lecteur de la playlist s&apos;affichera ici.</div>
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
          <Field label="Ambiance, styles, consignes"><textarea value={m.notes} disabled={readOnly} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Années 80 et disco en début de soirée, pas de rap, la grand-mère adore Dalida…" className="input" /></Field>
        </div>
      )}

      {tab === 2 && (
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">Contacts le jour J</h3>
              {!readOnly && <button type="button" onClick={() => setInfo("contacts", [...m.info.contacts, { id: uid(), name: "", role: "", phone: "" }])} className="text-sm text-link-600 hover:underline">+ Ajouter un contact</button>}
            </div>
            {m.info.contacts.length === 0 ? <p className="text-sm text-slate-400">Témoin, wedding planner, traiteur, responsable de salle…</p> : (
              <ul className="space-y-2">
                {m.info.contacts.map((c, i) => (
                  <li key={c.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_160px_auto]">
                    <input value={c.name} disabled={readOnly} onChange={(e) => setContact(i, { name: e.target.value })} placeholder="Nom" className="input py-1.5" aria-label="Nom" />
                    <input value={c.role} disabled={readOnly} onChange={(e) => setContact(i, { role: e.target.value })} placeholder="Rôle (témoin, traiteur…)" className="input py-1.5" aria-label="Rôle" />
                    <input value={c.phone} disabled={readOnly} onChange={(e) => setContact(i, { phone: e.target.value })} placeholder="Téléphone" inputMode="tel" className="input py-1.5" aria-label="Téléphone" />
                    {!readOnly ? <button type="button" onClick={() => setInfo("contacts", m.info.contacts.filter((_, j) => j !== i))} aria-label="Supprimer le contact" className="h-9 w-9 rounded-lg text-slate-400 ring-1 ring-slate-200 hover:text-rose-600">×</button> : <span />}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {INFO_FIELDS.map(([k, l, ph]) => (
              <Field key={k} label={l}><input value={m.info[k] as string} disabled={readOnly} onChange={(e) => setInfo(k, e.target.value)} placeholder={ph} className="input" /></Field>
            ))}
          </div>
          <Field label="Autres informations utiles"><textarea value={m.info.other} disabled={readOnly} onChange={(e) => setInfo("other", e.target.value)} rows={3} placeholder="Surprise prévue, horaires du traiteur, contraintes de bruit, heure de fin imposée…" className="input" /></Field>
        </div>
      )}

      {extraTab && tab === 3 && extraTab.content}

      {!readOnly && tab < 3 && (
        <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">
          <button type="button" onClick={doSave} disabled={pending || !dirty} className="btn-primary">{pending ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré"}</button>
          {dirty && <span className="text-xs text-amber-700">Modifications non enregistrées</span>}
          {msg && !dirty && <span role="status" className="text-sm text-emerald-700">✓ {msg}</span>}
          {err && <span role="alert" className="text-sm font-medium text-rose-700">⛔ {err}</span>}
          {!msg && !err && !dirty && updatedBy && updatedAt && <span className="text-xs text-slate-500">Dernière modification : {updatedBy}, {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(updatedAt))}</span>}
        </div>
      )}
    </div>
  );
}

/** Réglages équipe : date limite, verrouillage, réouverture. */
function StaffAccess({ dossierId, access }: { dossierId: string; access: PlanAccess }) {
  const [pending, run] = useTransition();
  const go = (p: Parameters<typeof setPlanAccess>[1]) => run(() => setPlanAccess(dossierId, p));
  const label = !access.clientCanEdit ? "🔒 Verrouillé : le client consulte sans modifier"
    : access.reason === "deadline" ? `⏰ Date limite passée (${access.deadline ? fmtDay(access.deadline) : ""}) : le client ne peut plus modifier`
    : access.deadline ? `✏️ Le client peut modifier jusqu'au ${fmtDay(access.deadline)}${access.forceOpen ? " (rouvert)" : ""}` : "✏️ Le client peut modifier (date de la prestation à définir)";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200/60">
      <span className="mr-auto">{label}</span>
      <label className="flex items-center gap-1 text-xs text-slate-500">Limite
        <select disabled={pending} value={access.deadlineDays} onChange={(e) => go({ deadlineDays: Number(e.target.value) })} className="input w-auto py-1 text-xs">
          {[0, 2, 3, 5, 7, 10, 14, 21, 30].map((n) => <option key={n} value={n}>{n === 0 ? "jour J" : `J-${n}`}</option>)}
        </select>
      </label>
      {access.reason === "deadline" && !access.forceOpen && <button disabled={pending} onClick={() => go({ forceOpen: true })} className="btn-secondary py-1 text-xs">Rouvrir au client</button>}
      {access.forceOpen && <button disabled={pending} onClick={() => go({ forceOpen: false })} className="btn-secondary py-1 text-xs">Refermer</button>}
      <button disabled={pending} onClick={() => go({ clientCanEdit: !access.clientCanEdit })} className="btn-secondary py-1 text-xs">{access.clientCanEdit ? "🔒 Valider et verrouiller" : "🔓 Déverrouiller"}</button>
    </div>
  );
}
