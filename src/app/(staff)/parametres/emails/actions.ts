"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

async function guard() {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") throw new Error("Réservé aux responsables");
}

export async function saveEmailTemplate(id: string | null, f: FormData) {
  await guard();
  const data = { name: String(f.get("name") || "Modèle"), subject: String(f.get("subject") || ""), body: String(f.get("body") || "") };
  if (id) await db.emailTemplate.update({ where: { id }, data });
  else await db.emailTemplate.create({ data });
  revalidatePath("/parametres/emails");
}

export async function deleteEmailTemplate(id: string) {
  await guard();
  await db.emailTemplate.delete({ where: { id } });
  revalidatePath("/parametres/emails");
}

export async function saveCompany(f: FormData) {
  await guard();
  const keys = ["name", "tagline", "legal", "address", "siret", "vat", "phone", "email", "web", "iban", "bic", "reviewUrl", "quoteFooter"];
  const value: Record<string, unknown> = Object.fromEntries(keys.map((k) => [k, String(f.get(k) ?? "").trim()]));
  value.vatExempt = f.get("vatExempt") === "on";
  value.teamChat = f.get("teamChat") === "on";
  await db.setting.upsert({ where: { key: "company" }, update: { value: JSON.stringify(value) }, create: { key: "company", value: JSON.stringify(value) } });
  const logo = f.get("logo");
  if (logo instanceof File && logo.size) {
    if (logo.size > 600_000 || !/^image\/(png|jpeg)$/.test(logo.type)) throw new Error("Logo : PNG ou JPEG de moins de 600 Ko.");
    const dataUrl = `data:${logo.type};base64,${Buffer.from(await logo.arrayBuffer()).toString("base64")}`;
    await db.setting.upsert({ where: { key: "company.logo" }, update: { value: dataUrl }, create: { key: "company.logo", value: dataUrl } });
  }
  if (f.get("removeLogo") === "on") await db.setting.deleteMany({ where: { key: "company.logo" } });
  revalidatePath("/", "layout");
}
