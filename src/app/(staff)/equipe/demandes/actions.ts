"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { fromParis } from "@/lib/format";
import { eventKind } from "@/lib/presta";
import { nextReference } from "@/lib/reference";
import { syncPrestationEvent } from "@/lib/prestaSync";
import { runAutomations } from "@/lib/automations";
import { randomBytes } from "crypto";
import { sendMail } from "@/lib/mail";
import { baseUrl } from "@/lib/merge";
import { getCompany } from "@/lib/company";

const s = (f: FormData, k: string, n = 500) => { const v = f.get(k); return v == null || String(v).trim() === "" ? null : String(v).trim().slice(0, n); };
const KINDS = ["PRESTA", "RDV", "RENFORT"];
const staffIds = async () => (await db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true } })).map((u) => u.id);
const canManage = (u: { id: string; role: string }, r: { createdById: string }) => u.id === r.createdById || u.role === "ADMIN" || u.role === "MANAGER";

/** Nouvelle demande proposée à toute l'équipe (notification à chacun). */
export async function createTeamRequest(_: unknown, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  const u = await requireStaff();
  const title = s(f, "title", 160);
  const date = s(f, "date", 10);
  if (!title) return { error: "Donnez un titre à la demande (ex. « Mariage samedi à Cergy »)." };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide." };
  const hm = (k: string) => { const v = s(f, k, 5); return v && /^\d{2}:\d{2}$/.test(v) ? v : null; };
  const kind = KINDS.includes(s(f, "kind") ?? "") ? s(f, "kind")! : "PRESTA";
  const guests = Number(s(f, "guests")); const budget = Number((s(f, "budget") ?? "").replace(",", "."));
  const dossierId = s(f, "dossierId", 40);
  const r = await db.teamRequest.create({
    data: {
      createdById: u.id, kind, title, eventType: s(f, "eventType", 20) ?? "AUTRE", date, startTime: hm("startTime"), endTime: hm("endTime"),
      venue: s(f, "venue", 200), city: s(f, "city", 120), clientName: s(f, "clientName", 160), clientPhone: s(f, "clientPhone", 40),
      clientEmail: s(f, "clientEmail", 200)?.toLowerCase() ?? null, guests: Number.isFinite(guests) && guests > 0 ? Math.round(guests) : null,
      services: f.getAll("services").map(String).filter((x) => /^[A-Z]{2,12}$/.test(x)).join(","), budget: Number.isFinite(budget) && budget > 0 ? budget : null,
      notes: s(f, "notes", 3000), dossierId: dossierId && (await db.dossier.findUnique({ where: { id: dossierId }, select: { id: true } })) ? dossierId : null,
    },
  });
  const label = kind === "RENFORT" ? "🙋 Renfort demandé" : kind === "RDV" ? "🙋 Rendez-vous à prendre" : "🙋 Demande à pourvoir";
  await notify(await staffIds(), { type: "TASK", title: `${label} : ${r.title}`, body: `${u.name}${r.date ? ` · ${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${r.date}T12:00:00`))}` : ""} — qui est dispo ?`, link: `/equipe/demandes#d-${r.id}` }, u.id);
  revalidatePath("/equipe/demandes");
  return { ok: true };
}

/** Réponse d'un membre : dispo, pas dispo, peut-être (+ commentaire). */
export async function replyTeamRequest(requestId: string, answer: string, comment?: string) {
  const u = await requireStaff();
  if (!["DISPO", "PAS_DISPO", "PEUT_ETRE"].includes(answer)) return;
  const r = await db.teamRequest.findUnique({ where: { id: requestId } });
  if (!r || r.status !== "OUVERTE") return;
  const c = comment?.trim().slice(0, 500) || null;
  await db.teamReply.upsert({ where: { requestId_userId: { requestId, userId: u.id } }, update: { answer, comment: c }, create: { requestId, userId: u.id, answer, comment: c } });
  if (r.createdById !== u.id) await notify([r.createdById], { type: "TASK", title: `${answer === "DISPO" ? "✅" : answer === "PEUT_ETRE" ? "🤔" : "❌"} ${u.name} ${answer === "DISPO" ? "est dispo" : answer === "PEUT_ETRE" ? "est peut-être dispo" : "n'est pas dispo"} : ${r.title}`, body: c, link: `/equipe/demandes#d-${r.id}` }, u.id);
  revalidatePath("/equipe/demandes");
}

/** Attribuer la demande à un membre ; pour un renfort lié à une prestation, l'ajoute à son agenda. */
export async function assignTeamRequest(requestId: string, userId: string) {
  const u = await requireStaff();
  const r = await db.teamRequest.findUnique({ where: { id: requestId } });
  if (!r || !canManage(u, r) || r.status !== "OUVERTE") return;
  const m = await db.user.findFirst({ where: { id: userId, role: { not: "CLIENT" }, active: true }, select: { id: true, name: true } });
  if (!m) return;
  await db.teamRequest.update({ where: { id: requestId }, data: { status: "ATTRIBUEE", assigneeId: m.id } });
  if (r.date) {
    const start = fromParis(r.date, r.startTime ?? "09:00");
    let end = fromParis(r.date, r.endTime ?? (r.startTime ? r.startTime : "18:00"));
    if (end <= start) end = new Date(start.getTime() + (r.endTime ? 864e5 : 3 * 36e5));
    await db.event.create({ data: { title: `${r.kind === "RENFORT" ? "Renfort" : r.kind === "RDV" ? "RDV" : "Prestation"} : ${r.title}`, type: r.kind === "RENFORT" ? "INSTALL" : r.kind === "RDV" ? "RDV" : "AUTRE", start, end, location: [r.venue, r.city].filter(Boolean).join(", ") || null, description: r.notes, dossierId: r.dossierId, organizerId: u.id, attendees: { create: [{ userId: m.id }] } } });
  }
  await notify([m.id], { type: "TASK", title: `📌 ${u.name} vous attribue : ${r.title}`, body: r.date ? "Ajouté à votre agenda." : null, link: `/equipe/demandes#d-${r.id}` }, u.id);
  revalidatePath("/equipe/demandes");
}

export async function cancelTeamRequest(requestId: string) {
  const u = await requireStaff();
  const r = await db.teamRequest.findUnique({ where: { id: requestId } });
  if (!r || !canManage(u, r)) return;
  await db.teamRequest.update({ where: { id: requestId }, data: { status: r.status === "ANNULEE" ? "OUVERTE" : "ANNULEE" } });
  revalidatePath("/equipe/demandes");
}

/** Transforme la demande en prestation (client créé ou retrouvé par e-mail), puis ouvre la fiche à compléter. */
export async function convertTeamRequest(requestId: string) {
  const u = await requireStaff();
  const r = await db.teamRequest.findUnique({ where: { id: requestId } });
  if (!r || r.dossierId && r.kind !== "RENFORT") redirect(r?.dossierId ? `/prestations/${r.dossierId}` : "/equipe/demandes");
  if (!canManage(u, r!)) redirect("/equipe/demandes");
  const req = r!;
  let clientId = req.clientEmail ? (await db.client.findFirst({ where: { email: { equals: req.clientEmail, mode: "insensitive" } }, select: { id: true } }))?.id : undefined;
  if (!clientId) clientId = (await db.client.create({ data: { type: "INDIVIDUAL", name: req.clientName || `Client — ${req.title}`, email: req.clientEmail, phone: req.clientPhone, ownerId: u.id } })).id;
  const start = req.date ? fromParis(req.date, req.startTime ?? "18:00") : null;
  let end = req.date ? fromParis(req.date, req.endTime ?? "02:00") : null;
  if (start && end && end <= start) end = new Date(end.getTime() + 864e5);
  const d = await db.dossier.create({
    data: {
      reference: await nextReference(), title: req.title || `${eventKind(req.eventType).label} — ${req.clientName ?? "client"}`, status: "DEMANDE", eventType: req.eventType,
      clientId, assigneeId: req.assigneeId ?? u.id, eventStart: start, eventEnd: end, venueName: req.venue, venueCity: req.city, guests: req.guests,
      services: req.services, amount: req.budget, description: req.notes, source: "Équipe",
    },
  });
  await db.teamRequest.update({ where: { id: requestId }, data: { status: "CONVERTIE", dossierId: d.id } });
  await db.activity.create({ data: { dossierId: d.id, userId: u.id, kind: "STATUS", body: "Prestation créée depuis une demande de l'équipe" } });
  await syncPrestationEvent(d.id);
  await runAutomations(d.id, d.status, u);
  redirect(`/prestations/${d.id}/modifier`);
}

// ---------- Renforts extérieurs (sans compte) ----------

export async function saveHelper(id: string | null, _: unknown, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireStaff();
  const name = s(f, "name", 120);
  if (!name) return { error: "Indiquez au moins le prénom." };
  const data = { name, phone: s(f, "phone", 40), email: s(f, "email", 200)?.toLowerCase() ?? null, skills: f.getAll("skills").map(String).filter((x) => /^[A-Z]{2,12}$/.test(x)).join(","), notes: s(f, "notes", 500) };
  if (id) await db.helper.update({ where: { id }, data }); else await db.helper.create({ data });
  revalidatePath("/equipe/demandes");
  return { ok: true };
}

export async function toggleHelper(id: string) {
  await requireStaff();
  const h = await db.helper.findUnique({ where: { id } });
  if (h) await db.helper.update({ where: { id }, data: { active: !h.active } });
  revalidatePath("/equipe/demandes");
}

const fdate = (d: string | null) => (d ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00`)) : "date à définir");

/** Invite des renforts extérieurs : un lien personnel chacun (e-mail envoyé s'il est connu ; sinon SMS / WhatsApp depuis l'écran). */
export async function inviteHelpers(requestId: string, helperIds: string[]) {
  const u = await requireStaff();
  const r = await db.teamRequest.findUnique({ where: { id: requestId } });
  if (!r || r.status !== "OUVERTE") return;
  const c = await getCompany();
  const helpers = await db.helper.findMany({ where: { id: { in: helperIds.slice(0, 30) }, active: true } });
  for (const h of helpers) {
    const exists = await db.helperInvite.findUnique({ where: { requestId_helperId: { requestId, helperId: h.id } } });
    if (exists) continue;
    const inv = await db.helperInvite.create({ data: { requestId, helperId: h.id, token: randomBytes(18).toString("base64url") } });
    if (h.email) await sendMail({ to: h.email, replyTo: u.email, subject: `Dispo le ${fdate(r.date)} ? ${r.title}`, text: `Bonjour ${h.name},\n\n${u.name} (${c.name}) cherche un renfort : ${r.title}, ${fdate(r.date)}${r.startTime ? ` à partir de ${r.startTime}` : ""}${r.city ? `, ${r.city}` : ""}.\n\nRépondez en un clic (sans compte) :\n${baseUrl()}/r/${inv.token}\n\nMerci !\n${u.name}` });
  }
  revalidatePath("/equipe/demandes");
}

/** Retient un renfort extérieur : il voit sa mission confirmée sur son lien (et la reçoit par e-mail). */
export async function assignHelper(requestId: string, helperId: string) {
  const u = await requireStaff();
  const r = await db.teamRequest.findUnique({ where: { id: requestId } });
  if (!r || !canManage(u, r) || r.status !== "OUVERTE") return;
  const inv = await db.helperInvite.findUnique({ where: { requestId_helperId: { requestId, helperId } }, include: { helper: true } });
  if (!inv) return;
  await db.teamRequest.update({ where: { id: requestId }, data: { status: "ATTRIBUEE", helperId } });
  if (r.dossierId) await db.activity.create({ data: { dossierId: r.dossierId, userId: u.id, kind: "NOTE", body: `🛠 Renfort extérieur : ${inv.helper.name}${inv.helper.phone ? ` (${inv.helper.phone})` : ""}` } });
  if (inv.helper.email) await sendMail({ to: inv.helper.email, replyTo: u.email, subject: `C'est confirmé : ${r.title}, ${fdate(r.date)}`, text: `Bonjour ${inv.helper.name},\n\nC'est validé, merci ! Toutes les infos de la mission (horaires, lieu, contact) et l'ajout à votre agenda :\n${baseUrl()}/r/${inv.token}\n\n${u.name}` });
  revalidatePath("/equipe/demandes");
}
