"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { passwordProblem } from "@/lib/passwords";
import { rateLimit, requestInfo, safeEqual, tooMany } from "@/lib/security";

export async function setupAdmin(_: string | null, f: FormData) {
  if ((await db.user.count()) > 0) return "L'application est déjà initialisée.";
  const lim = await rateLimit(`setup:${(await requestInfo()).ip}`, 10, 60 * 60e3);
  if (!lim.ok) return tooMany(lim.retryAfter);
  // facultatif : SETUP_TOKEN réserve la création du premier compte à qui connaît ce code
  const expected = process.env.SETUP_TOKEN;
  if (expected && !safeEqual(String(f.get("setupToken") || ""), expected)) return "Code d'installation incorrect.";
  const name = String(f.get("name") || "").trim();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  if (!name || !email) return "Nom et e-mail requis.";
  const weak = passwordProblem(password, email);
  if (weak) return weak;
  // création atomique : impossible de créer deux administrateurs en parallèle
  const u = await db.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) return null;
    return tx.user.create({ data: { name, email, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
  }, { isolationLevel: "Serializable" }).catch(() => null);
  if (!u) return "L'application est déjà initialisée.";
  await createSession(u.id);
  redirect("/");
}
