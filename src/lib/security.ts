import { createHash, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { db } from "./db";

/** Adresse IP et navigateur du visiteur (derrière le proxy Vercel). */
export async function requestInfo() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || "inconnue",
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

/**
 * Limitation de débit stockée en base (fonctionne avec plusieurs instances serveur).
 * Renvoie ok = false et le délai d'attente si la limite est atteinte.
 */
export async function rateLimit(key: string, max: number, windowMs: number) {
  const now = new Date();
  const k = createHash("sha256").update(key).digest("hex"); // pas d'IP ni d'e-mail en clair
  const row = await db.rateLimit.upsert({
    where: { key: k },
    update: {},
    create: { key: k, count: 0, resetAt: new Date(now.getTime() + windowMs) },
  });
  if (row.resetAt < now) {
    await db.rateLimit.update({ where: { key: k }, data: { count: 1, resetAt: new Date(now.getTime() + windowMs) } });
    return { ok: true, retryAfter: 0 };
  }
  if (row.count >= max) return { ok: false, retryAfter: Math.ceil((row.resetAt.getTime() - now.getTime()) / 60000) };
  await db.rateLimit.update({ where: { key: k }, data: { count: { increment: 1 } } });
  return { ok: true, retryAfter: 0 };
}

export async function resetRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key: createHash("sha256").update(key).digest("hex") } });
}

/** Message d'attente standard. */
export const tooMany = (min: number) => `Trop de tentatives. Réessayez dans ${min} minute${min > 1 ? "s" : ""}.`;

/** Comparaison de secrets en temps constant. */
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Nettoyage périodique (appelé par la tâche quotidienne). */
export async function purgeSecurityData() {
  const now = new Date();
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });
  await db.loginEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 180 * 864e5) } } });
}
