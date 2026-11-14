import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "crm_session";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret");

export type Role = "ADMIN" | "MEMBER" | "CLIENT";

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub) return null;
    const u = await db.user.findUnique({ where: { id: payload.sub } });
    return u && u.active ? u : null;
  } catch {
    return null;
  }
}

/** Accès équipe (ADMIN ou MEMBER). Les clients sont renvoyés vers leur portail. */
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
