import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "crm_session";
const PENDING = "crm_2fa"; // étape intermédiaire : mot de passe validé, code de double authentification attendu
const MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Clé de signature des sessions. En production, l'application refuse de fonctionner
 * sans SESSION_SECRET (au moins 32 caractères) : sinon n'importe qui pourrait fabriquer une session.
 */
function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum).");
    return new TextEncoder().encode("dev-secret-local-uniquement-pas-en-production");
  }
  return new TextEncoder().encode(s);
}

export type Role = "ADMIN" | "MEMBER" | "CLIENT";

const cookieOpts = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge });

export async function createSession(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
  const token = await new SignJWT({ sub: userId, v: u.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOpts(MAX_AGE));
  jar.delete(PENDING);
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Déconnecte toutes les sessions ouvertes d'un utilisateur (changement de mot de passe, désactivation…). */
export async function revokeSessions(userId: string) {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

export const currentUser = cache(async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const u = await db.user.findUnique({ where: { id: payload.sub } });
    if (!u || !u.active) return null;
    if ((payload.v ?? 0) !== u.sessionVersion) return null; // session révoquée
    return u;
  } catch {
    return null;
  }
});

/* ---------- Double authentification : étape intermédiaire ---------- */

export async function startPending2fa(userId: string) {
  const token = await new SignJWT({ sub: userId, stage: "2fa" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(key());
  (await cookies()).set(PENDING, token, cookieOpts(300));
}

export async function pending2faUser() {
  const token = (await cookies()).get(PENDING)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.stage !== "2fa" || !payload.sub) return null;
    const u = await db.user.findUnique({ where: { id: payload.sub } });
    return u && u.active && u.totpEnabled ? u : null;
  } catch {
    return null;
  }
}

export async function clearPending2fa() {
  (await cookies()).delete(PENDING);
}

/** Accès équipe (ADMIN, MANAGER ou MEMBER). Les clients sont renvoyés vers leur portail. */
export async function requireStaff() {
  const u = await currentUser();
  if (!u && (await db.user.count()) === 0) redirect("/setup");
  if (!u) redirect("/login");
  if (u.role === "CLIENT") redirect("/portail");
  return u;
}

export async function requireAdmin() {
  const u = await requireStaff();
  if (u.role !== "ADMIN") redirect("/");
  return u;
}

export async function requireClient() {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.role !== "CLIENT" || !u.clientId) redirect("/");
  return u as typeof u & { clientId: string };
}
