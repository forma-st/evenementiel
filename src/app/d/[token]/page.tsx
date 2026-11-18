import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { getCompany } from "@/lib/company";
import { date, eur, TZ } from "@/lib/format";
import { parseLines, totals, unitLabel, depositOf } from "@/lib/quotes";
import { eventKind, servicesLabel } from "@/lib/presta";
import { notify } from "@/lib/notify";
import { QuoteAnswer } from "./QuoteAnswer";

export const metadata = { title: "Votre devis", robots: { index: false } };

const fullDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);

/** Page publique d'un devis (lien envoyé au client) : consultation, PDF, acceptation ou refus. */
export default async function PublicQuote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await db.quote.findUnique({ where: { token }, include: { client: true, dossier: { include: { assignee: true } } } });
  if (!q || q.status === "BROUILLON") notFound();
  if (!q.viewedAt) {
    await db.quote.update({ where: { id: q.id }, data: { viewedAt: new Date() } });
    if (q.dossierId) await db.activity.create({ data: { dossierId: q.dossierId, kind: "QUOTE", body: `👁 Devis ${q.number ?? ""} consulté par le client` } });
    await notify([q.dossier?.assigneeId, q.client.ownerId], { type: "SYSTEM", title: `👁 ${q.client.name} a ouvert le devis ${q.number ?? ""}`, link: `/devis/${q.id}` });
  }
  const c = await getCompany();
  const lines = parseLines(q.lines);
  const t = totals(lines, q.discount);
  const total = c.vatExempt ? t.totalHT : t.totalTTC;
  const d = q.dossier;
  const expired = q.validUntil < new Date() && q.status !== "ACCEPTE";

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Logo className="h-11" />
          <a href={`/d/${token}/pdf`} className="btn-secondary">⬇ Télécharger le PDF</a>
        </div>
        <div className="card p-6 sm:p-8">
          <div className="text-xs font-semibold tracking-widest text-brand-600 uppercase">Devis {q.number}</div>
          <h1 className="mt-1 text-2xl font-semibold">{q.label}</h1>
          <p className="mt-1 text-sm text-slate-500">Pour {q.client.name} · émis le {date(q.issuedAt)} · valable jusqu&apos;au {date(q.validUntil)}</p>
          {d && (
            <div className="mt-5 grid gap-3 rounded-xl bg-brand-50 p-4 text-sm sm:grid-cols-3">
              <div><div className="text-xs text-slate-500">Événement</div><div className="font-medium">{eventKind(d.eventType).icon} {eventKind(d.eventType).label}</div></div>
              <div><div className="text-xs text-slate-500">Date</div><div className="font-medium">{d.eventStart ? fullDate(d.eventStart) : "À définir"}</div></div>
              <div><div className="text-xs text-slate-500">Lieu</div><div className="font-medium">{[d.venueName, d.venueCity].filter(Boolean).join(", ") || "À définir"}</div></div>
              {d.services && <div className="sm:col-span-3"><div className="text-xs text-slate-500">Prestations</div><div className="font-medium">{servicesLabel(d.services)}</div></div>}
            </div>
          )}
          <div className="mt-6 divide-y divide-slate-100">
            {lines.map((l, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{l.label}</div>
                  {l.description && <div className="text-sm whitespace-pre-wrap text-slate-500">{l.description}</div>}
                  <div className="text-xs text-slate-400">{l.quantity} {unitLabel(l.unit).toLowerCase()} × {eur(l.unitPrice)} HT</div>
                </div>
                <div className="shrink-0 font-medium tabular-nums">{eur(l.quantity * l.unitPrice)}</div>
              </div>
            ))}
          </div>
          <dl className="mt-4 ml-auto max-w-72 space-y-1 border-t border-slate-200 pt-4 text-sm">
            {q.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Remise</dt><dd>− {eur(q.discount)}</dd></div>}
            {c.vatExempt ? (
              <><div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd>{eur(t.totalHT)}</dd></div><div className="text-xs text-slate-500">TVA non applicable, art. 293 B du CGI</div></>
            ) : (
              <>
                <div className="flex justify-between"><dt className="text-slate-500">Total HT</dt><dd>{eur(t.totalHT)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">TVA</dt><dd>{eur(t.vat)}</dd></div>
                <div className="flex justify-between text-lg font-semibold"><dt>Total TTC</dt><dd>{eur(t.totalTTC)}</dd></div>
              </>
            )}
            {q.depositPercent > 0 && <div className="flex justify-between text-brand-700"><dt>Acompte à la réservation</dt><dd>{eur(depositOf(total, q.depositPercent))}</dd></div>}
          </dl>
          {(q.notes || c.quoteFooter) && <p className="mt-6 text-sm whitespace-pre-wrap text-slate-500">{[q.notes, c.quoteFooter].filter(Boolean).join("\n\n")}</p>}
        </div>

        <div className="card p-6">
          {q.status === "ACCEPTE" ? (
            <div className="text-center"><div className="text-3xl">🎉</div><div className="mt-2 font-semibold">Devis accepté — merci !</div><p className="text-sm text-slate-500">Nous vous envoyons le contrat de réservation très vite.</p></div>
          ) : q.status === "REFUSE" ? (
            <p className="text-center text-sm text-slate-500">Ce devis a été décliné. N&apos;hésitez pas à nous recontacter si votre projet évolue.</p>
          ) : expired ? (
            <p className="text-center text-sm text-slate-600">Ce devis a expiré. Contactez-nous pour vérifier la disponibilité de la date{c.phone ? ` au ${c.phone}` : ""}.</p>
          ) : (
            <QuoteAnswer token={token} defaultName={q.client.name} />
          )}
        </div>
        <p className="text-center text-xs text-slate-400">{[c.name, c.phone, c.email, c.web].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}
