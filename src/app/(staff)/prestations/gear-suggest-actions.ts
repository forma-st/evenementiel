"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { equipmentAvailability } from "@/lib/equipment";
import { suggestGear } from "@/lib/gearSuggest";

export async function loadSuggestion(dossierId: string) {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  return suggestGear(dossierId);
}

/** Réserve les quantités validées (remplace la quantité des articles concernés, ne touche pas aux autres). */
export async function applySuggestion(dossierId: string, items: { id: string; qty: number }[]) {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, select: { eventStart: true, eventEnd: true } });
  const av = await equipmentAvailability(dossierId, d.eventStart, d.eventEnd);
  const done: string[] = [], skipped: string[] = [];
  for (const it of items.slice(0, 100)) {
    const a = av.find((x) => x.id === it.id);
    if (!a) continue;
    const qty = Math.max(0, Math.min(Math.round(Number(it.qty) || 0), a.stock - a.elsewhere));
    if (Math.round(Number(it.qty) || 0) > qty) skipped.push(a.name);
    if (!qty) await db.dossierEquipment.deleteMany({ where: { dossierId, equipmentId: it.id } });
    else { await db.dossierEquipment.upsert({ where: { dossierId_equipmentId: { dossierId, equipmentId: it.id } }, update: { quantity: qty }, create: { dossierId, equipmentId: it.id, quantity: qty } }); done.push(`${qty} × ${a.name}`); }
  }
  if (done.length) await db.activity.create({ data: { dossierId, userId: u.id, kind: "STATUS", body: `✨ Matériel proposé validé : ${done.join(", ")}` } });
  revalidatePath(`/prestations/${dossierId}`);
  return { ok: done.length, skipped };
}
