"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { requirePerm } from "@/lib/permissions";
import { type QuoteLine, totals } from "@/lib/quotes";
import { runAutomations } from "@/lib/automations";
import { acceptQuote } from "@/lib/quoteAccept";
import { render, varsForDossier } from "@/lib/merge";
import { sendMail } from "@/lib/mail";
import { statusOf } from "@/lib/format";
import { syncPrestationEvent } from "@/lib/prestaSync";

export type QuoteFormState = { error?: string } | null;

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};
const num = (v: string | null, d = 0) => (v == null ? d : Number(v.replace(",", ".")) || d);

async function nextNumber() {
  const year = new Date().getFullYear();
  const last = await db.quote.findFirst({ where: { number: { startsWith: `DEV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last?.number ? Number(last.number.split("-")[2]) || 0 : 0;
  return `DEV-${year}-${String(n + 1).padStart(4, "0")}`;
}

function readForm(f: FormData) {
  let lines: QuoteLine[] = [];
  try {
    lines = JSON.parse(String(f.get("lines") || "[]"));
  } catch {
    return { error: "Lignes invalides" } as const;
  }
  lines = lines.filter((l) => l.label && l.quantity > 0).map((l) => ({ ...l, description: l.description?.trim() || undefined }));
  const clientId = s(f, "clientId");
  if (!clientId) return { error: "Choisissez un client." } as const;
  if (!lines.length) return { error: "Ajoutez au moins une ligne." } as const;
  const discount = Math.max(0, num(s(f, "discount")));
  const t = totals(lines, discount);
  return {
    data: {
      clientId,
      dossierId: s(f, "dossierId"),
      label: s(f, "label") || "Devis",
      lines: JSON.stringify(lines),
      discount,
      depositPercent: Math.min(100, Math.max(0, num(s(f, "depositPercent"), 30))),
      notes: s(f, "notes"),
      totalHT: t.totalHT,
      totalTTC: t.totalTTC,
      validUntil: new Date(s(f, "validUntil") || Date.now() + 30 * 864e5),
    },
  } as const;
}

export async function saveQuote(id: string | null, _: QuoteFormState, f: FormData): Promise<QuoteFormState> {
  const user = await requireStaff();
  try {
    await requirePerm(user, "canCreateQuotes", "créer des devis");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const r = readForm(f);
  if ("error" in r) return { error: r.error };
  let quoteId = id;
  if (id) {
    const q = await db.quote.findUniqueOrThrow({ where: { id } });
    if (q.status === "ACCEPTE") return { error: "Un devis accepté ne peut plus être modifié : dupliquez-le." };
    await db.quote.update({ where: { id }, data: r.data });
  } else {
    const q = await db.quote.create({ data: { ...r.data, number: await nextNumber(), token: randomBytes(18).toString("base64url") } });
    quoteId = q.id;
    if (q.dossierId) {
      await db.activity.create({ data: { dossierId: q.dossierId, userId: user.id, kind: "QUOTE", body: `Devis ${q.number} « ${q.label} » créé` } });
      // montant prévisionnel de la prestation
      await db.dossier.update({ where: { id: q.dossierId }, data: { amount: r.data.totalTTC } });
    }
  }
  if (f.get("andSend") === "1") await sendQuoteInternal(quoteId!, user, f.get("email") === "on");
  redirect(`/devis/${quoteId}`);
}

async function sendQuoteInternal(id: string, user: { id: string; name: string; email: string }, email: boolean) {
  const q = await db.quote.update({ where: { id }, data: { status: "ENVOYE", sentAt: new Date() }, include: { client: true, dossier: true } });
  if (!q.token) await db.quote.update({ where: { id }, data: { token: randomBytes(18).toString("base64url") } });
  if (q.dossier) {
    await db.activity.create({ data: { dossierId: q.dossier.id, userId: user.id, kind: "QUOTE", body: `Devis ${q.number} envoyé au client` } });
    if (q.dossier.status === "DEMANDE") {
      await db.dossier.update({ where: { id: q.dossier.id }, data: { status: "DEVIS_ENVOYE" } });
      await db.activity.create({ data: { dossierId: q.dossier.id, userId: user.id, kind: "STATUS", body: `Statut : ${statusOf("DEMANDE").label} → ${statusOf("DEVIS_ENVOYE").label}` } });
      await syncPrestationEvent(q.dossier.id);
      await runAutomations(q.dossier.id, "DEVIS_ENVOYE", user);
    }
  }
  if (email) {
    const tpl = await db.emailTemplate.findFirst({ where: { name: "Envoi du devis" } });
    const vars = q.dossier ? await varsForDossier(q.dossier.id) : {};
    const link = `${(await import("@/lib/merge")).baseUrl()}/d/${(await db.quote.findUniqueOrThrow({ where: { id } })).token}`;
    const all = { ...vars, "devis.numero": q.number ?? "", "lien.devis": link };
    const subject = render(tpl?.subject ?? "Votre devis {{devis.numero}}", all);
    const body = render(tpl?.body ?? `Bonjour,\n\nVoici notre proposition : ${link}\n\nBien cordialement`, all);
    const log = await sendMail({ to: q.client.email ?? "", subject, text: body, dossierId: q.dossierId, clientId: q.clientId, replyTo: user.email });
    if (q.dossierId) await db.activity.create({ data: { dossierId: q.dossierId, userId: user.id, kind: "EMAIL", body: `✉ Devis envoyé par e-mail${log.status === "SIMULE" ? " (simulation)" : log.status === "ERREUR" ? ` — échec : ${log.error}` : ""}` } });
  }
}

export async function sendQuote(id: string, f: FormData) {
  const user = await requireStaff();
  await requirePerm(user, "canCreateQuotes", "envoyer des devis");
  await sendQuoteInternal(id, user, f.get("email") === "on");
  revalidatePath(`/devis/${id}`);
}

export async function setQuoteStatus(id: string, status: string) {
  const user = await requireStaff();
  await requirePerm(user, "canViewQuotes", "gérer les devis");
  if (status === "ACCEPTE") await acceptQuote(id, user, `(saisi par ${user.name})`);
  else {
    const q = await db.quote.update({ where: { id }, data: { status, answeredAt: status === "REFUSE" ? new Date() : undefined } });
    if (q.dossierId && status === "REFUSE") await db.activity.create({ data: { dossierId: q.dossierId, userId: user.id, kind: "QUOTE", body: `Devis ${q.number ?? ""} refusé` } });
  }
  revalidatePath(`/devis/${id}`);
}

export async function duplicateQuote(id: string) {
  const user = await requireStaff();
  await requirePerm(user, "canCreateQuotes", "créer des devis");
  const q = await db.quote.findUniqueOrThrow({ where: { id } });
  const c = await db.quote.create({
    data: {
      clientId: q.clientId, dossierId: q.dossierId, label: q.label, lines: q.lines, discount: q.discount, depositPercent: q.depositPercent, notes: q.notes,
      totalHT: q.totalHT, totalTTC: q.totalTTC, validUntil: new Date(Date.now() + 30 * 864e5), number: await nextNumber(), token: randomBytes(18).toString("base64url"),
    },
  });
  redirect(`/devis/${c.id}/modifier`);
}

export async function deleteQuote(id: string) {
  const user = await requireStaff();
  await requirePerm(user, "canCreateQuotes", "supprimer des devis");
  const q = await db.quote.findUniqueOrThrow({ where: { id } });
  if (q.status !== "BROUILLON") return;
  await db.quote.delete({ where: { id } });
  redirect(q.dossierId ? `/prestations/${q.dossierId}` : "/devis");
}

