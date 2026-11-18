import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { INVOICE_KINDS, INVOICE_STATUSES } from "@/lib/invoices";
import { date, eur } from "@/lib/format";

export const metadata = { title: "Factures" };

export default async function Invoices({ searchParams }: { searchParams: Promise<{ statut?: string; pa?: string }> }) {
  await pagePerm(await requireStaff(), "canViewQuotes");
  const sp = await searchParams;
  const [list, toFile] = await Promise.all([db.invoice.findMany({
    where: { ...(sp.statut ? { status: sp.statut } : {}), ...(sp.pa ? { einvoiceStatus: "A_DEPOSER", status: { not: "BROUILLON" } } : {}) },
    include: { client: { select: { name: true, type: true } }, dossier: { select: { id: true, reference: true } }, payments: { select: { amount: true, paidAt: true } } },
    orderBy: [{ issueDate: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
  }), db.invoice.count({ where: { einvoiceStatus: "A_DEPOSER", status: { not: "BROUILLON" } } })]);
  const due = list.filter((i) => i.status === "EMISE" && i.kind !== "AVOIR").reduce((a, i) => a + i.totalTTC - i.deducted - i.payments.filter((p) => p.paidAt).reduce((x, p) => x + p.amount, 0), 0);
  return (
    <div>
      <PageHeader title="Factures" subtitle={`${list.length} document(s) · reste à encaisser ${eur(due)}`} actions={<><Link href="/comptabilite" className="btn-secondary">Comptabilité</Link><Link href="/factures/nouvelle" className="btn-primary">+ Facture libre</Link></>} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/factures" className={`badge px-3 py-1.5 ${!sp.statut && !sp.pa ? "bg-slate-800 text-white" : "border border-slate-200 bg-white"}`}>Toutes</Link>
        {Object.entries(INVOICE_STATUSES).map(([k, v]) => <Link key={k} href={`/factures?statut=${k}`} className={`badge px-3 py-1.5 ${sp.statut === k ? "bg-slate-800 text-white" : "border border-slate-200 bg-white"}`}>{v.label}</Link>)}
        <Link href="/factures?pa=1" className={`badge px-3 py-1.5 ${sp.pa ? "bg-amber-600 text-white" : "border border-amber-300 bg-amber-50 text-amber-800"}`}>À déposer sur la plateforme ({toFile})</Link>
      </div>
      <div className="card overflow-x-auto">
        {list.length === 0 ? <Empty>Aucune facture. Facturez depuis l&apos;échéancier d&apos;une prestation.</Empty> : (
          <table className="table">
            <thead><tr><th>N°</th><th>Type</th><th>Client</th><th>Prestation</th><th>Émise le</th><th className="text-right">Montant</th><th>Statut</th><th>Plateforme</th></tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td><Link href={`/factures/${i.id}`} className="font-medium text-link-600 hover:underline">{i.number ?? "Brouillon"}</Link></td>
                  <td className="text-slate-600">{INVOICE_KINDS[i.kind].label}</td>
                  <td>{i.client.name}{i.client.type === "COMPANY" && <span className="ml-1 text-xs text-slate-400">(pro)</span>}</td>
                  <td>{i.dossier ? <Link href={`/prestations/${i.dossier.id}`} className="hover:text-link-600">{i.dossier.reference}</Link> : "—"}</td>
                  <td>{date(i.issueDate)}</td>
                  <td className="text-right tabular-nums">{i.kind === "AVOIR" ? "− " : ""}{eur(i.totalTTC - i.deducted)}</td>
                  <td><Badge className={INVOICE_STATUSES[i.status].color}>{INVOICE_STATUSES[i.status].label}</Badge></td>
                  <td className="text-xs">{i.status === "BROUILLON" ? "" : i.einvoiceStatus === "DEPOSEE" ? <span className="text-emerald-700">✓ déposée</span> : <span className="text-amber-700">à déposer</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
