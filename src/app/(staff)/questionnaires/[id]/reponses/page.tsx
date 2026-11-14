import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { CopyLink } from "@/components/CopyLink";
import { Back, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { date } from "@/lib/format";
import { deleteAssignment, sendQuestionnaire } from "../../../actions";

export default async function Responses({ params }: { params: Promise<{ id: string }> }) {
  await pagePerm(await requireStaff(), "canManageQuestionnaires");
  const { id } = await params;
  const [q, clients] = await Promise.all([
    db.questionnaire.findUnique({
      where: { id },
      include: { assignments: { include: { client: true, dossier: true }, orderBy: { createdAt: "desc" } } },
    }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!q) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const base = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const back = `/questionnaires/${id}/reponses`;

  return (
    <div className="max-w-5xl space-y-6">
      <Back href="/questionnaires">Questionnaires</Back>
      <PageHeader title={q.title} subtitle="Envois et réponses" actions={<><a href={`/api/questionnaires/${id}/export`} className="btn-secondary">Exporter CSV</a><Link href={`/questionnaires/${id}`} className="btn-secondary">Éditer</Link></>} />

      <Card title="Envoyer à un client">
        <form action={sendQuestionnaire} className="flex flex-wrap gap-2">
          <input type="hidden" name="questionnaireId" value={id} />
          <input type="hidden" name="back" value={back} />
          <select name="clientId" required className="input max-w-sm" defaultValue="">
            <option value="" disabled>Choisir un client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-primary">Générer le lien</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Le client peut répondre via le lien (sans compte) ou depuis son espace client.</p>
      </Card>

      <div className="card overflow-x-auto">
        {q.assignments.length === 0 ? <Empty>Pas encore d'envoi.</Empty> : (
          <table className="table">
            <thead><tr><th>Client</th><th>Prestation</th><th>Envoyé</th><th>Statut</th><th>Lien</th><th /></tr></thead>
            <tbody>
              {q.assignments.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/clients/${a.clientId}`} className="hover:text-link-600">{a.client.name}</Link></td>
                  <td className="text-slate-500">{a.dossier?.reference ?? "—"}</td>
                  <td>{date(a.createdAt)}</td>
                  <td>
                    {a.status === "COMPLETE"
                      ? <Link href={`/questionnaires/reponse/${a.id}`}><Badge className="bg-emerald-100 text-emerald-700">Complété le {date(a.submittedAt)} →</Badge></Link>
                      : <Badge className="bg-amber-100 text-amber-800">En attente</Badge>}
                  </td>
                  <td><CopyLink url={`${base}/q/${a.token}`} /></td>
                  <td><form action={deleteAssignment.bind(null, a.id, back)}><button className="text-xs text-slate-400 hover:text-rose-600">Supprimer</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
