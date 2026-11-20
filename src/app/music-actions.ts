"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser, requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { writePlan } from "@/lib/plan";
import type { MusicData } from "@/lib/music";
import { randomBytes } from "crypto";
import { ensurePlanToken } from "@/lib/plan";
import { render, varsForDossier } from "@/lib/merge";
import { sendMail } from "@/lib/mail";
import { getCompany } from "@/lib/company";
import { totals, parseLines, type QuoteLine } from "@/lib/quotes";
import { ORGANISATION_EMAIL } from "@/lib/defaults";

/** Enregistre l'organisation : l'équipe (prestation visible) ou le client connecté de la prestation. */
export async function saveMusicPlan(dossierId: string, data: Partial<MusicData>) {
  const u = await currentUser();
  if (!u) return { error: "Session expirée : reconnectez-vous." };
  const d = await db.dossier.findUnique({ where: { id: dossierId }, select: { clientId: true } });
  if (!d) return { error: "Prestation introuvable." };
  const client = u.role === "CLIENT";
  if (client) { if (!u.clientId || u.clientId !== d.clientId) return { error: "Non autorisé." }; }
  else await assertDossierVisible(u, dossierId);
  const r = await writePlan(dossierId, data, { name: u.name, client, userId: u.id });
  revalidatePath(`/prestations/${dossierId}`);
  return r;
}

/** Verrouiller / rouvrir au client ; `forceOpen` rouvre après la date limite ; `deadlineDays` règle la limite. */
export async function setPlanAccess(dossierId: string, p: { clientCanEdit?: boolean; forceOpen?: boolean; deadlineDays?: number }) {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  const data = {
    ...(typeof p.clientCanEdit === "boolean" ? { clientCanEdit: p.clientCanEdit } : {}),
    ...(typeof p.forceOpen === "boolean" ? { forceOpen: p.forceOpen } : {}),
    ...(typeof p.deadlineDays === "number" ? { deadlineDays: Math.max(0, Math.min(60, Math.round(p.deadlineDays))) } : {}),
  };
  await db.musicPlan.upsert({ where: { dossierId }, update: data, create: { dossierId, ...data } });
  revalidatePath(`/prestations/${dossierId}`);
}

/** Compatibilité : ancien bouton « verrouiller ». */
export async function setMusicClientEdit(dossierId: string, open: boolean) {
  await setPlanAccess(dossierId, { clientCanEdit: open });
}

// ---------- envoi du lien et options demandées ----------

/** Envoie au client le lien de son espace organisation (modèle « Organisation de votre événement »). */
export async function sendPlanLink(dossierId: string) {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  await ensurePlanToken(dossierId);
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, include: { client: true } });
  if (!d.client.email) return { error: "Le client n'a pas d'adresse e-mail : copiez le lien et envoyez-le autrement." };
  const tpl = (await db.emailTemplate.findFirst({ where: { name: ORGANISATION_EMAIL.name } })) ?? ORGANISATION_EMAIL;
  const vars = await varsForDossier(dossierId);
  const log = await sendMail({ to: d.client.email, subject: render(tpl.subject, vars), text: render(tpl.body, vars), dossierId, clientId: d.clientId, replyTo: u.email });
  await db.musicPlan.update({ where: { dossierId }, data: { sentAt: new Date() } });
  await db.activity.create({ data: { dossierId, userId: u.id, kind: "EMAIL", body: `✉ Lien de l'espace organisation envoyé${log.status === "SIMULE" ? " (simulation)" : log.status === "ERREUR" ? ` — échec : ${log.error}` : ""}` } });
  revalidatePath(`/prestations/${dossierId}`);
  return log.status === "ERREUR" ? { error: `Échec de l'envoi : ${log.error}` } : { ok: log.status === "SIMULE" ? "Lien prêt (mode simulation : e-mail non envoyé)." : `Lien envoyé à ${d.client.email}.` };
}

/** Accepter une option ajoute la ligne au devis complémentaire en brouillon (créé au besoin) ; refuser la classe. */
export async function answerOption(id: string, accept: boolean) {
  const u = await requireStaff();
  const r = await db.optionRequest.findUnique({ where: { id }, include: { dossier: { select: { id: true, clientId: true, depositPercent: true } } } });
  if (!r || r.status !== "DEMANDE") return;
  await assertDossierVisible(u, r.dossierId);
  if (!accept) {
    await db.optionRequest.update({ where: { id }, data: { status: "REFUSEE", answeredAt: new Date() } });
    await db.activity.create({ data: { dossierId: r.dossierId, userId: u.id, kind: "QUOTE", body: `Option non retenue : ${r.label}` } });
  } else {
    const c = await getCompany();
    const line: QuoteLine = { label: r.label, description: r.note ?? undefined, quantity: r.quantity, unit: r.unit, unitPrice: r.unitPrice, vatRate: c.vatExempt ? 0 : r.vatRate };
    let q = await db.quote.findFirst({ where: { dossierId: r.dossierId, status: "BROUILLON", label: { startsWith: "Options supplémentaires" } } });
    if (q) {
      const lines = [...parseLines(q.lines), line]; const t = totals(lines, q.discount);
      q = await db.quote.update({ where: { id: q.id }, data: { lines: JSON.stringify(lines), totalHT: t.totalHT, totalTTC: t.totalTTC } });
    } else {
      const year = new Date().getFullYear();
      const last = await db.quote.findFirst({ where: { number: { startsWith: `DEV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
      const number = `DEV-${year}-${String((last?.number ? Number(last.number.split("-")[2]) || 0 : 0) + 1).padStart(4, "0")}`;
      const t = totals([line], 0);
      q = await db.quote.create({ data: { clientId: r.dossier.clientId, dossierId: r.dossierId, label: "Options supplémentaires", number, token: randomBytes(18).toString("base64url"), lines: JSON.stringify([line]), totalHT: t.totalHT, totalTTC: t.totalTTC, depositPercent: 0, validUntil: new Date(Date.now() + 15 * 864e5) } });
    }
    await db.optionRequest.update({ where: { id }, data: { status: "ACCEPTEE", answeredAt: new Date(), quoteId: q.id } });
    await db.activity.create({ data: { dossierId: r.dossierId, userId: u.id, kind: "QUOTE", body: `✓ Option acceptée : ${r.label}, ajoutée au devis ${q.number}` } });
  }
  revalidatePath(`/prestations/${r.dossierId}`);
}
