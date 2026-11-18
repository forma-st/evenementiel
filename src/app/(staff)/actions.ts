"use server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { syncPrestationEvent } from "@/lib/prestaSync";
import { createPaymentSchedule } from "@/lib/automations";
import { render, varsForDossier } from "@/lib/merge";
import { sendMail } from "@/lib/mail";
import { refreshInvoiceStatus } from "@/lib/invoiceStatus";
import { equipmentAvailability } from "@/lib/equipment";
import { eventKind } from "@/lib/presta";
import type { Field } from "@/lib/questionnaire";
import { assertClientVisible, assertDossierVisible, requirePerm } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { runAutomations } from "@/lib/automations";
import { DOSSIER_STATUSES, dateTime, eur, fromParis, statusOf } from "@/lib/format";
const DOSSIER_STATUS_IDS: string[] = DOSSIER_STATUSES.map((x) => x.id);

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};

// ---------------- Clients ----------------

function clientData(f: FormData) {
  return {
    type: s(f, "type") || "COMPANY",
    name: s(f, "name") || "Sans nom",
    siren: s(f, "siren")?.replace(/\s/g, "") ?? null,
    siret: s(f, "siret")?.replace(/\s/g, "") ?? null,
    vatNumber: s(f, "vatNumber")?.replace(/\s/g, "").toUpperCase() ?? null,
    nafCode: s(f, "nafCode"),
    legalForm: s(f, "legalForm"),
    headcount: s(f, "headcount"),
    email: s(f, "email"),
    phone: s(f, "phone"),
    address: s(f, "address"),
    postalCode: s(f, "postalCode"),
    city: s(f, "city"),
    country: s(f, "country") || "FR",
    notes: s(f, "notes"),
  };
}

/** Étiquettes cochées dans le formulaire (liste d'identifiants). */
const tagIds = (f: FormData) => f.getAll("tagIds").map(String).filter(Boolean);

export async function createClient(f: FormData) {
  const user = await requireStaff();
  const c = await db.client.create({
    data: { ...clientData(f), ownerId: s(f, "ownerId") || user.id, tagList: { connect: tagIds(f).map((id) => ({ id })) } },
  });
  redirect(`/clients/${c.id}`);
}

export async function updateClient(id: string, f: FormData) {
  const user = await requireStaff();
  await assertClientVisible(user, id);
  await db.client.update({
    where: { id },
    data: { ...clientData(f), ownerId: s(f, "ownerId"), tagList: { set: tagIds(f).map((id) => ({ id })) } },
  });
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClient(id: string, back = "/clients") {
  const user = await requireStaff();
  await requirePerm(user, "canDeleteClients", "supprimer des clients");
  await assertClientVisible(user, id);
  await db.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect(back);
}

export async function addContact(clientId: string, f: FormData) {
  await requireStaff();
  await db.contact.create({
    data: {
      clientId,
      firstName: s(f, "firstName") || "",
      lastName: s(f, "lastName") || "",
      email: s(f, "email"),
      phone: s(f, "phone"),
      jobTitle: s(f, "jobTitle"),
    },
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteContact(id: string, clientId: string) {
  await requireStaff();
  await db.contact.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
}

/** Crée (ou réinitialise) l'accès portail d'un client. Renvoie le mot de passe temporaire. */
export async function createPortalAccess(clientId: string, _prev: unknown, f: FormData) {
  await requireStaff();
  const email = (s(f, "email") || "").toLowerCase();
  const name = s(f, "name") || email;
  if (!email) return { error: "E-mail requis" };
  const password = randomBytes(6).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && (existing.role !== "CLIENT" || existing.clientId !== clientId))
    return { error: "Cet e-mail est déjà utilisé par un autre compte." };
  if (existing) await db.user.update({ where: { id: existing.id }, data: { passwordHash, name } });
  else await db.user.create({ data: { email, name, passwordHash, role: "CLIENT", clientId } });
  revalidatePath(`/clients/${clientId}`);
  return { email, password };
}

// ---------------- Prestations ----------------

async function nextReference() {
  const year = new Date().getFullYear();
  const last = await db.dossier.findFirst({ where: { reference: { startsWith: `P${year}-` } }, orderBy: { reference: "desc" }, select: { reference: true } });
  const n = last ? Number(last.reference.split("-")[1]) || 0 : 0;
  return `P${year}-${String(n + 1).padStart(4, "0")}`;
}

/** Date + heures saisies (heure de Paris). Une heure de fin inférieure au début passe au lendemain. */
function eventTimes(f: FormData) {
  const day = s(f, "eventDate");
  if (!day) return { eventStart: null, eventEnd: null };
  const start = fromParis(day, s(f, "startTime") || "18:00");
  let end = fromParis(day, s(f, "endTime") || "02:00");
  if (end <= start) end = new Date(end.getTime() + 864e5);
  return { eventStart: start, eventEnd: end };
}

function dossierData(f: FormData) {
  const due = s(f, "dueDate");
  const amount = s(f, "amount");
  const guests = s(f, "guests");
  const pct = s(f, "depositPercent");
  return {
    title: s(f, "title") || "Prestation",
    description: s(f, "description"),
    status: s(f, "status") || "DEMANDE",
    priority: s(f, "priority") || "NORMALE",
    dueDate: due ? new Date(due) : null,
    amount: amount ? Number(amount.replace(",", ".")) : null,
    clientId: s(f, "clientId")!,
    assigneeId: s(f, "assigneeId"),
    eventType: s(f, "eventType") || "AUTRE",
    services: f.getAll("services").map(String).filter(Boolean).join(","),
    ...eventTimes(f),
    setupTime: s(f, "setupTime"),
    venueName: s(f, "venueName"),
    venueAddress: s(f, "venueAddress"),
    venueCity: s(f, "venueCity"),
    venueContact: s(f, "venueContact"),
    guests: guests ? Math.max(0, Math.round(Number(guests))) || null : null,
    source: s(f, "source"),
    lostReason: s(f, "lostReason"),
    depositPercent: pct ? Math.min(100, Math.max(0, Number(pct.replace(",", ".")))) : 30,
  };
}

/** Client choisi, ou créé à la volée depuis le formulaire de prestation (réutilisé si l'e-mail existe déjà). */
async function resolveClient(f: FormData, ownerId: string) {
  const id = s(f, "clientId");
  if (id && id !== "__new__") return id;
  const name = s(f, "newClientName");
  if (!name) throw new Error("Indiquez le nom du nouveau client.");
  const email = s(f, "newClientEmail")?.toLowerCase() ?? null;
  if (email) {
    const ex = await db.client.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (ex) return ex.id;
  }
  const c = await db.client.create({
    data: {
      type: s(f, "newClientType") === "COMPANY" ? "COMPANY" : "INDIVIDUAL", name, email, phone: s(f, "newClientPhone"),
      address: s(f, "newClientAddress"), postalCode: s(f, "newClientPostalCode"), city: s(f, "newClientCity"),
      siren: s(f, "newClientSiren")?.replace(/\s/g, "") ?? null, ownerId,
    },
  });
  return c.id;
}

export async function createDossier(f: FormData) {
  const user = await requireStaff();
  const clientId = await resolveClient(f, user.id);
  const data = dossierData(f);
  if (!s(f, "title")) {
    const cl = await db.client.findUnique({ where: { id: clientId }, select: { name: true } });
    data.title = `${eventKind(data.eventType).label} — ${cl?.name ?? "client"}`;
  }
  const d = await db.dossier.create({ data: { ...data, clientId, reference: await nextReference() } });
  await notify([d.assigneeId], { type: "TASK", title: `${user.name} vous a confié la prestation « ${d.title} »`, link: `/prestations/${d.id}` }, user.id);
  await db.activity.create({ data: { dossierId: d.id, userId: user.id, kind: "STATUS", body: "Prestation créée" } });
  await syncPrestationEvent(d.id);
  await runAutomations(d.id, d.status, user);
  redirect(`/prestations/${d.id}`);
}

export async function updateDossier(id: string, f: FormData) {
  const user = await requireStaff();
  await assertDossierVisible(user, id);
  const before = await db.dossier.findUniqueOrThrow({ where: { id } });
  const d = await db.dossier.update({ where: { id }, data: { ...dossierData(f), clientId: await resolveClient(f, user.id) } });
  if (d.assigneeId !== before.assigneeId)
    await notify([d.assigneeId], { type: "TASK", title: `${user.name} vous a confié la prestation « ${d.title} »`, link: `/prestations/${d.id}` }, user.id);
  if (d.eventStart?.getTime() !== before.eventStart?.getTime() && before.eventStart)
    await db.activity.create({ data: { dossierId: id, userId: user.id, kind: "STATUS", body: `Date modifiée : ${dateTime(before.eventStart)} → ${d.eventStart ? dateTime(d.eventStart) : "sans date"}` } });
  await syncPrestationEvent(id);
  if (d.status !== before.status) {
    await db.activity.create({ data: { dossierId: id, userId: user.id, kind: "STATUS", body: `Statut : ${statusOf(before.status).label} → ${statusOf(d.status).label}` } });
    await runAutomations(id, d.status, user);
  }
  redirect(`/prestations/${id}`);
}

export async function setDossierStatus(id: string, status: string) {
  const user = await requireStaff();
  await assertDossierVisible(user, id);
  if (!DOSSIER_STATUS_IDS.includes(status)) return;
  const before = await db.dossier.findUniqueOrThrow({ where: { id } });
  if (before.status === status) return;
  await db.dossier.update({ where: { id }, data: { status } });
  await db.activity.create({
    data: { dossierId: id, userId: user.id, kind: "STATUS", body: `Statut : ${statusOf(before.status).label} → ${statusOf(status).label}` },
  });
  await syncPrestationEvent(id);
  await runAutomations(id, status, user);
  revalidatePath("/prestations");
  revalidatePath(`/prestations/${id}`);
}

export async function addNote(dossierId: string, f: FormData) {
  const user = await requireStaff();
  const body = s(f, "body");
  if (!body) return;
  await db.activity.create({ data: { dossierId, userId: user.id, kind: "NOTE", body } });
  revalidatePath(`/prestations/${dossierId}`);
}

export async function deleteDossier(id: string, back = "/prestations") {
  const user = await requireStaff();
  await requirePerm(user, "canDeleteDossiers", "supprimer des prestations");
  await assertDossierVisible(user, id);
  await db.event.deleteMany({ where: { dossierId: id, type: "PRESTATION" } });
  const d = await db.dossier.delete({ where: { id } });
  revalidatePath("/prestations");
  revalidatePath(`/clients/${d.clientId}`);
  revalidatePath("/");
  redirect(back);
}

// ---------------- Paiements ----------------

export async function addPayment(dossierId: string, f: FormData) {
  const user = await requireStaff();
  await assertDossierVisible(user, dossierId);
  const amount = Number((s(f, "amount") || "0").replace(",", "."));
  if (!amount) return;
  const due = s(f, "dueDate");
  await db.payment.create({ data: { dossierId, label: s(f, "label") || "Paiement", amount, dueDate: due ? fromParis(due, "12:00") : null } });
  revalidatePath(`/prestations/${dossierId}`);
}

export async function markPaymentPaid(id: string, f: FormData) {
  const user = await requireStaff();
  const p = await db.payment.findUniqueOrThrow({ where: { id } });
  if (p.dossierId) await assertDossierVisible(user, p.dossierId);
  const paid = !p.paidAt;
  await db.payment.update({ where: { id }, data: { paidAt: paid ? new Date() : null, method: paid ? s(f, "method") : null } });
  if (p.invoiceId) await refreshInvoiceStatus(p.invoiceId);
  if (paid && p.dossierId) await db.activity.create({ data: { dossierId: p.dossierId, userId: user.id, kind: "PAYMENT", body: `💶 ${p.label} reçu : ${eur(p.amount)}${s(f, "method") ? ` (${s(f, "method")})` : ""}` } });
  revalidatePath(`/prestations/${p.dossierId}`);
}

export async function deletePayment(id: string) {
  const user = await requireStaff();
  const p = await db.payment.findUniqueOrThrow({ where: { id } });
  if (p.dossierId) await assertDossierVisible(user, p.dossierId);
  if (p.invoiceId) return; // encaissement lié à une facture : conservé
  await db.payment.delete({ where: { id } });
  revalidatePath(`/prestations/${p.dossierId}`);
}

export async function generatePayments(dossierId: string) {
  const user = await requireStaff();
  await assertDossierVisible(user, dossierId);
  await createPaymentSchedule(dossierId, 7);
  revalidatePath(`/prestations/${dossierId}`);
}

// ---------------- Matériel réservé ----------------

export type EquipmentState = { error?: string; ok?: string } | null;

/**
 * Ajout ou changement de quantité d'un matériel sur une prestation, refusé si :
 * - le matériel est déjà sur la prestation (mode « ajout ») ;
 * - la quantité dépasse le stock encore libre sur le créneau (autres prestations en option ou confirmées).
 */
export async function setDossierEquipment(dossierId: string, _: EquipmentState, f: FormData): Promise<EquipmentState> {
  const user = await requireStaff();
  await assertDossierVisible(user, dossierId);
  const equipmentId = s(f, "equipmentId");
  const quantity = Math.max(0, Math.round(Number(s(f, "quantity") || "1")));
  const mode = s(f, "mode") === "update" ? "update" : "add";
  if (!equipmentId) return { error: "Choisissez un matériel." };
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, select: { eventStart: true, eventEnd: true } });
  const av = (await equipmentAvailability(dossierId, d.eventStart, d.eventEnd)).find((x) => x.id === equipmentId);
  if (!av) return { error: "Matériel introuvable ou désactivé." };
  if (mode === "add" && av.mine > 0) return { error: `« ${av.name} » est déjà réservé sur cette prestation (${av.mine}). Modifiez la quantité dans la liste au lieu de l'ajouter une deuxième fois.` };
  const free = av.stock - av.elsewhere;
  if (quantity > free) {
    const who = av.conflicts.map((c) => `${c.reference} « ${c.title} » (${c.quantity})`).join(", ");
    return { error: free <= 0 ? `« ${av.name} » n'est plus disponible sur ce créneau : tout le stock (${av.stock}) est réservé par ${who}.` : `Seulement ${free} « ${av.name} » disponible(s) sur ce créneau (stock ${av.stock}${who ? `, déjà pris par ${who}` : ""}).` };
  }
  if (!quantity) await db.dossierEquipment.deleteMany({ where: { dossierId, equipmentId } });
  else await db.dossierEquipment.upsert({ where: { dossierId_equipmentId: { dossierId, equipmentId } }, update: { quantity }, create: { dossierId, equipmentId, quantity } });
  revalidatePath(`/prestations/${dossierId}`);
  return { ok: quantity ? `${quantity} × ${av.name} réservé(s).` : `${av.name} retiré.` };
}

export async function removeDossierEquipment(dossierId: string, equipmentId: string) {
  const user = await requireStaff();
  await assertDossierVisible(user, dossierId);
  await db.dossierEquipment.deleteMany({ where: { dossierId, equipmentId } });
  revalidatePath(`/prestations/${dossierId}`);
}

// ---------------- E-mails manuels ----------------

export async function sendEmailToClient(dossierId: string, f: FormData) {
  const user = await requireStaff();
  await assertDossierVisible(user, dossierId);
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, include: { client: true } });
  const vars = await varsForDossier(dossierId);
  const subject = render(s(f, "subject") || "", vars);
  const body = render(String(f.get("body") ?? ""), vars);
  if (!subject || !body.trim()) return;
  const log = await sendMail({ to: s(f, "to") || d.client.email || "", subject, text: body, dossierId, clientId: d.clientId, replyTo: user.email });
  await db.activity.create({ data: { dossierId, userId: user.id, kind: "EMAIL", body: `✉ E-mail « ${subject} »${log.status === "SIMULE" ? " (simulation : non envoyé)" : log.status === "ERREUR" ? ` — échec : ${log.error}` : " envoyé"}` } });
  revalidatePath(`/prestations/${dossierId}`);
}

// ---------------- Questionnaires ----------------

export async function createQuestionnaire() {
  await requirePerm(await requireStaff(), "canManageQuestionnaires", "gérer les questionnaires");
  const q = await db.questionnaire.create({ data: { title: "Nouveau questionnaire", fields: "[]" } });
  redirect(`/questionnaires/${q.id}`);
}

export async function saveQuestionnaire(id: string, data: { title: string; description: string; fields: Field[] }) {
  await requirePerm(await requireStaff(), "canManageQuestionnaires", "gérer les questionnaires");
  await db.questionnaire.update({
    where: { id },
    data: { title: data.title || "Sans titre", description: data.description || null, fields: JSON.stringify(data.fields) },
  });
  revalidatePath(`/questionnaires/${id}`);
  return { ok: true };
}

export async function duplicateQuestionnaire(id: string) {
  await requirePerm(await requireStaff(), "canManageQuestionnaires", "gérer les questionnaires");
  const q = await db.questionnaire.findUniqueOrThrow({ where: { id } });
  const c = await db.questionnaire.create({ data: { title: q.title + " (copie)", description: q.description, fields: q.fields } });
  redirect(`/questionnaires/${c.id}`);
}

export async function createFromTemplate(templateId: string) {
  await requirePerm(await requireStaff(), "canManageQuestionnaires", "gérer les questionnaires");
  const { QUESTIONNAIRE_TEMPLATES } = await import("@/lib/questionnaireTemplates");
  const t = QUESTIONNAIRE_TEMPLATES[templateId as keyof typeof QUESTIONNAIRE_TEMPLATES];
  if (!t) return;
  const q = await db.questionnaire.create({ data: { title: t.title, description: t.description, fields: JSON.stringify(t.fields) } });
  redirect(`/questionnaires/${q.id}`);
}

export async function deleteQuestionnaire(id: string) {
  await requirePerm(await requireStaff(), "canManageQuestionnaires", "supprimer des questionnaires");
  await db.questionnaire.delete({ where: { id } });
  revalidatePath("/questionnaires");
  redirect("/questionnaires");
}

export async function archiveQuestionnaire(id: string, archived: boolean) {
  await requirePerm(await requireStaff(), "canManageQuestionnaires", "gérer les questionnaires");
  await db.questionnaire.update({ where: { id }, data: { archived } });
  revalidatePath("/questionnaires");
}

export async function sendQuestionnaire(f: FormData) {
  const user = await requireStaff();
  await requirePerm(user, "canManageQuestionnaires", "envoyer des questionnaires");
  const questionnaireId = s(f, "questionnaireId")!;
  const clientId = s(f, "clientId")!;
  const dossierId = s(f, "dossierId");
  const back = s(f, "back") || `/questionnaires/${questionnaireId}/reponses`;
  await db.questionnaireAssignment.create({
    data: { token: randomBytes(18).toString("base64url"), questionnaireId, clientId, dossierId },
  });
  if (dossierId) {
    const q = await db.questionnaire.findUnique({ where: { id: questionnaireId } });
    await db.activity.create({ data: { dossierId, userId: user.id, kind: "QUESTIONNAIRE", body: `Questionnaire « ${q?.title} » envoyé` } });
  }
  revalidatePath(back);
  redirect(back);
}

export async function deleteAssignment(id: string, back: string) {
  await requirePerm(await requireStaff(), "canManageQuestionnaires", "gérer les questionnaires");
  await db.questionnaireAssignment.delete({ where: { id } });
  revalidatePath(back);
}
