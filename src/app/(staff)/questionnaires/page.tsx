import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import Link from "next/link";
import { db } from "@/lib/db";
import { Empty, PageHeader } from "@/components/ui";
import { date } from "@/lib/format";
import { parseFields } from "@/lib/questionnaire";
import { archiveQuestionnaire, createFromTemplate, createQuestionnaire, deleteQuestionnaire, duplicateQuestionnaire } from "../actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function QuestionnairesPage({ searchParams }: { searchParams: Promise<{ archives?: string }> }) {
  await pagePerm(await requireStaff(), "canManageQuestionnaires");
  const { archives } = await searchParams;
  const list = await db.questionnaire.findMany({
    where: { archived: !!archives },
    include: { assignments: { select: { status: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div>
      <PageHeader
        title="Questionnaires"
        subtitle={<Link href={archives ? "/questionnaires" : "/questionnaires?archives=1"} className="hover:underline">{archives ? "← Questionnaires actifs" : "Voir les archives"}</Link>}
        actions={
          <>
            {([["preparation-soiree", "Préparation soirée DJ"], ["preparation-photo", "Préparation photo"], ["demande-devis", "Demande de devis"], ["satisfaction", "Satisfaction"]] as const).map(([k, l]) => (
              <form key={k} action={createFromTemplate.bind(null, k)}><button className="btn-secondary">Modèle « {l} »</button></form>
            ))}
            <form action={createQuestionnaire}><button className="btn-primary">+ Nouveau questionnaire</button></form>
          </>
        }
      />
      {list.length === 0 ? <div className="card"><Empty>Aucun questionnaire.</Empty></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((q) => {
            const done = q.assignments.filter((a) => a.status === "COMPLETE").length;
            return (
              <div key={q.id} className="card flex flex-col p-5">
                <Link href={`/questionnaires/${q.id}`} className="font-semibold hover:text-link-600">{q.title}</Link>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{q.description || "—"}</p>
                <div className="mt-3 text-xs text-slate-500">
                  {parseFields(q.fields).filter((f) => f.type !== "section").length} question(s) · {q.assignments.length} envoi(s) · {done} réponse(s) · modifié le {date(q.updatedAt)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <Link href={`/questionnaires/${q.id}`} className="btn-secondary">Éditer</Link>
                  <Link href={`/questionnaires/${q.id}/reponses`} className="btn-secondary">Envois & réponses</Link>
                  <form action={duplicateQuestionnaire.bind(null, q.id)}><button className="btn-secondary">Dupliquer</button></form>
                  <form action={archiveQuestionnaire.bind(null, q.id, !q.archived)}><button className="px-2 py-2 text-slate-400 hover:text-slate-700">{q.archived ? "Restaurer" : "Archiver"}</button></form>
                  <ConfirmButton
                    action={deleteQuestionnaire.bind(null, q.id)}
                    label="Supprimer"
                    title={`Supprimer « ${q.title} » ?`}
                    message={q.assignments.length
                      ? <>Ce questionnaire a été envoyé <b>{q.assignments.length} fois</b> ({done} réponse(s)). Les envois et <b>toutes les réponses</b> seront supprimés. Pour le garder sans l'utiliser, préférez « Archiver ».</>
                      : "Ce questionnaire n'a jamais été envoyé."}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
