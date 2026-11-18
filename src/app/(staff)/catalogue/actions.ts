"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { requirePerm } from "@/lib/permissions";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (v: string, d = 0) => (v === "" ? d : Number(v.replace(",", ".")) || 0);

function item(f: FormData) {
  return {
    category: s(f, "category") || "OPTION",
    label: s(f, "label") || "Article",
    description: s(f, "description") || null,
    unit: s(f, "unit") || "forfait",
    unitPrice: n(s(f, "unitPrice")),
    vatRate: n(s(f, "vatRate"), 20),
  };
}

export async function saveCatalogItem(id: string | null, f: FormData) {
  await requirePerm(await requireStaff(), "canCreateQuotes", "gérer le catalogue");
  if (id) await db.catalogItem.update({ where: { id }, data: item(f) });
  else await db.catalogItem.create({ data: { ...item(f), position: await db.catalogItem.count() } });
  revalidatePath("/catalogue");
}

export async function toggleCatalogItem(id: string, active: boolean) {
  await requirePerm(await requireStaff(), "canCreateQuotes", "gérer le catalogue");
  await db.catalogItem.update({ where: { id }, data: { active } });
  revalidatePath("/catalogue");
}

export async function deleteCatalogItem(id: string) {
  await requirePerm(await requireStaff(), "canCreateQuotes", "gérer le catalogue");
  await db.catalogItem.delete({ where: { id } });
  revalidatePath("/catalogue");
}

export async function saveEquipment(id: string | null, f: FormData) {
  await requireStaff();
  const quantity = Math.max(0, Math.round(n(s(f, "quantity"), 1)));
  const data = { name: s(f, "name") || "Matériel", category: s(f, "category") || "AUTRE", quantity, outOfService: Math.min(quantity, Math.max(0, Math.round(n(s(f, "outOfService"), 0)))), notes: s(f, "notes") || null };
  if (id) await db.equipment.update({ where: { id }, data });
  else await db.equipment.create({ data });
  revalidatePath("/materiel");
}

export async function deleteEquipment(id: string) {
  await requireStaff();
  await db.equipment.delete({ where: { id } });
  revalidatePath("/materiel");
}
