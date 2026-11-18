"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { contributionsFor, getUrssaf, periodOf, turnoverBetween, ACTIVITIES, type UrssafSettings } from "@/lib/urssaf";
import { fromParis } from "@/lib/format";
import { blobToken, isBlobConfigured, saveLocal } from "@/lib/storage";
import { PLATFORMS } from "@/lib/einvoice";

async function guard() {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") throw new ForbiddenError("gérer la comptabilité");
  return u;
}
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Déclaration faite sur autoentrepreneur.urssaf.fr : on fige le CA et les cotisations de la période. */
export async function markDeclared(periodId: string, f: FormData) {
  await guard();
  const p = periodOf(periodId);
  const st = await getUrssaf();
  const turnover = s(f, "turnover") ? Number(s(f, "turnover").replace(",", ".")) : await turnoverBetween(p.start, p.end);
  const c = contributionsFor(turnover, st, p.end);
  const data = { turnover, contributions: c.social, cfp: c.cfp, incomeTax: c.incomeTax, declaredAt: new Date(), reference: s(f, "reference") || null };
  await db.urssafDeclaration.upsert({ where: { period: periodId }, update: data, create: { period: periodId, ...data } });
  revalidatePath("/comptabilite");
}

export async function markDeclarationPaid(periodId: string, paid: boolean) {
  await guard();
  await db.urssafDeclaration.update({ where: { period: periodId }, data: { paidAt: paid ? new Date() : null } });
  revalidatePath("/comptabilite");
}

export async function cancelDeclaration(periodId: string) {
  await guard();
  await db.urssafDeclaration.delete({ where: { period: periodId } });
  revalidatePath("/comptabilite");
}

export async function addExpense(f: FormData) {
  await guard();
  const file = f.get("receipt");
  let receiptUrl: string | null = null;
  if (file instanceof File && file.size) {
    if (file.size > 4 * 1024 * 1024) throw new Error("Justificatif trop lourd (4 Mo maximum).");
    if (!/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.type)) throw new Error("Justificatif : photo (JPEG, PNG) ou PDF uniquement.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isBlobConfigured()) {
      const { put } = await import("@vercel/blob");
      receiptUrl = (await put(`justificatifs/${file.name}`, Buffer.from(bytes), { access: "public", addRandomSuffix: true, token: blobToken() })).url;
    } else receiptUrl = await saveLocal("justificatifs", file.name, bytes);
  }
  await db.expense.create({
    data: {
      date: fromParis(s(f, "date") || new Date().toISOString().slice(0, 10), "12:00"),
      supplier: s(f, "supplier") || "—", label: s(f, "label") || "Dépense", category: s(f, "category") || "AUTRE",
      amountTTC: Number(s(f, "amountTTC").replace(",", ".")) || 0, vat: Number(s(f, "vat").replace(",", ".")) || 0,
      method: s(f, "method") || null, receiptUrl,
    },
  });
  revalidatePath("/comptabilite");
}

export async function deleteExpense(id: string) {
  await guard();
  await db.expense.delete({ where: { id } });
  revalidatePath("/comptabilite");
}

export async function saveAccountingSettings(f: FormData) {
  await guard();
  const num = (k: string) => (s(f, k) === "" ? null : Number(s(f, k).replace(",", ".")));
  const v: UrssafSettings = {
    activity: (s(f, "activity") in ACTIVITIES ? s(f, "activity") : "BIC_SERVICES") as UrssafSettings["activity"],
    frequency: s(f, "frequency") === "MENSUELLE" ? "MENSUELLE" : "TRIMESTRIELLE",
    versementLiberatoire: f.get("versementLiberatoire") === "on",
    acreUntil: s(f, "acreUntil"),
    acreFactor: Number(s(f, "acreFactor")) || 0.75,
    rate: num("rate"), cfp: num("cfp"), vl: num("vl"),
    creationDate: s(f, "creationDate"),
  };
  await db.setting.upsert({ where: { key: "urssaf" }, update: { value: JSON.stringify(v) }, create: { key: "urssaf", value: JSON.stringify(v) } });
  const platform = s(f, "platform") in PLATFORMS ? s(f, "platform") : "INDY";
  await db.setting.upsert({ where: { key: "einvoice" }, update: { value: JSON.stringify({ platform }) }, create: { key: "einvoice", value: JSON.stringify({ platform }) } });
  revalidatePath("/comptabilite");
  revalidatePath("/parametres/comptabilite");
}
