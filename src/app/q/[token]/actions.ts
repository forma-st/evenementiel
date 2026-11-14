"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseFields, validateAnswers } from "@/lib/questionnaire";
import { notify } from "@/lib/notify";

export type SubmitState = { errors?: Record<string, string>; done?: boolean; answers?: Record<string, unknown> } | null;

export async function submitAnswers(token: string, _: SubmitState, f: FormData): Promise<SubmitState> {
  const a = await db.questionnaireAssignment.findUnique({ where: { token }, include: { questionnaire: true } });
  if (!a) return { errors: { _: "Lien invalide" } };
  if (a.status === "COMPLETE") return { done: true };
  let answers: Record<string, unknown> = {};
  try { answers = JSON.parse(String(f.get("answers") || "{}")); } catch {}
  const fields = parseFields(a.questionnaire.fields);
  // On ne garde que les champs connus
  answers = Object.fromEntries(fields.filter((x) => x.id in answers).map((x) => [x.id, answers[x.id]]));
  const errors = validateAnswers(fields, answers);
  if (Object.keys(errors).length) return { errors, answers };
  await db.questionnaireAssignment.update({
    where: { id: a.id },
    data: { status: "COMPLETE", answers: JSON.stringify(answers), submittedAt: new Date() },
  });
  if (a.dossierId)
    await db.activity.create({ data: { dossierId: a.dossierId, kind: "QUESTIONNAIRE", body: `Questionnaire « ${a.questionnaire.title} » complété par le client` } });
  // prévient le responsable du dossier et le responsable commercial du client
  const [dossier, client] = await Promise.all([
    a.dossierId ? db.dossier.findUnique({ where: { id: a.dossierId }, select: { assigneeId: true } }) : null,
    db.client.findUnique({ where: { id: a.clientId }, select: { ownerId: true, name: true } }),
  ]);
  await notify([dossier?.assigneeId, client?.ownerId], {
    type: "QUESTIONNAIRE",
    title: `${client?.name ?? "Un client"} a répondu au questionnaire « ${a.questionnaire.title} »`,
    link: `/questionnaires/reponse/${a.id}`,
  });
  revalidatePath("/portail");
  return { done: true };
}
