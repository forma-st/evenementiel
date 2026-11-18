import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { QUOTE_STATUSES, date, eur, quoteStatus } from "@/lib/format";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pagePerm(await requireStaff(), "canViewQuotes");
  const { status = "" } = await searchParams;
  const quotes = await db.quote.findMany({
    where: status ? { status: status === "ENVOYE" ? { in: ["ENVOYE"] } : status } : {},
    include: { client: true, dossier: true },
    orderBy: { createdAt: "desc" },
  });
  const total = quotes.reduce((a, q) => a + q.totalHT, 0);
  return (
    <div>
      <PageHeader title="Devis" subtitle={`${quotes.length} devis · ${eur(total)} HT`} actions={<Link href="/devis/nouveau" className="btn-primary">+ Nouveau devis</Link>} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/devis" className={`badge px-3 py-1.5 ${!status ? "bg-ink text-paper" : "bg-white border border-slate-200"}`}>Tous</Link>
        {Object.entries(QUOTE_STATUSES).filter(([k]) => !["ERREUR"].includes(k)).map(([k, v]) => (
          <Link key={k} href={`/devis?status=${k}`} className={`badge px-3 py-1.5 ${status === k ? "bg-ink text-paper" : "bg-white border border-slate-200"}`}>{v.label}</Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        {quotes.length === 0 ? <Empty>Aucun devis.</Empty> : (
          <table className="table">
            <thead><tr><th>N°</th><th>Objet</th><th>Client</th><th>Prestation</th><th>Date</th><th className="text-right">HT</th><th className="text-right">TTC</th><th>Statut</th></tr></thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td><Link href={`/devis/${q.id}`} className="font-medium text-link-600 hover:underline">{q.number ?? "—"}</Link></td>
                  <td><Link href={`/devis/${q.id}`}>{q.label}</Link></td>
                  <td>{q.client.name}</td>
                  <td className="text-slate-500">{q.dossier ? <Link href={`/prestations/${q.dossier.id}`} className="hover:text-link-600">{q.dossier.reference}</Link> : "—"}</td>
                  <td>{date(q.issuedAt)}</td>
                  <td className="text-right">{eur(q.totalHT)}</td>
                  <td className="text-right">{eur(q.totalTTC)}</td>
                  <td><Badge className={quoteStatus(q.status).color}>{quoteStatus(q.status).label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
