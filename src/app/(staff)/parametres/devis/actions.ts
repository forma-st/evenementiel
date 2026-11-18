"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { normalizeStyle, type PdfStyle } from "@/lib/pdfStyle";

export async function saveQuoteStyle(style: Partial<PdfStyle>) {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") throw new ForbiddenError("modifier la mise en forme des devis");
  const value = JSON.stringify(normalizeStyle(style));
  await db.setting.upsert({ where: { key: "pdfStyle" }, update: { value }, create: { key: "pdfStyle", value } });
  revalidatePath("/parametres/devis");
  return { ok: true };
}
