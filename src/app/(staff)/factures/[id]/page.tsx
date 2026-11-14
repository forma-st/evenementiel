import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { Back, Badge, Card, PageHeader } from "@/components/ui";
import { INVOICE_KINDS, INVOICE_STATUSES } from "@/lib/invoices";
import { getCompany } from "@/lib/company";
import { getEinvoiceSettings, PLATFORMS } from "@/lib/einvoice";
import { date, dateTime, eur } from "@/lib/format";
import { parseLines, unitLabel } from "@/lib/quotes";
import { PAYMENT_METHODS } from "@/lib/presta";
import { isMailConfigured } from "@/lib/mail";
import { ConfirmButton } from "@/components/ConfirmButton";
import { creditInvoice, deleteInvoiceDraft, issueInvoice, recordInvoicePayment, sendInvoice, setEinvoiceStatus } from "../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await pagePerm(await requireStaff(), "canViewQuotes");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true, dossier: true, quote: true, payments: { orderBy: { createdAt: "asc" } } } });
  if (!inv) notFound();
  const [c, pa, credits, origin] = await Promise.all([
    getCompany(), getEinvoiceSettings(),
    db.invoice.findMany({ where: { creditOfId: id }, select: { id: true, number: true, status: true } }),
    inv.creditOfId ? db.invoice.findUnique({ where: { id: inv.creditOfId }, select: { id: true, number: true } }) : null,
  ]);
  const lines = parseLines(inv.lines);
  const net = (c.vatExempt ? inv.totalHT : inv.totalTTC) - inv.deducted;
  const paid = inv.payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
  const st = INVOICE_STATUSES[inv.status];
  const draft = inv.status === "BROUILLON";
  const platform = PLATFORMS[pa.platform];
  const b2b = inv.client.type === "COMPANY";
  return (
    <div className="max-w-4xl space-y-6">
      <Back href={inv.dossier ? `/prestations/${inv.dossier.id}` : "/factures"}>{inv.dossier ? inv.dossier.title : "Factures"}</Back>
      <PageHeader
        title={`${INVOICE_KINDS[inv.kind].label} ${inv.number ?? "(brouillon)"}`}
        subtitle={<><Link href={`/clients/${inv.clientId}`} className="text-link-600 hover:underline">{inv.client.name}</Link>{inv.quote && <> · <Link href={`/devis/${inv.quote.id}`} className="text-link-600 hover:underline">devis {inv.quote.number}</Link></>}{origin && <> · avoir sur <Link href={`/factures/${origin.id}`} className="text-link-600 hover:underline">{origin.number}</Link></>}</>}
        actions={<>
          <a href={`/api/factures/${id}/pdf`} target="_blank" className="btn-secondary">⬇ PDF{draft ? " (aperçu)" : " Factur-X"}</a>
          {!draft && <a href={`/api/factures/${id}/xml`} className="btn-secondary">⬇ XML</a>}
          {draft && <Link href={`/factures/${id}/modifier`} className="btn-secondary">Modifier</Link>}
          {draft && <ConfirmButton action={deleteInvoiceDraft.bind(null, id)} label="Supprimer" title="Supprimer ce brouillon ?" message="Aucun numéro n'a encore été attribué : la suppression ne crée pas de trou dans la numérotation." className="btn-secondary text-rose-600" />}
          {draft && <form action={issueInvoice.bind(null, id)}><button className="btn-primary">Émettre la facture</button></form>}
        </>}
      />

      {draft && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Brouillon : vérifiez puis « Émettre ». À l&apos;émission, le numéro définitif est attribué (suite continue, sans trou) et la facture ne peut plus être modifiée — une erreur se corrige par un avoir.</p>}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <Badge className={st.color}>{st.label}</Badge>
          {inv.issueDate && <span className="text-slate-500">Émise le {date(inv.issueDate)}</span>}
          {inv.serviceDate && <span className="text-slate-500">· prestation du {date(inv.serviceDate)}</span>}
          {inv.dueDate && <span className="text-slate-500">· échéance {date(inv.dueDate)}</span>}
          {inv.sentAt && <span className="text-slate-500">· envoyée le {dateTime(inv.sentAt)}</span>}
        </div>
        <div className="font-medium">{inv.label}</div>
        <table className="table mt-2">
          <thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th>{!c.vatExempt && <th>TVA</th>}<th className="text-right">Total HT</th></tr></thead>
          <tbody>{lines.map((l, i) => <tr key={i}><td><div className="font-medium">{l.label}</div>{l.description && <div className="text-xs text-slate-500">{l.description}</div>}</td><td>{l.quantity} {unitLabel(l.unit).toLowerCase()}</td><td>{eur(l.unitPrice)}</td>{!c.vatExempt && <td>{l.vatRate} %</td>}<td className="text-right">{eur(l.quantity * l.unitPrice)}</td></tr>)}</tbody>
        </table>
        <dl className="mt-4 ml-auto max-w-72 space-y-1 text-sm">
          {inv.discount > 0 && <div className="flex justify-between"><dt className="text-slate-500">Remise</dt><dd>− {eur(inv.discount)}</dd></div>}
          {!c.vatExempt && <><div className="flex justify-between"><dt className="text-slate-500">Total HT</dt><dd>{eur(inv.totalHT)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">TVA</dt><dd>{eur(inv.totalTVA)}</dd></div></>}
          <div className="flex justify-between"><dt className="text-slate-500">Total {c.vatExempt ? "" : "TTC"}</dt><dd>{eur(c.vatExempt ? inv.totalHT : inv.totalTTC)}</dd></div>
          {inv.deducted > 0 && <div className="flex justify-between"><dt className="text-slate-500">Acomptes déjà facturés</dt><dd>− {eur(inv.deducted)}</dd></div>}
          <div className="flex justify-between text-base font-semibold"><dt>{inv.kind === "AVOIR" ? "Montant de l'avoir" : "Net à payer"}</dt><dd>{eur(net)}</dd></div>
          {c.vatExempt && <div className="text-xs text-slate-500">TVA non applicable, art. 293 B du CGI</div>}
        </dl>
      </Card>

      {!draft && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Envoi au client">
            <form action={sendInvoice.bind(null, id)} className="space-y-2">
              <input name="to" defaultValue={inv.client.email ?? ""} placeholder="E-mail du client" className="input" />
              <button className="btn-primary">✉ Envoyer le PDF par e-mail</button>
              {!isMailConfigured() && <p className="text-xs text-amber-700">Mode simulation : téléchargez le PDF pour l&apos;envoyer vous-même.</p>}
            </form>
          </Card>
          <Card title={`Facturation électronique — ${platform.name}`}>
            <p className="text-sm text-slate-600">{b2b ? "Client professionnel : la facture doit transiter par une plateforme agréée (émission obligatoire pour les TPE au 1er septembre 2027)." : "Client particulier : pas de facture électronique, mais les données de la vente relèvent du e-reporting via votre plateforme."}</p>
            <p className="mt-2 text-xs text-slate-500">{platform.howTo}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {inv.einvoiceStatus === "DEPOSEE" ? <><span className="text-emerald-700">✓ Déposée le {date(inv.einvoiceAt)}</span><form action={setEinvoiceStatus.bind(null, id, "A_DEPOSER")}><button className="text-xs text-slate-400 hover:underline">annuler</button></form></>
                : <form action={setEinvoiceStatus.bind(null, id, "DEPOSEE")}><button className="btn-secondary py-1.5">✓ Marquer comme déposée sur {platform.name}</button></form>}
              {platform.url && <a href={platform.url} target="_blank" className="text-link-600 hover:underline">Ouvrir {platform.name} ↗</a>}
            </div>
          </Card>
        </div>
      )}

      {!draft && inv.kind !== "AVOIR" && (
        <Card title={`Règlements — ${eur(paid)} / ${eur(net)}`}>
          {inv.payments.length > 0 && (
            <ul className="mb-4 divide-y divide-slate-100 text-sm">
              {inv.payments.map((p) => <li key={p.id} className="flex justify-between py-2"><span>{p.label}</span><span className={p.paidAt ? "text-emerald-700" : "text-slate-500"}>{eur(p.amount)} {p.paidAt ? `reçu le ${date(p.paidAt)}${p.method ? ` (${p.method})` : ""}` : "en attente"}</span></li>)}
            </ul>
          )}
          {inv.status !== "PAYEE" && inv.status !== "ANNULEE" && (
            <form action={recordInvoicePayment.bind(null, id)} className="grid gap-2 sm:grid-cols-[130px_150px_1fr_auto]">
              <input name="amount" inputMode="decimal" defaultValue={(Math.round((net - paid) * 100) / 100).toFixed(2)} className="input" />
              <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
              <select name="method" className="input">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
              <button className="btn-secondary">Enregistrer le règlement</button>
            </form>
          )}
          <p className="mt-2 text-xs text-slate-500">Les règlements alimentent le livre des recettes et le chiffre d&apos;affaires à déclarer à l&apos;URSSAF (date d&apos;encaissement).</p>
        </Card>
      )}

      {!draft && inv.kind !== "AVOIR" && inv.status !== "ANNULEE" && (
        <div className="text-right">
          {credits.length > 0 ? <span className="text-sm text-slate-500">Avoir : {credits.map((x) => <Link key={x.id} href={`/factures/${x.id}`} className="text-link-600">{x.number ?? "brouillon"}</Link>)}</span>
            : <ConfirmButton action={creditInvoice.bind(null, id)} label="Annuler par un avoir" title="Créer un avoir ?" message="Un brouillon d'avoir du même montant est créé. À son émission, cette facture passe en « Annulée »." confirmLabel="Créer l'avoir" className="btn-secondary text-rose-600" />}
        </div>
      )}
    </div>
  );
}
