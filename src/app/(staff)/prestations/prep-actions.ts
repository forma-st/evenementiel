"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { buildPrepList, parsePrep } from "@/lib/prep";

/** Crée la liste de préparation, ou la met à jour avec le matériel réservé (les cases cochées sont gardées). */
export async function syncPrepList(dossierId: string) {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  const had = !!(await db.dossier.findUnique({ where: { id: dossierId }, select: { prepList: true } }))?.prepList;
  const list = await buildPrepList(dossierId, u.name);
  if (!had) await db.activity.create({ data: { dossierId, userId: u.id, kind: "STATUS", body: `📋 Liste de préparation du matériel créée (${list.items.length} article${list.items.length > 1 ? "s" : ""})` } });
  revalidatePath(`/prestations/${dossierId}`);
  revalidatePath(`/preparer/${dossierId}`);
}

/** Coche ou décoche un article ; prévient quand tout est prêt. */
export async function togglePrepItem(dossierId: string, equipmentId: string, done: boolean) {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, select: { prepList: true } });
  const list = parsePrep(d.prepList);
  if (!list) return;
  const wasComplete = list.items.length > 0 && list.items.every((i) => i.done);
  list.items = list.items.map((i) => (i.id === equipmentId ? { ...i, done, doneBy: done ? u.name : null, doneAt: done ? new Date().toISOString() : null } : i));
  await db.dossier.update({ where: { id: dossierId }, data: { prepList: JSON.stringify(list) } });
  const complete = list.items.length > 0 && list.items.every((i) => i.done);
  if (complete && !wasComplete) {
    await db.activity.create({ data: { dossierId, userId: u.id, kind: "STATUS", body: "✅ Matériel préparé : tous les articles sont cochés" } });
    await db.task.updateMany({ where: { dossierId, title: { startsWith: "Préparer le matériel" }, status: { not: "FAIT" } }, data: { status: "FAIT", completedAt: new Date() } });
  }
  revalidatePath(`/prestations/${dossierId}`);
  revalidatePath(`/preparer/${dossierId}`);
}
