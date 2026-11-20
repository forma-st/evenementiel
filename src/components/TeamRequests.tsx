"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { assignHelper, assignTeamRequest, cancelTeamRequest, convertTeamRequest, createTeamRequest, inviteHelpers, replyTeamRequest, saveHelper, toggleHelper } from "@/app/(staff)/equipe/demandes/actions";
import { EVENT_KINDS, SERVICES } from "@/lib/presta";
import { toast } from "@/lib/toast";

export type ReqView = {
  id: string; kind: string; title: string; eventType: string; date: string | null; startTime: string | null; endTime: string | null;
  venue: string | null; city: string | null; clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  guests: number | null; services: string; budget: number | null; notes: string | null; status: string;
  author: string; authorId: string; assignee: string | null; dossierId: string | null; dossierRef: string | null; createdAt: string;
  replies: { userId: string; name: string; answer: string; comment: string | null }[];
  invites: { helperId: string; name: string; phone: string | null; email: string | null; answer: string | null; comment: string | null; token: string; viewed: boolean }[];
  helper: string | null;
};
export type HelperView = { id: string; name: string; phone: string | null; email: string | null; skills: string; notes: string | null; active: boolean };
const KIND: Record<string, [string, string]> = { PRESTA: ["🎉 Prestation à pourvoir", "bg-brand-50 text-brand-700"], RDV: ["📅 Rendez-vous", "bg-sky-100 text-sky-800"], RENFORT: ["🛠 Renfort / installation", "bg-amber-100 text-amber-800"] };
const ANS: Record<string, [string, string]> = { DISPO: ["✅ Dispo", "bg-emerald-100 text-emerald-800"], PEUT_ETRE: ["🤔 Peut-être", "bg-amber-100 text-amber-800"], PAS_DISPO: ["❌ Pas dispo", "bg-slate-100 text-slate-600"] };
const ST: Record<string, [string, string]> = { OUVERTE: ["Ouverte", "bg-brand-50 text-brand-700"], ATTRIBUEE: ["Attribuée", "bg-emerald-100 text-emerald-700"], CONVERTIE: ["Prestation créée", "bg-emerald-100 text-emerald-700"], ANNULEE: ["Annulée", "bg-slate-100 text-slate-500"] };
const fday = (d: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00`));
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Formulaire de nouvelle demande (pré-saisie rapide, tout est facultatif sauf le titre). */
export function TeamRequestForm({ prefill }: { prefill?: { kind?: string; title?: string; dossierId?: string; date?: string; startTime?: string; venue?: string; city?: string } }) {
  const [state, run, pending] = useActionState(createTeamRequest, null);
  const [open, setOpen] = useState(!!prefill);
  const [kind, setKind] = useState(prefill?.kind ?? "PRESTA");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) { form.current?.reset(); setOpen(false); toast("Demande envoyée à l'équipe", { tone: "success" }); } }, [state]);
  if (!open) return <button onClick={() => setOpen(true)} className="btn-primary">+ Nouvelle demande à l&apos;équipe</button>;
  return (
    <form ref={form} action={run} className="card space-y-4 p-5 ring-2 ring-brand-200">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Nouvelle demande</h2><button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-ink">Fermer</button></div>
      <input type="hidden" name="kind" value={kind} />
      {prefill?.dossierId && <input type="hidden" name="dossierId" value={prefill.dossierId} />}
      <div className="flex flex-wrap gap-2">{Object.entries(KIND).map(([k, [l]]) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${kind === k ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>{l}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-4"><span className="label">Titre *</span><input name="title" required defaultValue={prefill?.title} placeholder={kind === "RENFORT" ? "Install sono au mariage de samedi" : "Mariage 120 pers. à Cergy, cherche DJ"} className="input" /></label>
        <label className="block"><span className="label">Date</span><input name="date" type="date" defaultValue={prefill?.date} className="input" /></label>
        <label className="block"><span className="label">De</span><input name="startTime" type="time" defaultValue={prefill?.startTime} className="input" /></label>
        <label className="block"><span className="label">À</span><input name="endTime" type="time" className="input" /></label>
        <label className="block"><span className="label">Type</span><select name="eventType" defaultValue="MARIAGE" className="input">{EVENT_KINDS.filter((k) => k.id !== "PRET").map((k) => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}</select></label>
        <label className="block sm:col-span-2"><span className="label">Lieu</span><input name="venue" defaultValue={prefill?.venue} placeholder="Salle, domaine…" className="input" /></label>
        <label className="block"><span className="label">Ville</span><input name="city" defaultValue={prefill?.city} className="input" /></label>
        <label className="block"><span className="label">Invités</span><input name="guests" type="number" min={0} className="input" /></label>
      </div>
      {kind !== "RENFORT" && (
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2"><span className="label">Client</span><input name="clientName" placeholder="Nom du client" className="input" /></label>
          <label className="block"><span className="label">Téléphone</span><input name="clientPhone" inputMode="tel" className="input" /></label>
          <label className="block"><span className="label">E-mail</span><input name="clientEmail" type="email" className="input" /></label>
          <label className="block"><span className="label">Budget (€)</span><input name="budget" inputMode="decimal" className="input" /></label>
          <div className="sm:col-span-3"><span className="label">Prestations</span><div className="flex flex-wrap gap-1.5">{SERVICES.map((x) => <label key={x.id} className="flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ring-slate-200 has-[:checked]:bg-brand-600 has-[:checked]:text-white"><input type="checkbox" name="services" value={x.id} className="sr-only" />{x.icon} {x.label}</label>)}</div></div>
        </div>
      )}
      <label className="block"><span className="label">Infos utiles</span><textarea name="notes" rows={3} placeholder="Ce qu'il faut savoir : matériel à prévoir, contact, horaires d'install, rémunération…" className="input" /></label>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending}>{pending ? "Envoi…" : "Envoyer à l'équipe"}</button>{state?.error && <span role="alert" className="text-sm font-medium text-rose-700">⛔ {state.error}</span>}</div>
    </form>
  );
}

/** Carte d'une demande : infos, réponses de chacun, actions. */
export function TeamRequestCard({ r, me, manager, base, helpers }: { r: ReqView; me: string; manager: boolean; base: string; helpers: HelperView[] }) {
  const [pending, run] = useTransition();
  const [comment, setComment] = useState(r.replies.find((x) => x.userId === me)?.comment ?? "");
  const mine = r.replies.find((x) => x.userId === me);
  const canManage = manager || r.authorId === me;
  const open = r.status === "OUVERTE";
  const dispo = r.replies.filter((x) => x.answer !== "PAS_DISPO");
  const extDispo = r.invites.filter((x) => x.answer && x.answer !== "PAS_DISPO");
  const text = [`🙋 ${r.title}`, r.date ? `📅 ${fday(r.date)}${r.startTime ? ` ${r.startTime}` : ""}${r.endTime ? `–${r.endTime}` : ""}` : "", [r.venue, r.city].filter(Boolean).length ? `📍 ${[r.venue, r.city].filter(Boolean).join(", ")}` : "", r.guests ? `👥 ${r.guests} invités` : "", r.notes ?? "", `Qui est dispo ? Réponds ici : ${base}/equipe/demandes#d-${r.id}`].filter(Boolean).join("\n");
  return (
    <article id={`d-${r.id}`} className={`card scroll-mt-6 space-y-3 p-5 ${open ? "" : "opacity-80"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${KIND[r.kind]?.[1]}`}>{KIND[r.kind]?.[0]}</span>
        <span className={`badge ${ST[r.status]?.[1]}`}>{ST[r.status]?.[0]}{r.assignee ? ` : ${r.assignee}` : r.helper ? ` : ${r.helper} (renfort)` : ""}</span>
        <span className="ml-auto text-xs text-slate-500">par {r.author}, {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(r.createdAt))}</span>
      </div>
      <h3 className="text-lg font-semibold">{r.title}</h3>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
        {r.date && <span className="first-letter:uppercase">📅 {fday(r.date)}{r.startTime && ` · ${r.startTime}`}{r.endTime && `–${r.endTime}`}</span>}
        {(r.venue || r.city) && <span>📍 {[r.venue, r.city].filter(Boolean).join(", ")}</span>}
        {r.guests && <span>👥 {r.guests} invités</span>}
        {r.budget && <span>💶 {eur(r.budget)}</span>}
        {r.services && <span>{r.services.split(",").map((x) => SERVICES.find((s) => s.id === x)?.icon).join(" ")}</span>}
        {r.clientName && <span>👤 {r.clientName}{r.clientPhone ? ` · ${r.clientPhone}` : ""}</span>}
        {r.dossierRef && r.dossierId && <Link href={`/prestations/${r.dossierId}`} className="text-link-600 hover:underline">↗ {r.dossierRef}</Link>}
      </div>
      {r.notes && <p className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">{r.notes}</p>}
      <div className="flex flex-wrap gap-1.5">
        {r.replies.length === 0 ? <span className="text-sm text-slate-400">Pas encore de réponse.</span> : r.replies.map((x) => <span key={x.userId} title={x.comment ?? ""} className={`badge ${ANS[x.answer][1]}`}>{ANS[x.answer][0].split(" ")[0]} {x.name}{x.comment ? ` · ${x.comment}` : ""}</span>)}
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-sm text-slate-500">Moi :</span>
          {Object.entries(ANS).map(([k, [l, c]]) => <button key={k} disabled={pending} onClick={() => run(() => replyTeamRequest(r.id, k, comment))} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${mine?.answer === k ? `${c} ring-transparent font-semibold` : "ring-slate-200 hover:bg-slate-50"}`}>{l}</button>)}
          <input value={comment} onChange={(e) => setComment(e.target.value)} onBlur={() => mine && comment !== (mine.comment ?? "") && run(() => replyTeamRequest(r.id, mine.answer, comment))} placeholder="Un mot (ex. dispo à partir de 20 h)" className="input min-w-48 flex-1 py-1.5 text-sm" />
        </div>
      )}
      <Externals r={r} helpers={helpers} base={base} canManage={canManage} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); toast("Message copié", { body: "Collez-le dans le groupe Messenger.", tone: "success" }); }} className="btn-secondary py-1.5 text-xs">📋 Copier pour Messenger</button>
        {canManage && open && (dispo.length > 0 || extDispo.length > 0) && (
          <select defaultValue="" disabled={pending} onChange={(e) => { const v = e.target.value; if (!v) return; run(() => (v.startsWith("h:") ? assignHelper(r.id, v.slice(2)) : assignTeamRequest(r.id, v.slice(2)))); }} className="input w-auto py-1.5 text-xs" aria-label="Attribuer">
            <option value="">Attribuer à…</option>
            {dispo.map((x) => <option key={x.userId} value={`u:${x.userId}`}>{x.name} ({ANS[x.answer][0].slice(2)})</option>)}
            {extDispo.map((x) => <option key={x.helperId} value={`h:${x.helperId}`}>{x.name}, renfort ({ANS[x.answer!][0].slice(2)})</option>)}
          </select>
        )}
        {canManage && r.kind !== "RENFORT" && (r.status === "OUVERTE" || r.status === "ATTRIBUEE") && <button disabled={pending} onClick={() => run(() => convertTeamRequest(r.id))} className="btn-primary py-1.5 text-xs">Créer la prestation</button>}
        {canManage && r.status !== "CONVERTIE" && <button disabled={pending} onClick={() => run(() => cancelTeamRequest(r.id))} className="ml-auto text-xs text-slate-500 hover:text-rose-600">{r.status === "ANNULEE" ? "Rouvrir" : "Annuler la demande"}</button>}
      </div>
    </article>
  );
}

const digits = (p: string) => p.replace(/[^\d+]/g, "").replace(/^0/, "+33");

/** Renforts extérieurs d'une demande : invitations, réponses, envoi du lien par SMS / WhatsApp / copie. */
function Externals({ r, helpers, base, canManage }: { r: ReqView; helpers: HelperView[]; base: string; canManage: boolean }) {
  const [pending, run] = useTransition();
  const [pick, setPick] = useState<string[]>([]);
  const open = r.status === "OUVERTE";
  const free = helpers.filter((h) => h.active && !r.invites.some((i) => i.helperId === h.id));
  const sv = r.services.split(",").filter(Boolean);
  const sorted = [...free].sort((a, b) => Number(sv.some((s) => b.skills.includes(s))) - Number(sv.some((s) => a.skills.includes(s))));
  if (!r.invites.length && (!open || !canManage || !helpers.length)) return null;
  const msg = (i: ReqView["invites"][number]) => `Salut ${i.name}, dispo ${r.date ? `le ${fday(r.date)}` : ""} pour « ${r.title} » ? Réponds ici (sans compte) : ${base}/r/${i.token}`;
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/60">
      <div className="text-sm font-medium">🤝 Renforts extérieurs</div>
      {r.invites.length > 0 && (
        <ul className="space-y-1.5">
          {r.invites.map((i) => (
            <li key={i.helperId} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{i.name}</span>
              <span className={`badge ${i.answer ? ANS[i.answer][1] : "bg-slate-100 text-slate-500"}`}>{i.answer ? ANS[i.answer][0] : i.viewed ? "👁 vu, sans réponse" : "envoyé"}</span>
              {i.comment && <span className="text-xs text-slate-500">« {i.comment} »</span>}
              <span className="ml-auto flex gap-1">
                {i.phone && <a href={`sms:${digits(i.phone)}?&body=${encodeURIComponent(msg(i))}`} className="rounded-lg px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-white">💬 SMS</a>}
                {i.phone && <a href={`https://wa.me/${digits(i.phone).replace("+", "")}?text=${encodeURIComponent(msg(i))}`} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-white">🟢 WhatsApp</a>}
                <button type="button" onClick={async () => { await navigator.clipboard.writeText(msg(i)); toast("Message copié", { body: `Pour ${i.name}`, tone: "success" }); }} className="rounded-lg px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-white">📋 Lien</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && canManage && sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2">
          <span className="text-xs text-slate-500">Inviter :</span>
          {sorted.map((h) => <button key={h.id} type="button" aria-pressed={pick.includes(h.id)} onClick={() => setPick((p) => (p.includes(h.id) ? p.filter((x) => x !== h.id) : [...p, h.id]))} className={`rounded-full px-2.5 py-1 text-xs ring-1 ${pick.includes(h.id) ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-slate-200"}`}>{h.name}{h.skills && <span className="opacity-70"> {h.skills.split(",").map((x) => SERVICES.find((s) => s.id === x)?.icon).join("")}</span>}</button>)}
          {pick.length > 0 && <button type="button" disabled={pending} onClick={() => run(async () => { await inviteHelpers(r.id, pick); setPick([]); toast("Invitations prêtes", { body: "E-mail envoyé quand l'adresse est connue ; sinon envoyez le lien par SMS ou WhatsApp.", tone: "success" }); })} className="btn-primary py-1 text-xs">Inviter ({pick.length})</button>}
        </div>
      )}
    </div>
  );
}

/** Carnet des renforts extérieurs (sans compte). */
export function HelperBook({ helpers }: { helpers: HelperView[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-slate-500">Les renforts ponctuels n&apos;ont pas besoin de compte : ils reçoivent un lien personnel par SMS, WhatsApp ou e-mail, répondent en un clic et retrouvent leur fiche mission.</p>
      <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {helpers.map((h) => editing === h.id ? <li key={h.id} className="p-3"><HelperForm h={h} done={() => setEditing(null)} /></li> : (
          <li key={h.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${h.active ? "" : "opacity-50"}`}>
            <span className="font-medium">{h.name}</span>
            <span className="text-slate-500">{[h.phone, h.email].filter(Boolean).join(" · ")}</span>
            <span>{h.skills.split(",").filter(Boolean).map((x) => SERVICES.find((s) => s.id === x)?.icon).join(" ")}</span>
            {h.notes && <span className="text-xs text-slate-500">{h.notes}</span>}
            <span className="ml-auto flex gap-3 text-xs"><button onClick={() => setEditing(h.id)} className="text-link-600 hover:underline">Modifier</button><button onClick={() => toggleHelper(h.id)} className="text-slate-500 hover:underline">{h.active ? "Archiver" : "Réactiver"}</button></span>
          </li>
        ))}
        {helpers.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">Aucun renfort enregistré.</li>}
      </ul>
      {editing === "new" ? <HelperForm done={() => setEditing(null)} /> : <button onClick={() => setEditing("new")} className="btn-secondary py-1.5 text-sm">+ Ajouter un renfort</button>}
    </div>
  );
}

function HelperForm({ h, done }: { h?: HelperView; done: () => void }) {
  const [state, run, pending] = useActionState(saveHelper.bind(null, h?.id ?? null), null);
  useEffect(() => { if (state?.ok) done(); }, [state, done]);
  const sk = (h?.skills ?? "").split(",");
  return (
    <form action={run} className="grid gap-2 sm:grid-cols-4">
      <input name="name" required defaultValue={h?.name} placeholder="Prénom (et nom)" className="input" />
      <input name="phone" inputMode="tel" defaultValue={h?.phone ?? ""} placeholder="Téléphone" className="input" />
      <input name="email" type="email" defaultValue={h?.email ?? ""} placeholder="E-mail (facultatif)" className="input" />
      <input name="notes" defaultValue={h?.notes ?? ""} placeholder="Notes (véhicule, tarif…)" className="input" />
      <div className="flex flex-wrap gap-1.5 sm:col-span-4">{SERVICES.map((x) => <label key={x.id} className="flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ring-slate-200 has-[:checked]:bg-brand-600 has-[:checked]:text-white"><input type="checkbox" name="skills" value={x.id} defaultChecked={sk.includes(x.id)} className="sr-only" />{x.icon} {x.label}</label>)}</div>
      <div className="flex items-center gap-2 sm:col-span-4"><button className="btn-primary py-1.5 text-sm" disabled={pending}>Enregistrer</button><button type="button" onClick={done} className="btn-secondary py-1.5 text-sm">Annuler</button>{state?.error && <span className="text-sm text-rose-700">{state.error}</span>}</div>
    </form>
  );
}
