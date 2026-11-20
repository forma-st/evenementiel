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
  const money = (k: string) => (s(f, k) === "" ? null : Math.max(0, n(s(f, k))));
  const data = {
    name: s(f, "name") || "Matériel", brand: s(f, "brand")?.slice(0, 120) || null, category: s(f, "category") || "AUTRE", quantity,
    outOfService: Math.min(quantity, Math.max(0, Math.round(n(s(f, "outOfService"), 0)))), notes: s(f, "notes") || null,
    ...(f.has("dailyRate") ? { dailyRate: money("dailyRate"), replacementValue: money("replacementValue") } : {}),
    ...(f.has("autoBase") ? {
      autoServices: f.getAll("autoServices").map(String).filter((x) => /^[A-Z]{2,12}$/.test(x)).join(","),
      autoTypes: f.getAll("autoTypes").map(String).filter((x) => /^[A-Z]{2,14}$/.test(x)).join(","),
      autoBase: Math.max(0, Math.min(99, Math.round(n(s(f, "autoBase"), 0)))),
      autoPerGuests: s(f, "autoPerGuests") ? Math.max(1, Math.round(n(s(f, "autoPerGuests")))) : null,
      autoMax: s(f, "autoMax") ? Math.max(0, Math.round(n(s(f, "autoMax")))) : null,
      autoKeywords: (s(f, "autoKeywords") || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10).join(", ").slice(0, 300),
    } : {}),
  };
  if (id) await db.equipment.update({ where: { id }, data });
  else await db.equipment.create({ data });
  revalidatePath("/materiel");
}

export async function deleteEquipment(id: string) {
  await requireStaff();
  await db.equipment.delete({ where: { id } });
  revalidatePath("/materiel");
}

/** Proposer (ou non) l'article dans l'onglet « Options » de l'espace organisation des clients. */
export async function toggleClientOption(id: string, on: boolean) {
  await requirePerm(await requireStaff(), "canCreateQuotes", "gérer le catalogue");
  await db.catalogItem.update({ where: { id }, data: { clientOption: on } });
  revalidatePath("/catalogue");
}
