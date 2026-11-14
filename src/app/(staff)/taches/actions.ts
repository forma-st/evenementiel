"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { parseDay, taskStatus, toRow, type TaskRow } from "@/lib/tasks";
import { ForbiddenError, permsFor, taskWhere } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { date } from "@/lib/format";
import type { User } from "@prisma/client";

type Patch = Partial<Pick<TaskRow, "title" | "description" | "type" | "status" | "priority" | "dueDate" | "assigneeId" | "clientId" | "dossierId">>;

const ALLOWED = ["title", "description", "type", "status", "priority", "dueDate", "assigneeId", "clientId", "dossierId"] as const;

function toData(p: Patch) {
  const d: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (!(k in p)) continue;
    const v = p[k];
    if (k === "dueDate") d.dueDate = parseDay(v as string | null);
    else if (k === "title") d.title = String(v || "").trim() || "Sans titre";
    else d[k] = v === "" ? null : v;
  }
  if (p.status) d.completedAt = p.status === "FAIT" ? new Date() : null;
  return d;
}

function refresh(dossierId?: string | null, clientId?: string | null) {
  revalidatePath("/taches");
  revalidatePath("/");
  if (dossierId) revalidatePath(`/prestations/${dossierId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

/** Sans le droit « assigner à d'autres », une tâche reste à son créateur. */
async function checkAssignee(user: User, p: Patch) {
  if (p.assigneeId === undefined || p.assigneeId === null || p.assigneeId === user.id) return;
  if (!(await permsFor(user)).canAssignOthers) throw new ForbiddenError("assigner des tâches à d'autres membres");
}

async function notifyAssignee(user: User, t: { id: string; title: string; assigneeId: string | null; dueDate: Date | null; dossierId: string | null }) {
  await notify([t.assigneeId], {
    type: "TASK",
    title: `${user.name} vous a assigné une tâche`,
    body: `${t.title}${t.dueDate ? ` · échéance ${date(t.dueDate)}` : ""}`,
    link: t.dossierId ? `/prestations/${t.dossierId}` : "/taches?filtre=mes",
  }, user.id);
}

async function loadVisible(user: User, id: string) {
  const t = await db.task.findFirst({ where: { id, ...taskWhere(user, await permsFor(user)) } });
  if (!t) throw new ForbiddenError("modifier cette tâche");
  return t;
}

export async function createTask(p: Patch): Promise<TaskRow> {
  const user = await requireStaff();
  await checkAssignee(user, p);
  // Une tâche liée à un dossier hérite de son client
  if (p.dossierId && !p.clientId) {
    const d = await db.dossier.findUnique({ where: { id: p.dossierId } });
    p.clientId = d?.clientId ?? null;
  }
  const t = await db.task.create({
    data: { title: "Sans titre", assigneeId: user.id, ...toData(p), createdById: user.id } as never,
    include: { client: true, dossier: true },
  });
  await notifyAssignee(user, t);
  refresh(t.dossierId, t.clientId);
  return toRow(t);
}

export async function updateTask(id: string, p: Patch): Promise<TaskRow> {
  const user = await requireStaff();
  const before = await loadVisible(user, id);
  if (p.assigneeId !== before.assigneeId) await checkAssignee(user, p);
  if (p.dossierId && p.clientId === undefined) {
    const d = await db.dossier.findUnique({ where: { id: p.dossierId } });
    p.clientId = d?.clientId ?? before.clientId;
  }
  const t = await db.task.update({ where: { id }, data: toData(p), include: { client: true, dossier: true } });
  if (p.status && p.status !== before.status && t.dossierId && (p.status === "FAIT" || before.status === "FAIT")) {
    await db.activity.create({
      data: { dossierId: t.dossierId, userId: user.id, kind: "NOTE", body: `Tâche « ${t.title} » : ${taskStatus(p.status).label.toLowerCase()}` },
    });
  }
  if (p.assigneeId !== undefined && t.assigneeId !== before.assigneeId) await notifyAssignee(user, t);
  // prévient le créateur quand quelqu'un d'autre termine sa tâche
  if (p.status === "FAIT" && before.status !== "FAIT" && before.createdById && before.createdById !== user.id)
    await notify([before.createdById], { type: "TASK", title: `${user.name} a terminé « ${t.title} »`, link: t.dossierId ? `/prestations/${t.dossierId}` : "/taches" }, user.id);
  refresh(t.dossierId, t.clientId);
  return toRow(t);
}

export async function deleteTask(id: string) {
  const user = await requireStaff();
  await loadVisible(user, id);
  const t = await db.task.delete({ where: { id } });
  refresh(t.dossierId, t.clientId);
}
