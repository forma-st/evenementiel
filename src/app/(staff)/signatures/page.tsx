import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { clientWhere, pagePerm } from "@/lib/permissions";
import { SIGNATURE_STATUSES } from "@/lib/signature";
import { SIGNATURE_LIGHT } from "@/lib/signatureSelect";
import { date } from "@/lib/format";
import { Badge, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Signatures" };

export default async function Signatures({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const user = await requireStaff();
  const perms = await pagePerm(user, "canSendSignatures");
  const { statut = "" } = await searchParams;
  const list = await db.signatureRequest.findMany({
    where: { client: clientWhere(user, perms), ...(statut ? { status: statut } : {}) },
    select: SIGNATURE_LIGHT,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div>
      <PageHeader title="Signatures électroniques" subtitle={`${list.length} demande(s)`} actions={<Link href="/signatures/nouveau" className="btn-primary">✍ Nouvelle demande de signature</Link>} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/signatures" className={`badge px-3 py-1.5 ${!statut ? "bg-ink text-paper" : "border border-slate-200 bg-white"}`}>Toutes</Link>
        {Object.entries(SIGNATURE_STATUSES).map(([k, v]) => (
          <Link key={k} href={`/signatures?statut=${k}`} className={`badge px-3 py-1.5 ${statut === k ? "bg-ink text-paper" : "border border-slate-200 bg-white"}`}>{v.label}</Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        {list.length === 0 ? <Empty>Aucune demande de signature.</Empty> : (
          <table className="table">
            <thead><tr><th>Document</th><th>Client</th><th>Signataires</th><th>Envoyé le</th><th>Statut</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td><Link href={`/signatures/${r.id}`} className="font-medium text-link-600 hover:underline">{r.title}</Link><div className="text-xs text-slate-500">{r.dossier ? r.dossier.reference : r.fileName}</div></td>
                  <td>{r.client.name}</td>
                  <td className="text-sm">{r.signers.map((s) => <div key={s.id}>{s.status === "SIGNE" ? "✓" : s.status === "REFUSE" ? "✕" : "○"} {s.name}</div>)}</td>
                  <td>{date(r.createdAt)}</td>
                  <td><Badge className={SIGNATURE_STATUSES[r.status].color}>{SIGNATURE_STATUSES[r.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
