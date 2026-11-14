"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function login(_: string | null, form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return "Identifiants incorrects.";
  if (!user.active) return "Ce compte est désactivé. Contactez votre administrateur.";
  await createSession(user.id);
  redirect(user.role === "CLIENT" ? "/portail" : "/");
}
