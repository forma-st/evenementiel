import { Logo } from "@/components/Logo";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseFields } from "@/lib/questionnaire";
import { submitAnswers } from "./actions";
import { PublicForm } from "./Form";

export default async function PublicQuestionnaire({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await db.questionnaireAssignment.findUnique({ where: { token }, include: { questionnaire: true, client: true } });
  if (!a) notFound();
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto mb-6 flex max-w-2xl justify-center"><Logo className="h-12" /></div>
      <div className="card mx-auto max-w-2xl border-t-4 border-t-brand-600 p-6 sm:p-8">
        <div className="mb-1 text-sm text-slate-500">{a.client.name}</div>
        <h1 className="text-2xl font-semibold">{a.questionnaire.title}</h1>
        {a.questionnaire.description && <p className="mt-2 text-slate-600 whitespace-pre-wrap">{a.questionnaire.description}</p>}
        <div className="mt-6">
          {a.status === "COMPLETE"
            ? <div className="rounded-lg bg-emerald-50 p-6 text-center text-emerald-800">Ce questionnaire a déjà été complété. Merci !</div>
            : <PublicForm fields={parseFields(a.questionnaire.fields)} action={submitAnswers.bind(null, token)} />}
        </div>
      </div>
    </div>
  );
}
