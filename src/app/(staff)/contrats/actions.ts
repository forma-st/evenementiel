"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible, requirePerm } from "@/lib/permissions";
import { buildContractPdf } from "@/lib/contracts";
import { sha256, signerToken } from "@/lib/signature";
import { sendSignatureEmail } from "@/lib/signatureMail";
import { CONTRACT_DJ } from "@/lib/defaults";

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};

export async function createTemplate() {
  await requirePerm(await requireStaff(), "canSendSignatures", "gérer les contrats");
  const t = await db.contractTemplate.create({ data: { name: "Nouveau modèle de contrat", body: CONTRACT_DJ } });
  redirect(`/contrats/${t.id}`);
}

export async function saveTemplate(id: string, f: FormData) {
  await requirePerm(await requireStaff(), "canSendSignatures", "gérer les contrats");
  await db.contractTemplate.update({
    where: { id },
    data: { name: s(f, "name") || "Modèle", body: String(f.get("body") ?? ""), services: f.getAll("services").map(String).join(","), attachQuote: f.get("attachQuote") === "on" },
  });
  revalidatePath("/contrats");
  redirect("/contrats");
}

export async function duplicateTemplate(id: string) {
  await requirePerm(await requireStaff(), "canSendSignatures", "gérer les contrats");
  const t = await db.contractTemplate.findUniqueOrThrow({ where: { id } });
  const c = await db.contractTemplate.create({ data: { name: `${t.name} (copie)`, body: t.body, services: t.services, attachQuote: t.attachQuote } });
  redirect(`/contrats/${c.id}`);
}

export async function archiveTemplate(id: string, archived: boolean) {
  await requirePerm(await requireStaff(), "canSendSignatures", "gérer les contrats");
  await db.contractTemplate.update({ where: { id }, data: { archived } });
  revalidatePath("/contrats");
}

export type GenState = { error?: string } | null;

/** Génère le PDF du contrat (texte relu + devis en annexe) et l'envoie en signature électronique. */
export async function generateContract(_: GenState, f: FormData): Promise<GenState> {
  const user = await requireStaff();
  try {
    await requirePerm(user, "canSendSignatures", "envoyer des contrats");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const dossierId = s(f, "dossierId");
  if (!dossierId) return { error: "Prestation manquante." };
  await assertDossierVisible(user, dossierId);
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId } });
  const title = s(f, "title") || "Contrat de prestation";
  const body = String(f.get("body") ?? "");
  if (/\{\{\s*[\w.]+\s*\}\}/.test(body)) return { error: "Il reste des variables non remplacées ({{…}}) : complétez la fiche de la prestation ou corrigez le texte." };
  const names = f.getAll("signerName").map(String);
  const emails = f.getAll("signerEmail").map(String);
  const signers = names.map((name, i) => ({ name: name.trim(), email: emails[i]?.trim() || null })).filter((x) => x.name);
  if (!signers.length) return { error: "Ajoutez au moins un signataire." };
  const quoteId = s(f, "quoteId");

  const pdf = await buildContractPdf(title, body, quoteId);
  const days = Math.min(90, Math.max(1, Number(s(f, "expiresInDays")) || 15));
  const r = await db.signatureRequest.create({
    data: {
      title, message: s(f, "message"), clientId: d.clientId, dossierId, quoteId, createdById: user.id, kind: "CONTRAT", templateId: s(f, "templateId"),
      fileName: `contrat-${d.reference}.pdf`, original: new Uint8Array(pdf), originalHash: sha256(pdf),
      winOnSign: f.get("winOnSign") === "on", expiresAt: new Date(Date.now() + days * 864e5),
      signers: { create: signers.map((x) => ({ ...x, token: signerToken() })) },
    },
    include: { signers: true },
  });
  await db.activity.create({ data: { dossierId, userId: user.id, kind: "QUOTE", body: `✍ Contrat « ${title} » envoyé en signature à ${signers.map((x) => x.name).join(", ")}` } });
  if (f.get("sendEmail") === "on") for (const sg of r.signers) if (sg.email) await sendSignatureEmail(sg.id, user);
  redirect(`/signatures/${r.id}`);
}
