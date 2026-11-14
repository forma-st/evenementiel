import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { SIGNATURE_STATUSES } from "@/lib/signature";
import { date } from "@/lib/format";
import { servicesLabel } from "@/lib/presta";
import { archiveTemplate, createTemplate, duplicateTemplate } from "./actions";

export const metadata = { title: "Contrats" };

export default async function ContractsPage() {
  await pagePerm(await requireStaff(), "canSendSignatures");
  const [templates, recent] = await Promise.all([
    db.contractTemplate.findMany({ orderBy: [{ archived: "asc" }, { name: "asc" }] }),
    db.signatureRequest.findMany({ where: { kind: "CONTRAT" }, select: { id: true, title: true, status: true, createdAt: true, client: { select: { name: true } }, dossier: { select: { id: true, reference: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrats"
        subtitle="Modèles préétablis remplis automatiquement avec les informations de la prestation, du client et du devis, puis envoyés en signature électronique."
        actions={<form action={createTemplate}><button className="btn-primary">+ Nouveau modèle</button></form>}
      />
      <Card title="Modèles">
        {templates.length === 0 ? <Empty>Aucun modèle.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${t.archived ? "opacity-50" : ""}`}>
                <div>
                  <Link href={`/contrats/${t.id}`} className="font-medium hover:text-link-600">{t.name}</Link>
                  <div className="text-xs text-slate-500">{t.services ? servicesLabel(t.services) : "Tous services"} · {t.attachQuote ? "devis joint en annexe" : "sans annexe"} · modifié le {date(t.updatedAt)}</div>
                </div>
                <div className="flex gap-2 text-sm">
                  <Link href={`/contrats/${t.id}`} className="btn-secondary py-1.5">Modifier</Link>
                  <form action={duplicateTemplate.bind(null, t.id)}><button className="btn-secondary py-1.5">Dupliquer</button></form>
                  <form action={archiveTemplate.bind(null, t.id, !t.archived)}><button className="btn-secondary py-1.5">{t.archived ? "Réactiver" : "Archiver"}</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-500">Pour envoyer un contrat : ouvrez la prestation puis « Générer le contrat ». Les modèles fournis sont des bases de travail à faire valider par un juriste.</p>
      </Card>
      <Card title="Contrats envoyés">
        {recent.length === 0 ? <Empty>Aucun contrat envoyé pour le moment.</Empty> : (
          <table className="table">
            <thead><tr><th>Contrat</th><th>Client</th><th>Prestation</th><th>Envoyé le</th><th>Statut</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/signatures/${r.id}`} className="text-link-600 hover:underline">{r.title}</Link></td>
                  <td>{r.client.name}</td>
                  <td>{r.dossier ? <Link href={`/prestations/${r.dossier.id}`} className="hover:text-link-600">{r.dossier.reference}</Link> : "—"}</td>
                  <td>{date(r.createdAt)}</td>
                  <td><Badge className={SIGNATURE_STATUSES[r.status].color}>{SIGNATURE_STATUSES[r.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
