"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { acceptQuote } from "@/lib/quoteAccept";

export async function answerQuote(token: string, _: unknown, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  const q = await db.quote.findUnique({ where: { token }, include: { client: true, dossier: true } });
  if (!q || !["ENVOYE"].includes(q.status)) return { error: "Ce devis ne peut plus être modifié." };
  if (q.validUntil < new Date()) return { error: "Ce devis a expiré." };
  const name = String(f.get("name") ?? "").trim();
  const answer = String(f.get("answer") ?? "");
  if (answer === "accept") {
    if (!name) return { error: "Indiquez votre nom." };
    if (f.get("agree") !== "on") return { error: "Cochez la case « bon pour accord »." };
    await acceptQuote(q.id, null, `en ligne par ${name}`);
    await notify([q.dossier?.assigneeId, q.client.ownerId], { type: "SYSTEM", title: `✅ ${q.client.name} a accepté le devis ${q.number ?? ""}`, body: "Générez le contrat depuis la prestation.", link: q.dossierId ? `/prestations/${q.dossierId}` : `/devis/${q.id}` });
  } else if (answer === "refuse") {
    const reason = String(f.get("reason") ?? "").trim();
    await db.quote.update({ where: { id: q.id }, data: { status: "REFUSE", answeredAt: new Date() } });
    if (q.dossierId) await db.activity.create({ data: { dossierId: q.dossierId, kind: "QUOTE", body: `❌ Devis ${q.number ?? ""} décliné en ligne${reason ? ` : « ${reason} »` : ""}` } });
    await notify([q.dossier?.assigneeId, q.client.ownerId], { type: "SYSTEM", title: `❌ ${q.client.name} a décliné le devis ${q.number ?? ""}`, body: reason || null, link: `/devis/${q.id}` });
  }
  revalidatePath(`/d/${token}`);
  return { ok: true };
}
