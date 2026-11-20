"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { rateLimit, requestInfo, tooMany } from "@/lib/security";
import { loadInvite } from "@/lib/helperInvite";

/** Réponse d'un renfort extérieur depuis son lien (sans compte). */
export async function answerInvite(token: string, answer: string, comment: string): Promise<{ error?: string; ok?: boolean }> {
  const lim = await rateLimit(`invite:${(await requestInfo()).ip}`, 40, 60 * 60e3);
  if (!lim.ok) return { error: tooMany(lim.retryAfter) };
  if (!["DISPO", "PAS_DISPO", "PEUT_ETRE"].includes(answer)) return { error: "Réponse invalide." };
  const inv = await loadInvite(token);
  if (!inv) return { error: "Ce lien n'est plus valide." };
  if (inv.request.status !== "OUVERTE") return { error: "La demande est close : merci quand même !" };
  const c = comment.trim().slice(0, 500) || null;
  await db.helperInvite.update({ where: { id: inv.id }, data: { answer, comment: c, answeredAt: new Date() } });
  const managers = (await db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, active: true }, select: { id: true } })).map((x) => x.id);
  await notify([inv.request.createdById, ...managers], { type: "TASK", title: `${answer === "DISPO" ? "✅" : answer === "PEUT_ETRE" ? "🤔" : "❌"} ${inv.helper.name} (renfort) ${answer === "DISPO" ? "est dispo" : answer === "PEUT_ETRE" ? "est peut-être dispo" : "n'est pas dispo"} : ${inv.request.title}`, body: c, link: `/equipe/demandes#d-${inv.requestId}` });
  revalidatePath(`/r/${token}`);
  revalidatePath("/equipe/demandes");
  return { ok: true };
}
