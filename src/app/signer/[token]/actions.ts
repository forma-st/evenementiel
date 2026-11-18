"use server";
import { rateLimit, requestInfo, tooMany } from "@/lib/security";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { finalizeIfComplete } from "@/lib/signatureFlow";

export type SignState = { error?: string; done?: "SIGNE" | "REFUSE" } | null;

async function context() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || null,
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
  };
}

async function openSigner(token: string) {
  const s = await db.signatureSigner.findUnique({ where: { token }, include: { request: true } });
  if (!s) return { error: "Lien invalide." };
  if (s.request.status === "ANNULE") return { error: "Cette demande de signature a été annulée." };
  if (s.status !== "EN_ATTENTE") return { error: "Vous avez déjà répondu à cette demande." };
  if (s.request.status !== "EN_ATTENTE") return { error: "Cette demande n'est plus en attente de signature." };
  if (s.request.expiresAt < new Date()) return { error: "Ce lien de signature a expiré. Contactez-nous pour en recevoir un nouveau." };
  return { s };
}

export async function signDocument(token: string, _: SignState, f: FormData): Promise<SignState> {
  const lim = await rateLimit(`sign:${(await requestInfo()).ip}`, 20, 15 * 60e3);
  if (!lim.ok) return { error: tooMany(lim.retryAfter) };
  const o = await openSigner(token);
  if ("error" in o) return { error: o.error };
  if (f.get("agree") !== "on") return { error: "Cochez la case « J'ai lu et j'approuve le document »." };
  const image = String(f.get("signature") ?? "");
  if (!image.startsWith("data:image/png;base64,") || image.length < 1500) return { error: "Tracez votre signature dans le cadre." };
  if (image.length > 400_000) return { error: "Signature trop volumineuse, effacez et recommencez." };
  const { ip, userAgent } = await context();
  const upd = await db.signatureSigner.updateMany({
    where: { id: o.s.id, status: "EN_ATTENTE" },
    data: { status: "SIGNE", signedAt: new Date(), signatureImage: image, ip, userAgent, viewedAt: o.s.viewedAt ?? new Date() },
  });
  if (!upd.count) return { error: "Vous avez déjà répondu à cette demande." };
  await finalizeIfComplete(o.s.requestId);
  revalidatePath(`/signer/${token}`);
  return { done: "SIGNE" };
}

export async function declineDocument(token: string, _: SignState, f: FormData): Promise<SignState> {
  const lim = await rateLimit(`sign:${(await requestInfo()).ip}`, 20, 15 * 60e3);
  if (!lim.ok) return { error: tooMany(lim.retryAfter) };
  const o = await openSigner(token);
  if ("error" in o) return { error: o.error };
  const reason = String(f.get("reason") ?? "").trim().slice(0, 1000);
  const { ip, userAgent } = await context();
  await db.signatureSigner.update({ where: { id: o.s.id }, data: { status: "REFUSE", declineReason: reason || null, ip, userAgent } });
  const r = await db.signatureRequest.update({ where: { id: o.s.requestId }, data: { status: "REFUSE" }, include: { client: true, dossier: true } });
  if (r.dossierId) await db.activity.create({ data: { dossierId: r.dossierId, kind: "QUOTE", body: `✍ ${o.s.name} a refusé de signer « ${r.title} »${reason ? ` : ${reason}` : ""}` } });
  await notify([r.createdById, r.client.ownerId, r.dossier?.assigneeId], {
    type: "SYSTEM", title: `${o.s.name} (${r.client.name}) a refusé de signer « ${r.title} »`, body: reason || null, link: `/signatures/${r.id}`,
  });
  revalidatePath(`/signer/${token}`);
  return { done: "REFUSE" };
}
