"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { parseJson, type Checkout } from "@/lib/rental";

/** Signature du bon de sortie par l'emprunteur (sur le téléphone ou la tablette) ; enregistre la remise si besoin. */
export async function signHandover(dossierId: string, _: unknown, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  const name = String(f.get("name") ?? "").trim().slice(0, 120);
  const png = String(f.get("signature") ?? "");
  if (!name) return { error: "Indiquez le nom de la personne qui récupère le matériel." };
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) || png.length > 400_000) return { error: "Faites signer dans le cadre avant de valider." };
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, include: { equipment: { include: { equipment: { select: { name: true } } } } } });
  const prev = parseJson<Checkout>(d.checkout);
  const co: Checkout = prev ?? { at: new Date().toISOString(), by: u.name, items: d.equipment.map((x) => ({ id: x.equipmentId, name: x.equipment.name, qty: x.quantity, ok: true })), notes: "" };
  co.signature = { name, png, at: new Date().toISOString() };
  await db.dossier.update({ where: { id: dossierId }, data: { checkout: JSON.stringify(co) } });
  await db.activity.create({ data: { dossierId, userId: u.id, kind: "STATUS", body: `🖊 Bon de sortie signé par ${name}${prev ? "" : " — matériel remis"}` } });
  revalidatePath(`/materiel/bon/${dossierId}`);
  revalidatePath(`/prestations/${dossierId}`);
  revalidatePath("/materiel");
  return { ok: true };
}
