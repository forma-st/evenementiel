"use server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { permsFor } from "@/lib/permissions";
import { LAYOUT_VERSION, cleanLayout, type LayoutItem } from "@/lib/widgets";

/** Enregistre la disposition du tableau de bord de l'utilisateur (null = disposition par défaut). */
export async function saveDashboardLayout(layout: LayoutItem[] | null) {
  const u = await requireStaff();
  const clean = layout ? cleanLayout(layout, await permsFor(u)) : null;
  await db.user.update({ where: { id: u.id }, data: { dashboardLayout: clean ? JSON.stringify({ v: LAYOUT_VERSION, items: clean }) : null } });
  return { ok: true };
}
