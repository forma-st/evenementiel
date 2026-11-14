"use server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { permsFor } from "@/lib/permissions";
import { readLayout, type LayoutItem } from "@/lib/widgets";

/** Enregistre la disposition du tableau de bord de l'utilisateur (null = disposition par défaut). */
export async function saveDashboardLayout(layout: LayoutItem[] | null) {
  const u = await requireStaff();
  const clean = layout ? readLayout(JSON.stringify(layout), await permsFor(u)) : null;
  await db.user.update({ where: { id: u.id }, data: { dashboardLayout: clean ? JSON.stringify(clean) : null } });
  return { ok: true };
}
