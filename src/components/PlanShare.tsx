"use client";
import { useState, useTransition } from "react";
import { answerOption, sendPlanLink } from "@/app/music-actions";
import { toast } from "@/lib/toast";

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const when = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Lien de l'espace organisation (copie, envoi) et options demandées par le client. */
export function PlanShare({ dossierId, url, sentAt, clientSavedAt, requests }: {
  dossierId: string; url: string; sentAt: string | null; clientSavedAt: string | null;
  requests: { id: string; label: string; quantity: number; unitPrice: number; note: string | null; status: string; quoteId: string | null }[];
}) {
  const [pending, run] = useTransition();
  const [copied, setCopied] = useState(false);
  const open = requests.filter((r) => r.status === "DEMANDE");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50/70 p-3 ring-1 ring-brand-100">
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-medium">Espace organisation du client</div>
          <div className="text-xs text-slate-600">{sentAt ? `Envoyé le ${when(sentAt)}` : "Pas encore envoyé"}{clientSavedAt ? ` · rempli par le client le ${when(clientSavedAt)}` : ""}</div>
        </div>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-secondary py-1.5 text-xs">{copied ? "✓ Copié" : "Copier le lien"}</button>
        <a href={url} target="_blank" className="btn-secondary py-1.5 text-xs">Voir comme le client ↗</a>
        <button type="button" disabled={pending} onClick={() => run(async () => { const r = await sendPlanLink(dossierId); if (r.error) toast(r.error, { tone: "error" }); else toast(sentAt ? "Lien renvoyé" : "Lien envoyé au client", { body: r.ok, tone: "success" }); })} className="btn-primary py-1.5 text-xs">{sentAt ? "Renvoyer par e-mail" : "Envoyer par e-mail"}</button>
      </div>
      {requests.length > 0 && (
        <div id="options" className="scroll-mt-6 rounded-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm font-medium">Options demandées {open.length > 0 && <span className="badge bg-amber-100 text-amber-800">{open.length} à valider</span>}</div>
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1"><b>{r.quantity > 1 ? `${r.quantity} × ` : ""}{r.label}</b>{r.unitPrice > 0 ? <span className="text-slate-500"> · {eur(r.unitPrice * r.quantity)} HT</span> : <span className="text-slate-500"> · prix à définir</span>}{r.note && <span className="block text-xs text-slate-500">« {r.note} »</span>}</span>
                {r.status === "DEMANDE" ? (
                  <>
                    <button disabled={pending} onClick={() => run(async () => { await answerOption(r.id, true); toast("Option ajoutée au devis complémentaire", { tone: "success" }); })} className="btn-primary py-1 text-xs">Accepter</button>
                    <button disabled={pending} onClick={() => run(() => answerOption(r.id, false))} className="btn-secondary py-1 text-xs">Refuser</button>
                  </>
                ) : r.status === "ACCEPTEE" ? <a href={r.quoteId ? `/devis/${r.quoteId}/modifier` : "#"} className="badge bg-emerald-100 text-emerald-700">✓ au devis</a> : <span className="badge bg-slate-100 text-slate-600">refusée</span>}
              </li>
            ))}
          </ul>
          {requests.some((r) => r.status === "ACCEPTEE") && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Les options acceptées sont regroupées dans un devis « Options supplémentaires » en brouillon : vérifiez les prix puis envoyez-le.</p>}
        </div>
      )}
    </div>
  );
}
