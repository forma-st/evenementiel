import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Back, Card, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { formatAnswer, parseFields } from "@/lib/questionnaire";

export default async function ResponseView({ params }: { params: Promise<{ aid: string }> }) {
  await pagePerm(await requireStaff(), "canManageQuestionnaires");
  const { aid } = await params;
  const a = await db.questionnaireAssignment.findUnique({ where: { id: aid }, include: { questionnaire: true, client: true, dossier: true } });
  if (!a) notFound();
  const fields = parseFields(a.questionnaire.fields);
  const answers: Record<string, unknown> = a.answers ? JSON.parse(a.answers) : {};
  return (
    <div className="max-w-3xl space-y-6">
      <Back href={`/questionnaires/${a.questionnaireId}/reponses`}>{a.questionnaire.title}</Back>
      <PageHeader
        title={a.questionnaire.title}
        subtitle={<><Link href={`/clients/${a.clientId}`} className="text-link-600 hover:underline">{a.client.name}</Link>{a.dossier && <> · <Link href={`/prestations/${a.dossier.id}`} className="text-link-600 hover:underline">{a.dossier.reference}</Link></>} · {a.submittedAt ? `répondu le ${dateTime(a.submittedAt)}` : "pas encore répondu"}</>}
      />
      <Card>
        <dl className="space-y-4">
          {fields.map((f) =>
            f.type === "section" ? (
              <h3 key={f.id} className="border-b border-slate-200 pt-2 pb-1 font-semibold">{f.label}</h3>
            ) : (
              <div key={f.id}>
                <dt className="text-sm text-slate-500">{f.label}</dt>
                <dd className="whitespace-pre-wrap">{formatAnswer(f, answers[f.id])}</dd>
              </div>
            ),
          )}
        </dl>
      </Card>
    </div>
  );
}
