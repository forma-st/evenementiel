"use server";
import { rateLimit, requestInfo, safeEqual, tooMany } from "@/lib/security";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { grantGalleryAccess, hasGalleryAccess, isGalleryOpen } from "@/lib/galleries";
import { notify } from "@/lib/notify";

export async function unlockGallery(token: string, _: unknown, f: FormData) {
  const g = await db.gallery.findUnique({ where: { token } });
  if (!g || !isGalleryOpen(g)) return { error: "Galerie indisponible." };
  const { ip } = await requestInfo();
  const lim = await rateLimit(`gallery:${g.id}:${ip}`, 8, 15 * 60e3);
  const limAll = await rateLimit(`gallery:${g.id}`, 60, 60 * 60e3);
  if (!lim.ok || !limAll.ok) return { error: tooMany(Math.max(lim.retryAfter, limAll.retryAfter, 1)) };
  const code = String(f.get("code") ?? "").trim().toUpperCase().replace(/\s/g, "");
  if (!g.password || !safeEqual(code, g.password.toUpperCase().replace(/\s/g, ""))) return { error: "Code incorrect." };
  await grantGalleryAccess(g);
  revalidatePath(`/g/${token}`);
  return { ok: true };
}

export async function toggleFavorite(token: string, fileId: string) {
  const g = await db.gallery.findUnique({ where: { token } });
  if (!g || !isGalleryOpen(g) || !g.allowFavorites || !(await hasGalleryAccess(g))) return null;
  const f = await db.galleryFile.findFirst({ where: { id: fileId, galleryId: g.id } });
  if (!f) return null;
  const u = await db.galleryFile.update({ where: { id: f.id }, data: { favorite: !f.favorite } });
  return u.favorite;
}

/** Le client valide sa sélection : l'équipe est prévenue. */
export async function submitSelection(token: string) {
  const g = await db.gallery.findUnique({ where: { token }, include: { dossier: true, client: true } });
  if (!g || !isGalleryOpen(g) || !(await hasGalleryAccess(g))) return { error: "Galerie indisponible." };
  const n = await db.galleryFile.count({ where: { galleryId: g.id, favorite: true } });
  const staff = await db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, active: true }, select: { id: true } });
  await notify([g.dossier?.assigneeId, g.client?.ownerId, ...staff.map((s) => s.id)], { type: "SYSTEM", title: `♥ ${g.client?.name ?? "Le client"} a validé sa sélection : ${n} photo(s)`, body: g.title, link: `/galeries/${g.id}` });
  if (g.dossierId) await db.activity.create({ data: { dossierId: g.dossierId, kind: "GALLERY", body: `♥ Sélection validée par le client dans « ${g.title} » : ${n} photo(s)` } });
  return { ok: true, n };
}
