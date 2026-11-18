"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clearPending2fa, createSession, pending2faUser, startPending2fa } from "@/lib/auth";
import { rateLimit, requestInfo, resetRateLimit, tooMany } from "@/lib/security";
import { hashCode, verifyTotp } from "@/lib/totp";

export type LoginState = { error?: string; step?: "2fa" } | null;

// empreinte factice : même temps de calcul que l'e-mail existe ou non (pas de découverte des comptes)
const DUMMY = "$2b$12$y8WafcVuGGB.rV7wDIy8KunzVmBzfnNEjXXJ4bjn5j/PRevPS4tIi";

async function log(email: string, userId: string | null, success: boolean, reason: string | null) {
  const { ip, userAgent } = await requestInfo();
  await db.loginEvent.create({ data: { email, userId, success, reason, ip, userAgent } });
}

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") || "").trim().toLowerCase().slice(0, 200);
  const password = String(form.get("password") || "").slice(0, 200);
  const { ip } = await requestInfo();
  // 30 essais par adresse IP et 8 par compte toutes les 15 minutes
  const byIp = await rateLimit(`login:ip:${ip}`, 30, 15 * 60e3);
  const byEmail = await rateLimit(`login:email:${email}`, 8, 15 * 60e3);
  if (!byIp.ok || !byEmail.ok) {
    await log(email, null, false, "trop de tentatives");
    return { error: tooMany(Math.max(byIp.retryAfter, byEmail.retryAfter)) };
  }
  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY);
  if (!user || !ok) {
    await log(email, user?.id ?? null, false, "identifiants incorrects");
    return { error: "E-mail ou mot de passe incorrect." };
  }
  if (!user.active) {
    await log(email, user.id, false, "compte désactivé");
    return { error: "E-mail ou mot de passe incorrect." };
  }
  if (user.totpEnabled) {
    await startPending2fa(user.id);
    return { step: "2fa" };
  }
  await resetRateLimit(`login:email:${email}`);
  await log(email, user.id, true, null);
  await createSession(user.id);
  redirect(user.role === "CLIENT" ? "/portail" : "/");
}

export async function verifySecondFactor(_: LoginState, form: FormData): Promise<LoginState> {
  const user = await pending2faUser();
  if (!user) return { error: "Délai dépassé : saisissez à nouveau votre mot de passe." };
  const lim = await rateLimit(`2fa:${user.id}`, 6, 15 * 60e3);
  if (!lim.ok) {
    await clearPending2fa();
    await log(user.email, user.id, false, "double authentification : trop d'essais");
    return { error: tooMany(lim.retryAfter) };
  }
  const code = String(form.get("code") || "").trim();
  let ok = !!user.totpSecret && verifyTotp(user.totpSecret, code);
  if (!ok && code.length >= 10) {
    // code de secours (usage unique)
    const list: string[] = user.recoveryCodes ? JSON.parse(user.recoveryCodes) : [];
    const h = hashCode(code);
    if (list.includes(h)) {
      ok = true;
      await db.user.update({ where: { id: user.id }, data: { recoveryCodes: JSON.stringify(list.filter((x) => x !== h)) } });
    }
  }
  if (!ok) {
    await log(user.email, user.id, false, "code de double authentification incorrect");
    return { step: "2fa", error: "Code incorrect." };
  }
  await resetRateLimit(`2fa:${user.id}`);
  await resetRateLimit(`login:email:${user.email}`);
  await log(user.email, user.id, true, "avec double authentification");
  await createSession(user.id);
  redirect(user.role === "CLIENT" ? "/portail" : "/");
}

export async function cancelSecondFactor() {
  await clearPending2fa();
}
