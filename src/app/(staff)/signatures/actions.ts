"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { clientWhere, requirePerm } from "@/lib/permissions";
import { sendSignatureEmail } from "@/lib/signatureMail";

async function load(id: string) {
  const u = await requireStaff();
  const p = await requirePerm(u, "canSendSignatures", "gérer les signatures");
  const r = await db.signatureRequest.findFirst({ where: { id, client: clientWhere(u, p) }, select: { id: true, status: true, dossierId: true, title: true } });
  if (!r) throw new Error("Demande introuvable");
  return { u, r };
}

export async function cancelSignature(id: string) {
  const { u, r } = await load(id);
  if (r.status !== "EN_ATTENTE") return;
  await db.signatureRequest.update({ where: { id }, data: { status: "ANNULE" } });
  if (r.dossierId) await db.activity.create({ data: { dossierId: r.dossierId, userId: u.id, kind: "QUOTE", body: `✍ Demande de signature « ${r.title} » annulée` } });
  revalidatePath(`/signatures/${id}`);
}

export async function deleteSignature(id: string) {
  const { r } = await load(id);
  if (r.status === "SIGNE") return; // un document signé est conservé (valeur de preuve)
  await db.signatureRequest.delete({ where: { id } });
  revalidatePath("/signatures");
  redirect("/signatures");
}

/** Prolonge la validité des liens de 30 jours. */
export async function extendSignature(id: string) {
  const { r } = await load(id);
  if (r.status !== "EN_ATTENTE") return;
  await db.signatureRequest.update({ where: { id }, data: { expiresAt: new Date(Date.now() + 30 * 864e5) } });
  revalidatePath(`/signatures/${id}`);
}


/** Envoie (ou renvoie) par e-mail le lien personnel de signature. */
export async function emailSigner(signerId: string) {
  const u = await requireStaff();
  const sg = await db.signatureSigner.findUniqueOrThrow({ where: { id: signerId } });
  const { r } = await load(sg.requestId);
  await sendSignatureEmail(sg.id, u);
  revalidatePath(`/signatures/${r.id}`);
}
