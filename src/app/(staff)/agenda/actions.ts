"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { eventWhere, permsFor, ForbiddenError } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { dateTime, fromParis } from "@/lib/format";
import { eventType } from "@/lib/events";
import type { User } from "@prisma/client";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function parse(f: FormData) {
  const day = s(f, "day");
  const allDay = f.get("allDay") === "on";
  const start = allDay ? fromParis(day, "00:00") : fromParis(day, s(f, "startTime") || "09:00");
  let end = allDay ? fromParis(s(f, "endDay") || day, "23:59") : fromParis(s(f, "endDay") || day, s(f, "endTime") || "10:00");
  if (end <= start) end = new Date(start.getTime() + 60 * 60_000);
  return {
    title: s(f, "title") || "Sans titre",
    type: s(f, "type") || "REUNION",
    start, end, allDay,
    location: s(f, "location") || null,
    description: s(f, "description") || null,
    clientId: s(f, "clientId") || null,
    dossierId: s(f, "dossierId") || null,
    attendees: [...new Set(f.getAll("attendees").map(String).filter(Boolean))],
  };
}

async function visibleEvent(user: User, id: string) {
  const e = await db.event.findFirst({ where: { id, ...eventWhere(user, await permsFor(user)) }, include: { attendees: true } });
  if (!e) throw new ForbiddenError("modifier cet événement");
  return e;
}

function refresh(e: { id: string; clientId: string | null; dossierId: string | null }) {
  revalidatePath("/agenda");
  revalidatePath("/");
  if (e.clientId) revalidatePath(`/clients/${e.clientId}`);
  if (e.dossierId) revalidatePath(`/prestations/${e.dossierId}`);
}

export async function createEvent(f: FormData) {
  const user = await requireStaff();
  const { attendees, ...data } = parse(f);
  if (data.dossierId && !data.clientId) data.clientId = (await db.dossier.findUnique({ where: { id: data.dossierId } }))?.clientId ?? null;
  const ids = [...new Set([user.id, ...attendees])];
  const e = await db.event.create({ data: { ...data, organizerId: user.id, attendees: { create: ids.map((userId) => ({ userId })) } } });
  await notify(ids, {
    type: "EVENT",
    title: `${user.name} vous invite : ${eventType(e.type).label.toLowerCase()} « ${e.title} »`,
    body: dateTime(e.start) + (e.location ? ` · ${e.location}` : ""),
    link: `/agenda/${e.id}`,
  }, user.id);
  if (e.dossierId)
    await db.activity.create({ data: { dossierId: e.dossierId, userId: user.id, kind: "NOTE", body: `${eventType(e.type).label} planifié(e) le ${dateTime(e.start)} : ${e.title}` } });
  refresh(e);
  redirect(`/agenda/${e.id}`);
}

export async function updateEvent(id: string, f: FormData) {
  const user = await requireStaff();
  const before = await visibleEvent(user, id);
  const { attendees, ...data } = parse(f);
  const ids = [...new Set([before.organizerId ?? user.id, ...attendees])];
  const e = await db.event.update({
    where: { id },
    data: { ...data, attendees: { deleteMany: {}, create: ids.map((userId) => ({ userId })) } },
  });
  const added = ids.filter((x) => !before.attendees.some((a) => a.userId === x));
  const moved = before.start.getTime() !== e.start.getTime();
  await notify(moved ? ids : added, {
    type: "EVENT",
    title: moved ? `« ${e.title} » a été déplacé au ${dateTime(e.start)}` : `${user.name} vous invite : « ${e.title} »`,
    body: dateTime(e.start),
    link: `/agenda/${e.id}`,
  }, user.id);
  refresh(e);
  redirect(`/agenda/${e.id}`);
}

export async function deleteEvent(id: string) {
  const user = await requireStaff();
  const e = await visibleEvent(user, id);
  await db.event.delete({ where: { id } });
  await notify(e.attendees.map((a) => a.userId), { type: "EVENT", title: `« ${e.title} » du ${dateTime(e.start)} a été annulé`, link: "/agenda" }, user.id);
  refresh(e);
  redirect("/agenda");
}

/** Enregistre le compte-rendu (et l'ajoute au journal du dossier la première fois). */
export async function saveReport(id: string, report: string) {
  const user = await requireStaff();
  const before = await visibleEvent(user, id);
  const e = await db.event.update({ where: { id }, data: { report: report.trim() || null } });
  if (e.dossierId && report.trim() && !before.report)
    await db.activity.create({ data: { dossierId: e.dossierId, userId: user.id, kind: "NOTE", body: `Compte-rendu — ${e.title} :\n${report.trim().slice(0, 1500)}` } });
  refresh(e);
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Jeton personnel pour l'abonnement Google Agenda (flux iCal). */
export async function regenerateIcsToken() {
  const user = await requireStaff();
  await db.user.update({ where: { id: user.id }, data: { icsToken: randomBytes(24).toString("base64url") } });
  revalidatePath("/parametres/integrations");
}
