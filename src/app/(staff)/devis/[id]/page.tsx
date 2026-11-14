import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Back, Badge, Card, PageHeader } from "@/components/ui";
import { date, dateTime, eur, quoteStatus } from "@/lib/format";
import { parseLines, totals, unitLabel, depositOf } from "@/lib/quotes";
import { SIGNATURE_STATUSES } from "@/lib/signature";
import { getCompany } from "@/lib/company";
import { baseUrl } from "@/lib/merge";
import { isMailConfigured } from "@/lib/mail";
import { CopyLink } from "@/components/CopyLink";
import { ConfirmButton } from "@/components/ConfirmButton";
import { invoiceFromQuote } from "../../factures/actions";
import { deleteQuote, duplicateQuote, sendQuote, setQuoteStatus } from "../actions";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await pagePerm(await requireStaff(), "canViewQuotes");
  const { id } = await params;
  const q = await db.quote.findUnique({ where: { id }, include: { client: true, dossier: true, signatures: { select: { id: true, title: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } } } });
  if (!q) notFound();
  const c = await getCompany();
  const lines = parseLines(q.lines);
  const t = totals(lines, q.discount);
  const total = c.vatExempt ? t.totalHT : t.totalTTC;
  const st = quoteStatus(q.status);
  const link = q.token ? `${baseUrl()}/d/${q.token}` : null;
  const open = ["BROUILLON", "ENVOYE", "EXPIRE"].includes(q.status);
  return (
    <div className="max-w-4xl space-y-6">
      <Back href={q.dossier ? `/prestations/${q.dossier.id}` : "/devis"}>{q.dossier ? q.dossier.title : "Devis"}</Back>
      <PageHeader
        title={q.label}
        subtitle={<>{q.number ?? "Sans numéro"} · <Link href={`/clients/${q.clientId}`} className="text-link-600 hover:underline">{q.client.name}</Link>{q.dossier && <> · <Link href={`/prestations/${q.dossier.id}`} className="text-link-600 hover:underline">{q.dossier.reference}</Link></>}</>}
        actions={
          <>
            <a href={`/api/devis/${id}/pdf`} target="_blank" className="btn-secondary">⬇ PDF</a>
            {q.status !== "ACCEPTE" && <Link href={`/devis/${id}/modifier`} className="btn-secondary">Modifier</Link>}
            <form action={duplicateQuote.bind(null, id)}><button className="btn-secondary">Dupliquer</button></form>
            {q.status === "ACCEPTE" && <form action={invoiceFromQuote.bind(null, id)}><button className="btn-secondary">🧾 Facturer</button></form>}
            {q.status === "BROUILLON" && <ConfirmButton action={deleteQuote.bind(null, id)} label="Supprimer" title="Supprimer ce brouillon ?" message="Le devis sera définitivement supprimé." className="btn-secondary text-rose-600" />}
          </>
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <Badge className={st.color}>{st.label}</Badge>
          <span className="text-slate-500">Émis le {date(q.issuedAt)} · valable jusqu&apos;au {date(q.validUntil)}</span>
          {q.sentAt && <span className="text-slate-500">· envoyé le {dateTime(q.sentAt)}</span>}
          {q.viewedAt && <span className="text-emerald-700">· 👁 consulté par le client le {dateTime(q.viewedAt)}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th>{!c.vatExempt && <th>TVA</th>}<th className="text-right">Total HT</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><div className="font-medium">{l.label}</div>{l.description && <div className="text-xs whitespace-pre-wrap text-slate-500">{l.description}</div>}</td>
                  <td className="whitespace-nowrap">{l.quantity} {l.unit && l.unit !== "piece" ? unitLabel(l.unit).toLowerCase() : ""}</td>
                  <td>{eur(l.unitPrice)}</td>
                  {!c.vatExempt && <td>{l.vatRate} %</td>}
                  <td className="text-right">{eur(l.quantity * l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 ml-auto max-w-64 space-y-1 text-sm">
          {q.discount > 0 && <><div className="flex justify-between"><dt className="text-slate-500">Sous-total HT</dt><dd>{eur(t.grossHT)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Remise</dt><dd>− {eur(q.discount)}</dd></div></>}
          {c.vatExempt ? <div className="flex justify-between font-semibold"><dt>Total net</dt><dd>{eur(t.totalHT)}</dd></div> : (
            <>
              <div className="flex justify-between"><dt className="text-slate-500">Total HT</dt><dd>{eur(t.totalHT)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">TVA</dt><dd>{eur(t.vat)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total TTC</dt><dd>{eur(t.totalTTC)}</dd></div>
            </>
          )}
          {q.depositPercent > 0 && <div className="flex justify-between text-brand-700"><dt>Acompte {q.depositPercent} %</dt><dd>{eur(depositOf(total, q.depositPercent))}</dd></div>}
        </dl>
        {q.notes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-600">{q.notes}</p>}
      </Card>

      {open && (
        <Card title="Envoyer au client">
          <p className="mb-3 text-sm text-slate-600">Le client reçoit un lien pour consulter le devis, le télécharger en PDF et l&apos;accepter en ligne. Vous êtes prévenu quand il l&apos;ouvre et quand il répond.</p>
          {link && <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3"><a href={link} target="_blank" className="min-w-0 flex-1 truncate font-mono text-xs text-link-600 hover:underline">{link}</a><CopyLink url={link} /></div>}
          <form action={sendQuote.bind(null, id)} className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email" defaultChecked={!!q.client.email} disabled={!q.client.email} className="h-4 w-4 accent-brand-600" /> Envoyer le lien par e-mail à {q.client.email ?? "(pas d'e-mail sur la fiche client)"}</label>
            <button className="btn-primary">{q.status === "BROUILLON" ? "Envoyer" : "Renvoyer"}</button>
          </form>
          {!isMailConfigured() && <p className="mt-2 text-xs text-amber-700">E-mails en mode simulation : copiez le lien ci-dessus pour l&apos;envoyer vous-même (voir Paramètres › Intégrations).</p>}
        </Card>
      )}

      <Card title="Signature électronique" actions={q.status !== "ACCEPTE" ? <Link href={`/signatures/nouveau?quoteId=${id}`} className="btn-secondary">✍ Faire signer ce devis</Link> : q.dossierId ? <Link href={`/contrats/generer?dossierId=${q.dossierId}`} className="btn-primary">Générer le contrat</Link> : undefined}>
        {q.signatures.length === 0 ? (
          <p className="text-sm text-slate-500">Une fois le devis accepté, générez le contrat depuis vos modèles : le devis y est joint en annexe et le tout part en signature électronique.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {q.signatures.map((sg) => (
              <li key={sg.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/signatures/${sg.id}`} className="text-link-600 hover:underline">{sg.title}</Link>
                <span className="text-xs text-slate-500">{date(sg.createdAt)}</span>
                <Badge className={SIGNATURE_STATUSES[sg.status].color}>{SIGNATURE_STATUSES[sg.status].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Statut">
        <div className="flex flex-wrap gap-2">
          {q.status !== "ACCEPTE" && <form action={setQuoteStatus.bind(null, id, "ACCEPTE")}><button className="btn-secondary">✅ Marquer accepté</button></form>}
          {q.status !== "REFUSE" && <form action={setQuoteStatus.bind(null, id, "REFUSE")}><button className="btn-secondary">Marquer refusé</button></form>}
        </div>
        <p className="mt-3 text-xs text-slate-500">L&apos;acceptation déclenche les automatisations « Devis accepté » (par défaut : prestation en option et tâche « envoyer le contrat »).</p>
      </Card>
    </div>
  );
}
