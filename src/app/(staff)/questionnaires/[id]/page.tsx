import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { QuestionnaireBuilder } from "@/components/QuestionnaireBuilder";
import { Back, PageHeader } from "@/components/ui";
import { parseFields } from "@/lib/questionnaire";
import { deleteQuestionnaire, saveQuestionnaire } from "../../actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function EditQuestionnaire({ params }: { params: Promise<{ id: string }> }) {
  await pagePerm(await requireStaff(), "canManageQuestionnaires");
  const { id } = await params;
  const q = await db.questionnaire.findUnique({ where: { id } });
  if (!q) notFound();
  const sent = await db.questionnaireAssignment.count({ where: { questionnaireId: id } });
  return (
    <div className="max-w-5xl">
      <Back href="/questionnaires">Questionnaires</Back>
      <PageHeader
        title="Éditeur de questionnaire"
        actions={
          <>
            <ConfirmButton
              action={deleteQuestionnaire.bind(null, id)}
              label="🗑 Supprimer"
              className="btn border border-brand-100 bg-white text-brand-600 hover:bg-brand-50"
              title={`Supprimer « ${q.title} » ?`}
              message={sent ? <>Ce questionnaire a été envoyé <b>{sent} fois</b>. Les envois et toutes les réponses seront supprimés.</> : "Ce questionnaire n'a jamais été envoyé."}
            />
            <Link href={`/questionnaires/${id}/reponses`} className="btn-secondary">Envois & réponses →</Link>
          </>
        }
      />
      <QuestionnaireBuilder
        initial={{ title: q.title, description: q.description ?? "", fields: parseFields(q.fields) }}
        onSave={saveQuestionnaire.bind(null, id)}
      />
    </div>
  );
}
